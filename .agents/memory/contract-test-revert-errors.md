---
name: Contract test revert errors
description: Ganache can omit custom-error data during estimateGas failures in local contract tests.
---

Local Ganache may report a custom-error revert as generic missing revert data during
gas estimation, even when the compiled ABI contains the custom error and the
transaction correctly reverts.

**Why:** Matching provider error text made a valid withdrawal-failure regression
test fail for an environment-reporting reason rather than a contract behavior
change.

**How to apply:** Assert the revert behavior independently of the provider's
error message, and verify the custom error is present in the compiled ABI when
that is the invariant under test.