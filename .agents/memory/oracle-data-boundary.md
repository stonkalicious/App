---
name: Oracle data boundary
description: Rules for connecting live portfolio data to warrior scoring and marketplace metadata.
---

The oracle must consume only explicitly configured public data providers and a versioned asset allowlist; if those inputs are unavailable or invalid, metadata must be marked stale or return an explicit unavailable response rather than inventing portfolio values.

**Why:** A fake leaderboard or silently substituted wallet dataset would turn a public performance identity into misleading financial claims.

**How to apply:** Keep provider validation, scoring, and metadata generation separate; require symbol, category, and contract-address allowlist matches, and expose freshness status in every successful metadata response.

The contract's recorded-zero baseline must be distinguished from an unrecorded
baseline using an explicit on-chain write marker; metadata must not score an
epoch until the marker matches the current snapshot epoch.

**Why:** A zero starting value is valid state, so treating `0` as “not
recorded” can either suppress legitimate data or score an uninitialized epoch
as if it were verified.

**How to apply:** Read the public snapshot-write marker alongside the snapshot,
require epoch equality before fetching/scoring public wallet data, and return an
explicit unavailable response while the baseline is pending.