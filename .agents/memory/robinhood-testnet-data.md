---
name: Robinhood testnet asset data
description: Constraint on using Robinhood's official Stock Token API for testnet metadata.
---

The official Stock Token REST API currently exposes stock-token metadata and
prices, but its listed deployments are mainnet-only and it does not provide the
wallet holdings response required by the metadata oracle for chain `46630`. The
service can load the live official registry for a matching chain and derive
holdings from those ERC-20 contracts using read-only RPC calls. It must not map
mainnet contract addresses onto testnet or fabricate missing testnet balances.

**Why:** Pointing the oracle at an incompatible or mainnet-only feed would make
testnet metadata inaccurate and could violate the no-fabrication launch boundary.

**How to apply:** Keep `METADATA_PUBLIC` disabled until a chain-matching
registry or explicitly approved testnet mirror exists, then publish and
validate the derived endpoint for privacy, price freshness, stale-cache
behavior, and the deployed contract.