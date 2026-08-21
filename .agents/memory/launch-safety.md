---
name: Launch safety boundary
description: Non-custodial launch constraints and the contract policies that must remain true before deployment.
---

Public mint authorization must remain server-signed and bound to wallet, verified X identity, challenge, nonce, expiry, and chain-specific contract domain; the contract must never custody or operate wallet assets.

**Why:** The collection is a public performance identity, so unrestricted minting, replayable claims, or wallet permissions would undermine both identity uniqueness and the non-custodial promise.

**How to apply:** Preserve one lifetime warrior per wallet, live mutable metadata with update events, transfer reset behavior, emergency pause, two-step ownership, and hardware-wallet/multisig operations in all future launch work.