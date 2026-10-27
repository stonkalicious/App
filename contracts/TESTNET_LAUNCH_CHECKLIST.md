# Robinhood Chain testnet launch checklist

## Current launch decision

**NO-GO — deployment is complete, but the private rehearsal and metadata
release gates are incomplete.**

The contract is deployed and source-verified on Robinhood Chain testnet. No
public mint, metadata release, or announcement is authorized until every
unchecked gate below passes.

## Official network details

- Network: Robinhood Chain testnet
- Chain ID: `46630`
- Native gas token: `ETH`
- RPC: `https://rpc.testnet.chain.robinhood.com`
- Explorer: `https://explorer.testnet.chain.robinhood.com`

## Deployment state

| Item | Status |
| --- | --- |
| Contract address | `0xB9fF6D9dc5ecea6ADc71a23C37306a40E72782a8` |
| Metadata base URL | `https://stonkalicious.com/api/token/` in contract |
| Collection URL | `https://stonkalicious.com/api/collection` in contract |
| `/api/token/:tokenId` release | **Locked** — endpoint checks are not complete |
| Public asset-data endpoint | `https://stonkalicious.com/api/assets` configured for the next publish — source-driven registry assets plus qualifying native crypto |
| Asset universe | **Source-driven** — active official Stock Tokens/ETFs, excluding WETH/USDG/stables, plus native crypto above `$5M` market cap |
| Deployer role | `0x6274d61e22F7B5f41635F1586743aE9eAC3A9bAf` |
| Snapshot-oracle role | `0x43903Cde46160d59629c2B15743C983C9c446485` |
| Mint-signer role | `0x4FCc0A58b70ef0b59AF504C59b2B5ca6A385ACab` |
| Royalty receiver | **Not verified on the recorded deployment** — the current source requires an explicit receiver |
| Public claims and preview labels | Reviewed for the current preview; final human/legal review still required |
| Explorer source verification | **Verified** — [contract source](https://explorer.testnet.chain.robinhood.com/address/0xB9fF6D9dc5ecea6ADc71a23C37306a40E72782a8#code) |

### Deployment record

- Chain ID: `46630`
- Deployment transaction:
  `0x718d83bd6b089afdb94dfbfa18a40bb7ab89ffccbaebce204ad0f4da48f0610c`
- Compiler: `solc 0.8.36+commit.8a079791`
- Optimizer: enabled, `200` runs, EVM version `paris`
- Constructor values: `maxSupply=10000`, `mintPrice=0.01 ETH`,
  `maxPerWallet=1`, and the two URLs above

### Testnet asset-data configuration

The read-only asset endpoint loads active Stock Token and ETF deployments from
Robinhood's official `/rhj/assets` registry, excluding WETH, USDG, and stable
assets. Crypto candidates are checked against native Robinhood Chain market
pairs, require deployed bytecode, and must meet the `$5,000,000` market-cap
floor. Stock prices come from `/rhj/prices/{symbol}` with the official registry
multiplier applied.

The endpoint returns `no-store`, accepts only a wallet address, performs
read-only RPC calls, and never requests a signature, approval, transfer, or
custody action. It fails closed on registry, chain, RPC, price, and freshness
errors. The official registry currently exposes mainnet deployments only; the
testnet rehearsal remains locked until a matching chain-`46630` asset registry
or an explicitly approved testnet mirror is available. The current public
deployment still serves the previous build until published.

The three operational roles must use separate non-zero addresses:
deployer/owner, snapshot oracle, and mint signer. Private keys must remain in the
deployment secret manager and must never be committed or pasted into chat.

The recorded deployment predates the current royalty receiver and
epoch-bound snapshot-write requirements in the source tree. Do not treat this
address as verification of those newer requirements; deploy and verify the
current source again before any launch decision.

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

### Live testnet rehearsal result

Completed successfully against the deployed contract:

- Mint authorization and first identity binding.
- One-wallet lifetime limit.
- Duplicate identity rejection.
- Authorized snapshot-oracle write.
- Seven-day transfer lock enforcement.
- Pause blocking oracle writes and pause recovery.
- Metadata base URI update and restoration.

On-chain state after the initial pre-unlock rehearsal:

- `totalSupply=1`; token `1` is owned by the deployer.
- Token `1` has the oracle snapshot with `startingBagValue=100000`.
- Contract is unpaused.
- Base token URI and collection URI are restored to their verified values.

### Post-unlock transfer verification — 2026-10-27

Completed against the live testnet deployment after the real lock expired:

- Transfer transaction:
  `0x326b4d465ad324253ce0ccced93f60045a7fab23976a1822e0d8f538466a057c`
- Token `1` transferred from the deployer to the configured snapshot oracle.
- The snapshot wallet changed to the new owner, `startingBagValue` reset from
  `100000` to `0`, and the epoch incremented from `1` to `2`.
- The token's X profile hash was cleared and its lookup returned no token.
  A non-mutating call from the configured verifier confirmed the old hash can
  be rebound to this token without changing state.
- The contract remained unpaused, and the token and collection metadata
  endpoints stayed unavailable (`503`, `Cache-Control: no-store`) before and
  after the transfer.

The dedicated `post-unlock` rehearsal phase verifies this existing token and
does not attempt another mint.

## Blockers before a testnet go decision

- [x] Configure and validate the official testnet RPC and chain ID.
- [x] Choose and review final contract parameters.
- [x] Configure separate deployer, snapshot-oracle, and mint-signer addresses.
- [ ] Configure and review the explicit royalty receiver and fixed 5% ERC-2981
      policy for the current source.
- [x] Configure source-driven official Stock Token/ETF discovery and native crypto thresholding.
- [x] Deploy with a dedicated testnet wallet.
- [x] Verify the recorded deployment source and constructor values on the testnet
      explorer.
- [ ] Complete qualified human contract review; AI-assisted review is informational
      only and is not independent audit assurance.
- [x] Set and validate the metadata base URL and collection URL on the deployed
      contract.
- [ ] Keep metadata locked until the endpoint, cache, stale fallback, and
      wallet-data privacy checks pass against the deployed contract and the
      updated API is published.
- [x] Exercise mint authorization, one-wallet lifetime enforcement, identity
      uniqueness, snapshot-oracle writes, seven-day transfer lock enforcement,
      pause recovery, and metadata update/restore on testnet.
- [x] After the real seven-day lock expires, exercise transfer reset, snapshot
      reset, and identity unbinding on testnet.
- [ ] Exercise `recordStartingBagValue(tokenId, expectedEpoch,
      startingBagValue)` with the live `snapshotOf(tokenId).epoch`; confirm
      wrong-epoch and duplicate writes (including zero) revert, while the
      configured oracle can write once per epoch and the owner cannot. Confirm
      `snapshotWriteEpoch(tokenId) == snapshotOf(tokenId).epoch` after a write,
      including a zero-valued write, and keep metadata unavailable until then.
- [ ] Confirm `supportsInterface(0x2a55205a)` and `royaltyInfo` return the
      configured receiver and 500 basis points on the current deployment.
- [x] Confirm no mainnet transaction, public mint, funding request, or
      announcement is included in the testnet rehearsal.

## Review findings still open outside this task

The snapshot boundary is hardened above, but this task does not silently close
other review findings. Before a launch go decision, explicitly resolve or
accept each of these:

- [ ] Choose a mutable-versus-pinned metadata strategy and protect URI changes
      with the selected governance control; keep endpoint monitoring and safe
      failure behavior in place.
- [ ] Put admin minting behind the selected multisig/manifest process and audit
      every emergency allocation.
- [ ] If optional X identity linking is enabled, document and test
      X-profile recovery/rebinding for a compromised account without
      permitting arbitrary rebinding.
- [ ] Define pause authority, transfer behavior while paused, and recovery
      procedures under the selected governance control.
- [ ] Review the global mint-nonce namespace and replay policy as part of the
      final claim-signing design.

## Automatic no-go conditions

Do not proceed if any of the following is true:

1. The connected chain is not chain ID `46630`.
2. Any required deployment address is zero, shared with an incompatible role, or
   not independently controlled.
3. The contract address, metadata URL, or source-driven asset registry is missing.
4. `METADATA_PUBLIC` is enabled before deployed-contract and endpoint checks pass.
5. Wallet verification requests custody, seed phrases, private keys, approvals,
   or arbitrary transactions.
6. A provider outage fabricates fresh performance instead of serving explicitly
   stale data or returning unavailable.
7. Snapshot writes omit the expected epoch, accept duplicate writes in one
   epoch, or allow owner bypass of the configured oracle.
8. Any open review finding above is treated as fixed without an explicit
   design decision, test, and operational control.
9. Source verification, transfer reset, identity uniqueness, or pause recovery
   fails on testnet.
10. The deployed royalty receiver or ERC-2981 rate differs from the reviewed
    5% policy.
11. Any illustrative wallet value, rank, growth figure, share card, referral
    statement, or metadata description can reasonably be mistaken for a live
    result, guaranteed outcome, reward, or available mint.