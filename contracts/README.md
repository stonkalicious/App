# Stonkalicious dynamic NFT contract

This package contains the ERC-721 foundation for the Robinhood Chain testnet.
The contract does not hold stocks, ETFs, or coins and does not try to read
portfolio balances on-chain.

## Architecture boundary

- The contract owns token identity, ownership, minting, URI configuration, and
  transfer lifecycle.
- `recordStartingBagValue` is called by the configured snapshot oracle after a
  mint or transfer. It records the current owner's starting value without
  storing any portfolio assets in the NFT.
- On every transfer, the contract resets `startingBagValue` to zero, updates the
  wallet and timestamp, and increments the snapshot epoch.
- The off-chain metadata service reads `ownerOf`, `snapshotOf`, and its own
  allowlisted portfolio data to choose Naive, Focused, Hardened, or Elite.
  `tokenURI` points marketplaces at that service.

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
4. Set the metadata service to use the deployed contract and verify that
   `tokenURI`, transfer resets, and `recordStartingBagValue` work end to end.
5. Prepare a separate mainnet deployment only after testnet behavior,
   allowlist rules, scoring thresholds, artwork, and metadata caching are
   formally locked. Do not reuse testnet addresses or send irreversible
   mainnet transactions from this package.

The repeatable deployment command is:

```bash
RPC_URL=... \
DEPLOYER_PRIVATE_KEY=... \
SNAPSHOT_ORACLE=0x... \
BASE_TOKEN_URI=https://metadata.example/token/ \
MAX_SUPPLY=10000 \
MINT_PRICE_ETH=0.01 \
MAX_PER_WALLET=3 \
pnpm --dir contracts run deploy:testnet
```

The deployment script is intentionally not hardcoded to an RPC endpoint or
private key. Supply those values through the deployment environment's secret
manager, never commit them, and never paste them into chat.