// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Stonkalicious
/// @notice An ERC-721 NFT whose visual tier is resolved by an off-chain
/// metadata service from the current owner's allowlisted Robinhood Chain coins.
contract Stonkalicious {
    string public name = "Stonkalicious";
    string public symbol = "STONK";

    uint256 public immutable maxSupply;
    uint256 public immutable mintPrice;
    uint256 public immutable maxPerWallet;

    address public owner;
    address public pendingOwner;
    address public snapshotOracle;
    address public mintSigner;
    string private _baseTokenURI;
    string private _contractURI;
    bool public paused;
    uint256 private _nextTokenId = 1;
    uint256 public totalSupply;
    uint256 public constant TRANSFER_LOCK = 7 days;
    bytes32 private constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant _MINT_TYPEHASH =
        keccak256("Mint(address wallet,uint256 quantity,bytes32 profileHash,bytes32 challengeId,uint256 nonce,uint256 deadline)");

    mapping(uint256 tokenId => address) private _owners;
    mapping(address account => uint256) private _balances;
    mapping(uint256 tokenId => address) private _tokenApprovals;
    mapping(address account => mapping(address operator => bool)) private _operatorApprovals;
    mapping(address account => uint256) public mintedByWallet;
    mapping(bytes32 profileHash => uint256 tokenId) public warriorByXProfile;
    mapping(uint256 tokenId => bytes32) public xProfileOf;
    mapping(uint256 tokenId => uint256) public transferableAfter;
    mapping(uint256 nonce => bool) public usedMintNonces;

    struct Snapshot {
        address wallet;
        uint64 acquiredAt;
        uint64 epoch;
        uint256 startingBagValue;
    }

    mapping(uint256 tokenId => Snapshot) private _snapshots;

    error NotOwner();
    error NotAuthorized();
    error InvalidQuantity();
    error InvalidAddress();
    error SoldOut();
    error IncorrectPayment();
    error TokenDoesNotExist();
    error TransferToNonReceiver();
    error Paused();
    error NotPendingOwner();
    error InvalidSignature();
    error SignatureExpired();
    error MintNonceUsed();
    error TransferLocked();
    error SnapshotNotAllowed();
    error XProfileAlreadyBound();
    error InvalidXProfile();

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event WarriorSnapshotReset(
        uint256 indexed tokenId,
        address indexed previousOwner,
        address indexed newOwner,
        uint64 epoch,
        uint64 acquiredAt
    );
    event WarriorSnapshotRecorded(
        uint256 indexed tokenId,
        address indexed wallet,
        uint256 startingBagValue,
        uint64 acquiredAt,
        uint64 epoch
    );
    event SnapshotOracleUpdated(address indexed previousOracle, address indexed newOracle);
    event MetadataBaseURIUpdated(string previousURI, string newURI);
    event ContractURIUpdated(string previousURI, string newURI);
    event MetadataUpdate(uint256 indexed _tokenId);
    event BatchMetadataUpdate(uint256 indexed _fromTokenId, uint256 indexed _toTokenId);
    event PauseStateUpdated(bool paused);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed pendingOwner);
    event MintSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event XProfileBound(uint256 indexed tokenId, bytes32 indexed profileHash, address indexed wallet);
    event XProfileUnbound(uint256 indexed tokenId, bytes32 indexed profileHash, address indexed wallet);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlySnapshotOracle() {
        if (msg.sender != snapshotOracle && msg.sender != owner) revert SnapshotNotAllowed();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    constructor(
        uint256 maxSupply_,
        uint256 mintPrice_,
        uint256 maxPerWallet_,
        string memory baseTokenURI_,
        address snapshotOracle_,
        address mintSigner_
    ) {
        if (maxSupply_ == 0 || maxPerWallet_ != 1 || maxPerWallet_ > maxSupply_) {
            revert InvalidQuantity();
        }
        if (snapshotOracle_ == address(0)) revert InvalidAddress();
        if (mintSigner_ == address(0)) revert InvalidAddress();
        owner = msg.sender;
        maxSupply = maxSupply_;
        mintPrice = mintPrice_;
        maxPerWallet = maxPerWallet_;
        _baseTokenURI = baseTokenURI_;
        snapshotOracle = snapshotOracle_;
        mintSigner = mintSigner_;
        emit OwnershipTransferred(address(0), msg.sender);
        emit SnapshotOracleUpdated(address(0), snapshotOracle_);
        emit MintSignerUpdated(address(0), mintSigner_);
    }

    function mint(
        uint256 quantity,
        bytes32 profileHash,
        bytes32 challengeId,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external payable whenNotPaused {
        if (block.timestamp > deadline) revert SignatureExpired();
        if (usedMintNonces[nonce]) revert MintNonceUsed();
        if (profileHash == bytes32(0) || challengeId == bytes32(0)) revert InvalidXProfile();
        if (warriorByXProfile[profileHash] != 0) revert XProfileAlreadyBound();
        if (quantity == 0 || quantity > maxPerWallet - mintedByWallet[msg.sender]) {
            revert InvalidQuantity();
        }
        if (totalSupply + quantity > maxSupply) revert SoldOut();
        if (msg.value != mintPrice * quantity) revert IncorrectPayment();
        bytes32 structHash = keccak256(abi.encode(
            _MINT_TYPEHASH, msg.sender, quantity, profileHash, challengeId, nonce, deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        if (_recover(digest, signature) != mintSigner) revert InvalidSignature();
        usedMintNonces[nonce] = true;
        mintedByWallet[msg.sender] += quantity;
        uint256 tokenId = _nextTokenId;
        _mintWarriors(msg.sender, quantity);
        warriorByXProfile[profileHash] = tokenId;
        xProfileOf[tokenId] = profileHash;
        emit XProfileBound(tokenId, profileHash, msg.sender);
    }

    function adminMint(address to, uint256 quantity) external onlyOwner whenNotPaused {
        if (to == address(0)) revert InvalidAddress();
        if (quantity == 0 || quantity > maxPerWallet - mintedByWallet[to] || totalSupply + quantity > maxSupply) {
            revert InvalidQuantity();
        }
        mintedByWallet[to] += quantity;
        _mintWarriors(to, quantity);
    }

    function _mintWarriors(address to, uint256 quantity) internal {
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            _owners[tokenId] = to;
            _balances[to]++;
            totalSupply++;
            _snapshots[tokenId] = Snapshot({
                wallet: to,
                acquiredAt: uint64(block.timestamp),
                epoch: 1,
                startingBagValue: 0
            });
            transferableAfter[tokenId] = block.timestamp + TRANSFER_LOCK;
            emit Transfer(address(0), to, tokenId);
            emit WarriorSnapshotReset(tokenId, address(0), to, 1, uint64(block.timestamp));
        }
    }

    function recordStartingBagValue(uint256 tokenId, uint256 startingBagValue) external onlySnapshotOracle whenNotPaused {
        address tokenOwner = ownerOf(tokenId);
        Snapshot storage snapshot = _snapshots[tokenId];
        snapshot.wallet = tokenOwner;
        snapshot.startingBagValue = startingBagValue;
        emit WarriorSnapshotRecorded(
            tokenId,
            tokenOwner,
            startingBagValue,
            snapshot.acquiredAt,
            snapshot.epoch
        );
        emit MetadataUpdate(tokenId);
    }

    /// @notice Binds a verified X account to the current owner's NFT.
    /// @dev The off-chain verifier must authenticate X and pass a non-reversible
    /// hash of the provider's stable account identifier, never the handle.
    function bindXProfile(uint256 tokenId, bytes32 profileHash) external onlySnapshotOracle whenNotPaused {
        address tokenOwner = ownerOf(tokenId);
        if (profileHash == bytes32(0)) revert InvalidXProfile();
        uint256 existingToken = warriorByXProfile[profileHash];
        if (existingToken != 0 && existingToken != tokenId) revert XProfileAlreadyBound();

        bytes32 previousHash = xProfileOf[tokenId];
        if (previousHash != bytes32(0) && previousHash != profileHash) revert XProfileAlreadyBound();
        if (previousHash == profileHash) return;
        warriorByXProfile[profileHash] = tokenId;
        xProfileOf[tokenId] = profileHash;
        emit XProfileBound(tokenId, profileHash, tokenOwner);
        emit MetadataUpdate(tokenId);
    }

    function setSnapshotOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert InvalidAddress();
        emit SnapshotOracleUpdated(snapshotOracle, newOracle);
        snapshotOracle = newOracle;
    }

    function setMintSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert InvalidAddress();
        emit MintSignerUpdated(mintSigner, newSigner);
        mintSigner = newSigner;
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PauseStateUpdated(value);
    }

    function snapshotOf(uint256 tokenId) external view returns (Snapshot memory) {
        _requireOwned(tokenId);
        return _snapshots[tokenId];
    }

    function transferFrom(address from, address to, uint256 tokenId) public whenNotPaused {
        if (block.timestamp < transferableAfter[tokenId]) revert TransferLocked();
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotAuthorized();
        if (ownerOf(tokenId) != from) revert NotAuthorized();
        if (to == address(0)) revert InvalidAddress();
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 response) {
                if (response != IERC721Receiver.onERC721Received.selector) revert TransferToNonReceiver();
            } catch {
                revert TransferToNonReceiver();
            }
        }
    }

    function approve(address approved, uint256 tokenId) external {
        address tokenOwner = ownerOf(tokenId);
        if (msg.sender != tokenOwner && !isApprovedForAll(tokenOwner, msg.sender)) revert NotAuthorized();
        _tokenApprovals[tokenId] = approved;
        emit Approval(tokenOwner, approved, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        if (operator == address(0)) revert InvalidAddress();
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        _requireOwned(tokenId);
        return _tokenApprovals[tokenId];
    }

    function isApprovedForAll(address account, address operator) public view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = _owners[tokenId];
        if (tokenOwner == address(0)) revert TokenDoesNotExist();
        return tokenOwner;
    }

    function balanceOf(address account) external view returns (uint256) {
        if (account == address(0)) revert InvalidAddress();
        return _balances[account];
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(_baseTokenURI, _toString(tokenId));
    }

    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    function baseTokenURI() external view returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseTokenURI(string calldata newURI) external onlyOwner {
        emit MetadataBaseURIUpdated(_baseTokenURI, newURI);
        _baseTokenURI = newURI;
        emit BatchMetadataUpdate(1, type(uint256).max);
    }

    function setContractURI(string calldata newURI) external onlyOwner {
        emit ContractURIUpdated(_contractURI, newURI);
        _contractURI = newURI;
    }

    function withdraw(address payable recipient) external onlyOwner {
        if (recipient == address(0)) revert InvalidAddress();
        (bool success,) = recipient.call{value: address(this).balance}("");
        require(success, "withdraw failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f || interfaceId == 0x49064906;
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        delete _tokenApprovals[tokenId];
        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;
        Snapshot storage snapshot = _snapshots[tokenId];
        bytes32 profileHash = xProfileOf[tokenId];
        if (profileHash != bytes32(0)) {
            delete warriorByXProfile[profileHash];
            delete xProfileOf[tokenId];
            emit XProfileUnbound(tokenId, profileHash, from);
        }
        snapshot.wallet = to;
        snapshot.acquiredAt = uint64(block.timestamp);
        snapshot.epoch++;
        snapshot.startingBagValue = 0;
        transferableAfter[tokenId] = block.timestamp + TRANSFER_LOCK;
        emit Approval(from, address(0), tokenId);
        emit Transfer(from, to, tokenId);
        emit WarriorSnapshotReset(tokenId, from, to, snapshot.epoch, snapshot.acquiredAt);
        emit MetadataUpdate(tokenId);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address tokenOwner = ownerOf(tokenId);
        return spender == tokenOwner || _tokenApprovals[tokenId] == spender || isApprovedForAll(tokenOwner, spender);
    }

    function _requireOwned(uint256 tokenId) internal view {
        if (_owners[tokenId] == address(0)) revert TokenDoesNotExist();
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(
            _DOMAIN_TYPEHASH,
            keccak256(bytes(name)),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }

    function _recover(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        if (signature.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidSignature();
        if (uint256(s) > 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0) {
            revert InvalidSignature();
        }
        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0)) revert InvalidSignature();
        return recovered;
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 digits;
        uint256 copy = value;
        while (copy != 0) {
            digits++;
            copy /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}