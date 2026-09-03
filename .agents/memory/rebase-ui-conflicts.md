---
name: Repeated UI rebase conflicts
description: Rebase behavior when a long sequence of UI commits repeatedly overlaps one canonical app implementation.
---

When a rebase repeatedly stops on the same UI file, each later commit may recreate the conflict even after the file has been cleanly resolved. Continue resolving the overlap against the canonical current implementation rather than assuming the first clean file ends the rebase.

**Why:** The rebase can replay multiple historical UI commits with overlapping full-file changes, and the merge tool correctly pauses at each one.

**How to apply:** Check the active conflict and remaining rebase progress after each resolution; preserve the task's current behavior, then continue through the managed merge-resolution flow until the rebase reports completion.