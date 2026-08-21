---
name: Oracle data boundary
description: Rules for connecting live portfolio data to warrior scoring and marketplace metadata.
---

The oracle must consume only explicitly configured public data providers and a versioned asset allowlist; if those inputs are unavailable or invalid, metadata must be marked stale or return an explicit unavailable response rather than inventing portfolio values.

**Why:** A fake leaderboard or silently substituted wallet dataset would turn a public performance identity into misleading financial claims.

**How to apply:** Keep provider validation, scoring, and metadata generation separate; require symbol, category, and contract-address allowlist matches, and expose freshness status in every successful metadata response.