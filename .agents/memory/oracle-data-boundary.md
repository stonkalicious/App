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

Relative tier assignment also requires an explicit eligible snapshot cohort and
ranking epoch. A visible sample or collection max supply is not a substitute
for that cohort; preview re-ranking must remain labeled as illustrative until
the oracle has a configured cohort feed.

**Why:** Percentile boundaries are only meaningful when every eligible NFT is
compared in the same data window. Inferring the cohort from a partial preview
could present a sample movement as a live holder-level claim.

**How to apply:** Keep the shared percentile model deterministic, provide the
oracle with a versioned cohort/ranking input before enabling live relative
metadata, and keep sample controls out of live scoring paths.