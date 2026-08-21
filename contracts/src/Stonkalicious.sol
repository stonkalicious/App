// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Stonkalicious
/// @notice An ERC-721 warrior whose visual tier is resolved by an off-chain
/// metadata service from the current owner's allowlisted portfolio.
contract Stonkalicious {
    string public name = "Stonkalicious";
    string public symbol = "STONK";

    uint256 public immutable maxSupply;
    uint256 public immutable mintPrice;
    uint256 public immutable maxPerWallet;

    address public owner;
    address public snapshotOracle;
    string private _baseTokenURI;
    bool public metadataFrozen;
    uint256 private _nextTokenId = 1;
    uint256 public totalSupply;

    mapping(uint256 tokenId => address) private _owners;
    mapping(address account => uint256) private _balances;
    mapping(uint256 tokenId => address) private _tokenApprovals;
    mapping(address account => mapping(address operator => bool)) private _operatorApprovals;
    mapping(address account => uint256) public mintedByWallet;
    mapping(bytes32 profileHash => uint256 tokenId) public warriorByXProfile;
    mapping(uint256 tokenId => bytes32) public xProfileOf;

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
    error MetadataIsFrozen();
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
    event MetadataFrozen();
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
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

    constructor(
        uint256 maxSupply_,
        uint256 mintPrice_,
        uint256 maxPerWallet_,
        string memory baseTokenURI_,
        address snapshotOracle_
    ) {
        if (maxSupply_ == 0 || maxPerWallet_ != 1 || maxPerWallet_ > maxSupply_) {
            revert InvalidQuantity();
        }
        if (snapshotOracle_ == address(0)) revert InvalidAddress();
        owner = msg.sender;
        maxSupply = maxSupply_;
        mintPrice = mintPrice_;
        maxPerWallet = maxPerWallet_;
        _baseTokenURI = baseTokenURI_;
        snapshotOracle = snapshotOracle_;
        emit OwnershipTransferred(address(0), msg.sender);
        emit SnapshotOracleUpdated(address(0), snapshotOracle_);
    }

    function mint(uint256 quantity) external payable {
        if (quantity == 0 || quantity > maxPerWallet - mintedByWallet[msg.sender]) {
            revert InvalidQuantity();
        }
        if (totalSupply + quantity > maxSupply) revert SoldOut();
        if (msg.value != mintPrice * quantity) revert IncorrectPayment();
        mintedByWallet[msg.sender] += quantity;
        _mintWarriors(msg.sender, quantity);
    }

    function adminMint(address to, uint256 quantity) external onlyOwner {
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
            emit Transfer(address(0), to, tokenId);
            emit WarriorSnapshotReset(tokenId, address(0), to, 1, uint64(block.timestamp));
        }
    }

    function recordStartingBagValue(uint256 tokenId, uint256 startingBagValue) external onlySnapshotOracle {
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
    }

    /// @notice Binds a verified X account to the current owner's warrior.
    /// @dev The off-chain verifier must authenticate X and pass a non-reversible
    /// hash of the provider's stable account identifier, never the handle.
    function bindXProfile(uint256 tokenId, bytes32 profileHash) external onlySnapshotOracle {
        address tokenOwner = ownerOf(tokenId);
        if (profileHash == bytes32(0)) revert InvalidXProfile();
        uint256 existingToken = warriorByXProfile[profileHash];
        if (existingToken != 0 && existingToken != tokenId) revert XProfileAlreadyBound();

        bytes32 previousHash = xProfileOf[tokenId];
        if (previousHash != bytes32(0) && previousHash != profileHash) {
            delete warriorByXProfile[previousHash];
            emit XProfileUnbound(tokenId, previousHash, tokenOwner);
        }
        warriorByXProfile[profileHash] = tokenId;
        xProfileOf[tokenId] = profileHash;
        emit XProfileBound(tokenId, profileHash, tokenOwner);
    }

    function setSnapshotOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert InvalidAddress();
        emit SnapshotOracleUpdated(snapshotOracle, newOracle);
        snapshotOracle = newOracle;
    }

    function snapshotOf(uint256 tokenId) external view returns (Snapshot memory) {
        _requireOwned(tokenId);
        return _snapshots[tokenId];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
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

    function baseTokenURI() external view returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseTokenURI(string calldata newURI) external onlyOwner {
        if (metadataFrozen) revert MetadataIsFrozen();
        emit MetadataBaseURIUpdated(_baseTokenURI, newURI);
        _baseTokenURI = newURI;
    }

    function freezeMetadata() external onlyOwner {
        if (metadataFrozen) revert MetadataIsFrozen();
        metadataFrozen = true;
        emit MetadataFrozen();
    }

    function withdraw(address payable recipient) external onlyOwner {
        if (recipient == address(0)) revert InvalidAddress();
        (bool success,) = recipient.call{value: address(this).balance}("");
        require(success, "withdraw failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f;
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
        emit Approval(from, address(0), tokenId);
        emit Transfer(from, to, tokenId);
        emit WarriorSnapshotReset(tokenId, from, to, snapshot.epoch, snapshot.acquiredAt);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address tokenOwner = ownerOf(tokenId);
        return spender == tokenOwner || _tokenApprovals[tokenId] == spender || isApprovedForAll(tokenOwner, spender);
    }

    function _requireOwned(uint256 tokenId) internal view {
        if (_owners[tokenId] == address(0)) revert TokenDoesNotExist();
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