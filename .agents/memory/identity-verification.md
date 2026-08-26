---
name: Identity verification boundary
description: Privacy and replay constraints for linking an X account to a wallet-bound warrior.
---

The verifier may derive the contract profile hash from X's stable account identifier, but raw handles, access tokens, client secrets, and provider responses must never be persisted, returned in metadata, or logged. Wallet proof must be a plain signature, and any mint authorization must be short-lived, challenge-bound, and one-use.

**Why:** The collection's identity promise is non-custodial and pre-launch privacy is strict; a leaked provider token or replayable binding would let an attacker impersonate an account or confuse wallet ownership.

**How to apply:** Keep OAuth state/PKCE and authorization records expiring and opaque, check both wallet and profile uniqueness against the contract before issuing authorization, and let the user's wallet submit any future transaction.