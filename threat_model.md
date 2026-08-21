# Stonkalicious pre-launch threat model

**Scope:** Robinhood Chain testnet-first ERC-721, dynamic metadata service, public showcase, future X identity verifier, and future challenge leaderboard.

**Status:** Pre-launch review. No deployment, mint opening, or public announcement is authorized.

## Security goals

1. Only an authorized launch process can create warriors, change price/supply parameters, or withdraw funds.
2. A wallet cannot mint more than one lifetime warrior, including free, public, and admin allocations.
3. A transferred warrior starts a new performance run and cannot retain the previous owner's X identity.
4. Portfolio valuation and level changes are reproducible, bounded, attributable to a snapshot, and resistant to oracle tampering.
5. Metadata cannot silently become malicious, disappear, or be rewritten without an observable record.
6. A challenge ranking cannot be inflated by duplicate identities, fake progress, replayed claims, or unbounded API traffic.
7. No private X OAuth data, credentials, or wallet-linked personal information is exposed unnecessarily.
8. The NFT and its metadata/oracle services have read-only access to qualifying public wallet data and can never move, trade, approve, or withdraw user assets.

## Assets and trust boundaries

| Asset | Main boundary | Security concern |
| --- | --- | --- |
| NFT ownership and mint supply | User wallet ↔ contract | Unauthorized minting, transfer bugs, approval abuse |
| Mint funds | Contract ↔ owner withdrawal | Compromised owner key or unsafe withdrawal |
| Snapshot and level state | Oracle ↔ contract/metadata service | Falsified P&L, stale data, oracle compromise |
| Dynamic image and JSON | Metadata service ↔ OpenSea/other indexers | Server compromise, poisoning, cache inconsistency |
| X account binding | X OAuth ↔ verifier ↔ contract | Account spoofing, OAuth CSRF, rebinding, privacy leaks |
| Challenge rank | Wallet/oracle/API ↔ leaderboard | Sybil wallets, replay, rate abuse, fake cohort data |
| Admin and deployment controls | Operators ↔ production | Hot-key compromise, accidental configuration, irreversible launch |

## Non-custodial boundary

The NFT is a read-only performance record, not a vault, broker, trading bot, or
portfolio manager. The system must never request, accept, or store seed phrases,
private keys, or wallet-draining approvals. Wallet connections should be used
only to read public chain state and to request explicitly scoped signatures for
identity or claim authorization. A wallet signature for a claim or identity
must never be presented as permission to transfer user assets.

The metadata/oracle service must use public RPC/indexer reads and separate
server credentials for its own operations. It must not ask users to approve
ERC-20 allowances, set operators, sign arbitrary transactions, or deposit
assets into a contract. Any future contract change that adds custody,
allowances, swaps, or withdrawals is outside this product's security boundary
and requires a new review.

## Current high-priority findings

### P0 — Centralized oracle can falsify performance

`recordStartingBagValue` accepts an arbitrary value from `snapshotOracle`, and the owner is also allowed to call oracle-authorized functions. The metadata service can therefore make ROI and levels look better or worse than the underlying wallet data.

**Required before mainnet or public launch**

- Separate owner/governance from the operating oracle.
- Put owner and oracle control behind a multisig, not a single hot key.
- Define the exact allowlisted assets, valuation timestamps, price source, decimals, and stale-price behavior.
- Store a signed snapshot record containing wallet, token ID, epoch, valuation timestamp, asset-set version, total value, and source identifiers.
- Reject stale, future-dated, out-of-order, or impossible updates.
- Make level transitions deterministic from the published snapshot rules.
- Keep an append-only audit trail and expose the latest snapshot timestamp.

### P0 — Mutable metadata endpoint can rewrite the collection

The base URI is mutable and the contract currently has no ERC-4906 metadata update events or `contractURI`. A compromised metadata server could serve malicious images/links, change historical values, or disappear; indexers may also keep stale cached responses.

**Required before launch**

- Serve strict JSON with HTTPS and stable content types; never serve HTML, script, or user-controlled URLs as NFT media.
- Pin artwork and contract-level metadata to content-addressed storage where practical.
- Version metadata and preserve historical snapshots rather than silently overwriting them.
- Add `MetadataUpdate(tokenId)` and `BatchMetadataUpdate` events when metadata changes, as recommended by OpenSea.
- Add `contractURI()` and `ContractURIUpdated()`.
- Restrict URI changes to a multisig/timelock and document the freeze decision.
- Add monitoring that fetches every token URI and validates schema, image type, status code, size, and external links.

### P0 — One-wallet limits do not prevent sybil farming

The contract correctly enforces one lifetime mint per address, but a person can use many addresses. Admin allocations can also be abused if the operational allocation process is not controlled.

**Required before a public mint**

- Use typed, expiring EIP-712 claim signatures for allowlist/free allocations, including chain ID, contract address, wallet, allocation, nonce, and expiry.
- Track used nonces/claims and make the signed allocation single-use.
- Keep admin minting behind a multisig and require an on-chain allocation manifest or auditable event.
- Use a fair launch mechanism: queue, capped claim window, or signed allowlist rather than an unrestricted gas race.
- Add a pause/emergency stop controlled by multisig, with clear limits and an auditable unpause process.
- Rate-limit the website/API separately; never treat frontend gating as security.

## Contract-specific review

### Positive controls already present

- Exact payment and max supply checks are on-chain.
- One lifetime warrior per wallet is enforced across public and admin mints.
- Zero-address and nonexistent-token checks exist.
- Transfers clear approvals, reset the snapshot epoch, and clear the X-profile binding.
- Safe transfers revert if the receiver contract does not implement the ERC-721 receiver interface.
- Snapshot and X-profile writes are restricted to the configured oracle or owner.

### Required contract hardening

1. Add ERC-4906 events and emit them whenever an oracle update changes token metadata.
2. Add `contractURI()` for OpenSea collection metadata.
3. Replace generic `require` strings with custom errors for all failure paths, including withdrawal failure.
4. Add a pause mechanism before mint opening; pause mint/admin mint and oracle writes, but define transfer behavior explicitly.
5. Put ownership and oracle rotation behind a multisig/timelock policy. Test recovery and rotation before deployment.
6. Add fuzz/property tests for supply, payment, one-per-wallet, transfers, approvals, receiver callbacks, snapshot epochs, and X-binding uniqueness.
7. Have the final bytecode independently reviewed and verified against the source before any funded deployment.
8. Do not call `freezeMetadata()` until the immutable/final metadata strategy is chosen and tested. Freezing a bad URI is irreversible.

## Oracle and valuation abuse cases

- **Stale prices:** reject or visibly mark prices outside a maximum age.
- **Price spikes/crashes:** use bounded movement checks and multiple sources where available.
- **Token decimals:** normalize every asset using verified decimals; never assume 18.
- **Unsupported assets:** ignore assets outside the allowlist and publish the allowlist version.
- **Self-referential pricing:** do not value an asset using a manipulable thin pool controlled by the same participant.
- **Replay/out-of-order snapshots:** include monotonically increasing epoch/version and reject older updates.
- **Transfer race:** process the on-chain transfer event as the authority; do not let a pre-transfer oracle job write post-transfer data.
- **Wallet classification:** define whether smart-contract wallets are supported and test them explicitly.
- **Service outage:** show the last verified snapshot and timestamp; never silently display fabricated zeros or a fresh run.

## X identity and privacy

The contract stores only a hash, which is the right direction, but the current contract function alone does not prove that an X account was authenticated. The verifier must:

- Use OAuth state and PKCE, validate redirect URI and issuer, and prevent login CSRF.
- Bind the provider's stable account ID, not a mutable handle.
- Use a server-side nonce and one-time binding token with short expiry.
- Verify that the connected wallet signed an EIP-4361-style intent or equivalent domain-separated message.
- Prevent profile binding to a token not owned by that wallet at verification time.
- Never log access tokens, authorization codes, raw stable IDs, or unnecessary profile data.
- Provide a documented recovery path for a compromised X account without silently allowing arbitrary rebinding.
- Treat X linking as anti-spam friction, not proof of one human or one real-world person.

## Leaderboard and anti-spam controls

Challenge-relative ranks should be calculated only inside an immutable cohort definition:

- challenge ID and target range
- entry timestamp/window
- starting value and valuation rules
- participant eligibility
- snapshot cadence and cutoff time
- tie-breaking rule

The API should:

- derive identity from verified wallet ownership and verified X binding;
- enforce one active challenge identity per wallet/profile;
- use idempotency keys for snapshot ingestion;
- rate-limit by IP, wallet, X profile, and endpoint;
- cap request body size and reject unexpected fields;
- paginate and cache public leaderboard responses;
- never trust rank, ROI, or level values supplied by the browser;
- record audit events for joins, transfers, profile links, snapshots, and rank changes;
- expose “last verified snapshot” and data freshness;
- moderate or hide abusive display names and external links.

## OpenSea and metadata checklist

OpenSea's current documentation says it reads ERC-721 metadata from `tokenURI`, expects valid JSON/media/traits, and recommends ERC-4906 events when metadata changes. It also supports contract-level metadata through `contractURI` and offers a refresh endpoint for manual recovery.

Before submitting or sharing the collection:

- Confirm every `tokenURI` returns valid JSON for a real token.
- Use HTTPS or pinned content-addressed media; do not expose localhost, development domains, private endpoints, or credentials.
- Validate `image`, `external_url`, and any animation URL against an allowlist.
- Include numeric traits for current value, high-water mark, low-water mark, drawdown, and challenge rank where appropriate.
- Keep legal/risk language in the collection and token descriptions as well as on the website.
- Test metadata refresh on testnet and confirm that an update event changes the indexed item.
- Verify collection name, avatar, banner, external link, creator attribution, and royalty configuration.

## Launch gates

Do not fund or announce the deployment until all of these are true:

- Independent contract review and testnet rehearsal complete.
- Multisig ownership/oracle control configured and recovery tested.
- Pause and emergency response process documented.
- Metadata service has schema validation, monitoring, backups, and safe failure behavior.
- EIP-712 claims and anti-bot launch flow tested under load.
- OAuth flow has state/PKCE, consent, privacy policy, and token handling review.
- Challenge cohort/ranking rules are published before entries open.
- Risk disclaimer, terms, privacy policy, and jurisdiction-specific legal review are complete.
- Contract source and deployment parameters are reproducibly verified.

## References

- OpenSea Metadata Standards: https://docs.opensea.io/docs/metadata-standards
- OpenSea Updating Metadata: https://docs.opensea.io/docs/updating-metadata
- OpenSea Contract-level Metadata: https://docs.opensea.io/docs/contract-level-metadata
- EIP-4906: https://eips.ethereum.org/EIPS/eip-4906
- EIP-712: https://eips.ethereum.org/EIPS/eip-712