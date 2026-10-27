---
name: Testnet address casing
description: Ethers address normalization for the documented Robinhood Chain testnet deployment.
---

The documented contract address is valid hexadecimal but its mixed-case spelling does not pass EIP-55 checksum validation. Passing it directly to ethers can be treated as an ENS name and fail on this network.

**Why:** The deployment is still usable, but scripts that trust the recorded casing can fail before reading or sending any transaction.

**How to apply:** Validate the `0x` prefix and 40 hexadecimal characters, then normalize the lowercased value with `ethers.getAddress` before using ethers contract or signer APIs.
