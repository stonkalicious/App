# Robinhood Chain testnet launch checklist

## Current launch decision

**NO-GO — testnet deployment is not configured or authorized.**

No contract has been deployed from this workspace, no metadata endpoint has been
released, and no public mint or announcement is authorized.

## Official network details

- Network: Robinhood Chain testnet
- Chain ID: `46630`
- Native gas token: `ETH`
- RPC: `https://rpc.testnet.chain.robinhood.com`
- Explorer: `https://explorer.testnet.chain.robinhood.com`

## Deployment state

| Item | Status |
| --- | --- |
| Contract address | **Not deployed** |
| Metadata base URL | **Unset** |
| `/api/token/:tokenId` release | Locked until `METADATA_PUBLIC=true` |
| Coin-only allowlist | **Not configured** |
| Deployer role | **Not configured** |
| Snapshot-oracle role | **Not configured** |
| Mint-signer role | **Not configured** |
| Explorer source verification | Not applicable — no deployment |

The three operational roles must use separate non-zero addresses:
deployer/owner, snapshot oracle, and mint signer. Private keys must remain in the
deployment secret manager and must never be committed or pasted into chat.

## Local and mock rehearsal results

The local contract suite covers minting, payment and supply limits, ownership,
snapshot recording, transfer resets and locks, metadata permissions, duplicate
identity enforcement, pause behavior, and ownership controls.

The API rehearsal covers:

- Fresh dynamic NFT metadata.
- Stale metadata during a public-data provider outage.
- An explicit `503` after stale data expires.
- The metadata-public lock (`404` while disabled).
- Rejection of invalid wallet, asset, and provider payloads.

These local/mock results do not prove testnet connectivity, deployment success,
explorer verification, or production metadata availability.

## Blockers before a testnet go decision

- [ ] Configure and validate the official testnet RPC and chain ID.
- [ ] Choose and review final contract parameters.
- [ ] Configure separate deployer, snapshot-oracle, and mint-signer addresses.
- [ ] Configure the explicit Robinhood Chain coin-only allowlist.
- [ ] Deploy with a dedicated testnet wallet.
- [ ] Verify deployed source and constructor values on the testnet explorer.
- [ ] Set and validate the metadata base URL and collection URL.
- [ ] Keep metadata locked until the endpoint, cache, stale fallback, and
      wallet-data privacy checks pass against the deployed contract.
- [ ] Exercise mint authorization, one-wallet lifetime enforcement, identity
      uniqueness, seven-day transfer lock/reset, pause recovery, and metadata
      update events on testnet.
- [ ] Confirm no mainnet transaction, public mint, funding request, or
      announcement is included in the testnet rehearsal.

## Automatic no-go conditions

Do not proceed if any of the following is true:

1. The connected chain is not chain ID `46630`.
2. Any required deployment address is zero, shared with an incompatible role, or
   not independently controlled.
3. The contract address, metadata URL, or coin-only allowlist is missing.
4. `METADATA_PUBLIC` is enabled before deployed-contract and endpoint checks pass.
5. Wallet verification requests custody, seed phrases, private keys, approvals,
   or arbitrary transactions.
6. A provider outage fabricates fresh performance instead of serving explicitly
   stale data or returning unavailable.
7. Source verification, transfer reset, identity uniqueness, or pause recovery
   fails on testnet.