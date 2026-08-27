# Stonkalicious dynamic NFT contract

This package contains the ERC-721 foundation for the Robinhood Chain testnet.
The contract does not hold Robinhood Chain coins and does not try to read
coin balances on-chain.
The NFT and metadata service are strictly observational: they can read
qualifying public on-chain balances and prices, but cannot move, trade,
approve, or withdraw wallet assets. Never give the project a wallet seed phrase
or private key.

## Architecture boundary

- The contract owns token identity, ownership, minting, URI configuration, and
  transfer lifecycle.
- The launch policy is one lifetime NFT per wallet. Public minting requires
  an EIP-712 authorization from the configured `mintSigner`, bound to the
  wallet, X profile hash, challenge, nonce, and expiry. `maxPerWallet` must be
  configured as `1`, and admin/free allocations count against the same wallet
  ledger.
- An authorized identity verifier can bind one hashed X account identifier to
  one active NFT. The raw X handle and OAuth credentials stay off-chain.
- `recordStartingBagValue` is called by the configured snapshot oracle after a
  mint or transfer. It records the current owner's starting value without
  storing any portfolio assets in the NFT.
- On every transfer, the contract resets `startingBagValue` to zero, updates the
  wallet and timestamp, and increments the snapshot epoch.
- The off-chain metadata service reads `ownerOf`, `snapshotOf`, and its own
  allowlisted Robinhood Chain coin data to choose the current NFT level and
  social performance card.
  `tokenURI` points marketplaces at that service.
- Metadata stays mutable by design. Base URI changes emit ERC-4906-compatible
  `BatchMetadataUpdate`; snapshot and identity changes emit `MetadataUpdate`.
  There is no metadata-freeze switch.
- Transfers are blocked for seven days after mint or transfer, then reset the
  snapshot and clear the X binding. Ownership is two-step
  (`transferOwnership`, then `acceptOwnership`), and the owner can pause minting,
  transfers, oracle writes, and admin mints for emergencies.
- `contractURI()` provides collection-level marketplace metadata.

## Local checks

From the repository root:

```bash
pnpm --dir contracts install
pnpm --dir contracts run check
```

The tests use a disposable local EVM and verify minting, exact payment,
per-wallet limits, ownership, snapshot recording, transfer resets, metadata,
and owner/oracle permissions.

## Robinhood Chain testnet checklist

1. Confirm the official Robinhood Chain testnet RPC URL, chain ID, explorer
   URL, and native gas token before deployment.
2. Choose final values for `maxSupply`, `mintPrice`, `maxPerWallet`, the
   metadata service base URI, and the snapshot oracle address.
3. Deploy with those values using a dedicated deployer wallet. Verify the
   source on the testnet explorer.
4. Set `BASE_TOKEN_URI` to the deployed metadata service's `/api/token/` route
   and `CONTRACT_URI` to its `/api/collection` route. Verify that `tokenURI`,
   `contractURI`, transfer resets, and `recordStartingBagValue` work end to end.
5. Prepare a separate mainnet deployment only after testnet behavior,
   allowlist rules, scoring thresholds, artwork, and metadata caching are
   formally locked. Do not reuse testnet addresses or send irreversible
   mainnet transactions from this package.

The repeatable deployment command is:

```bash
RPC_URL=... \
DEPLOYER_PRIVATE_KEY=... \
SNAPSHOT_ORACLE=0x... \
MINT_SIGNER=0x... \
BASE_TOKEN_URI=https://metadata.example/token/ \
CONTRACT_URI=https://metadata.example/collection \
MAX_SUPPLY=10000 \
MINT_PRICE_ETH=0.01 \
MAX_PER_WALLET=1 \
pnpm --dir contracts run deploy:testnet
```

The metadata API reads the deployed contract with read-only `eth_call`
requests. Its runtime configuration requires `METADATA_BASE_URL`,
`ROBINHOOD_RPC_URL`, `STONKALICIOUS_CONTRACT_ADDRESS`,
`PUBLIC_ASSET_DATA_URL`, and `ROBINHOOD_ASSET_ALLOWLIST_JSON`. Metadata remains
locked unless `METADATA_PUBLIC=true` is explicitly set. Before that release
flag is enabled, token and collection routes return `404`, set `no-store`, and
do not expose wallet or portfolio data. `API_ALLOWED_ORIGINS` should contain
only the official site origin when the metadata is released.

## Identity verification configuration

The API identity routes require `X_CLIENT_ID`, `X_CLIENT_SECRET`,
`X_REDIRECT_URI`, `IDENTITY_APP_BASE_URL`, `MINT_SIGNER_PRIVATE_KEY`, and
`MINT_PRICE_WEI`, plus the existing contract and RPC settings. Keep the X
client secret and mint signer key in the deployment secret manager; they are
never returned to the browser or written to logs. The OAuth flow requests
`users.read` only, uses state plus S256 PKCE, and retains only the stable X
account identifier's hash in the short-lived process store.

The user first signs a plain wallet-control message. The message explicitly
does not approve, move, or custody assets. After X verification, the API
issues one short-lived EIP-712 mint authorization tied to the wallet, profile
hash, challenge, nonce, chain, and contract. The user submits any future mint
transaction from their own wallet; the API never asks for a seed phrase or
private key. Identity sessions and reservations are intentionally short-lived
and should be backed by a shared expiring store before running multiple API
instances.

The deployment script is intentionally not hardcoded to an RPC endpoint or
private key. Supply those values through the deployment environment's secret
manager, never commit them, and never paste them into chat.