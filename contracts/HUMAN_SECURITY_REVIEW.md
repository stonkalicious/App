# Human-conducted security review

## Review record

- Review type: Human-conducted contract and API identity/oracle review.
- Qualification and scope: The project owner confirms that the reviewer was
  qualified in smart-contract security, inspected the Robinhood Chain testnet
  deployment and operational role separation, and reviewed the source areas
  summarized below.
- Deployment reviewed: Chain ID `46630`, contract
  `0xB9fF6D9dc5ecea6ADc71a23C37306a40E72782a8`.
- Finding disposition: The project owner accepts the contract findings below
  as open launch blockers. This is not acceptance of the risks as safe or
  permission to launch.
- Assurance boundary: This human review is not represented as a formal audit
  and does not guarantee contract safety.

The originally submitted report incorrectly included an AI-assisted review
disclaimer. The project owner confirmed that wording was included by mistake.

The launch checklist states that this deployment predates the current source,
including the current royalty-receiver and epoch-bound snapshot-write
requirements. The review of the recorded deployment does not establish that
its bytecode matches the current source. Source-matched deployment and
verification remain separate launch gates.

## Contract review

### Controls reviewed

- EIP-712 mint signatures bind the wallet, quantity, profile hash, challenge
  ID, nonce, deadline, chain ID, and verifying contract; nonces are single-use.
- Public and admin mint enforce the one-token-per-wallet limit.
- The seven-day transfer lock is enforced. Transfers reset the snapshot epoch
  and starting value, clear the X-profile binding and approvals, restart the
  lock, and emit metadata update events.
- Snapshot writes are oracle-only, epoch-bound, and single-use per epoch,
  including zero-valued writes. `snapshotWriteEpoch` distinguishes an unwritten
  epoch from a zero-valued write.
- Two-step ownership transfer is implemented.
- Pause blocks minting, admin minting, oracle writes, and transfers.
- The review also examined custom errors, 5% ERC-2981 royalties, ERC-4906
  metadata events, safe-transfer receiver checks, and signature malleability
  protection.
- The reviewer reported no apparent exploitable reentrancy path in the
  reviewed flow and noted the standard low-`s` signature check.

### Findings accepted as open launch blockers

1. **Centralized snapshot oracle (reviewer-rated P0).** The configured oracle
   can submit an arbitrary starting value, and the owner can rotate the oracle.
   Before launch, define and enforce role separation, auditable rotation,
   append-only signed records, approved data sources, and freshness rules.
2. **Mutable metadata (reviewer-rated P0).** The owner can change the token and
   collection URIs. Decide whether metadata remains mutable or becomes pinned,
   and protect URI changes with the selected governance control.
3. **Admin mint governance.** `adminMint` can allocate tokens to arbitrary
   addresses within the wallet limit. Require an auditable allocation process
   under the selected multisig or equivalent governance.
4. **Sybil exposure.** One token per wallet does not prevent one person from
   using multiple wallets. Define claim eligibility and external controls for
   any free or allowlisted allocation.
5. **Pause freezes transfers.** The owner can halt transfers while paused.
   Disclose this behavior and define pause authority and recovery procedures.
6. **Withdrawal observability.** Successful withdrawals emit no event. The
   reviewer identified this as a minor observability gap.

These findings remain unresolved. Their acceptance as blockers preserves the
NO-GO decision and is not a security-risk waiver.

## Supplemental API, identity, and oracle observations

These observations were included in the broader review. They are recorded
separately from the contract-finding disposition above:

- Session, challenge, authorization, and rate-limit state is in memory and is
  lost on process restart; production use needs durable storage and expiry
  cleanup.
- The mint signer key is supplied through the environment; protect the hot key
  or move signing to an appropriately controlled signing service before public
  use.
- IP-only rate limiting is a soft control and can be bypassed through rotating
  IPs or proxies.
- Metadata and oracle behavior depends on correct RPC, allowlist, and contract
  configuration; bad configuration or a compromised RPC can affect scoring.
- Production must ensure environment files, logs, and error responses do not
  expose keys or session material.

## Launch boundary

No public mint, metadata release, mainnet activity, or announcement is
authorized by this review. Continue to follow every unchecked gate and
automatic no-go condition in `TESTNET_LAUNCH_CHECKLIST.md`.
