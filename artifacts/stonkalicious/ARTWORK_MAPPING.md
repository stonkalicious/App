# Warrior artwork mapping

This is the canonical mapping used by the showcase and metadata service. Stage
keys and display levels are unchanged from the scoring model.

| Stage key | Display level | Artwork | Review status |
| --- | --- | --- | --- |
| `newb` | Beginning | `newb.png` | Available |
| `liquidated` | Climbing | `liquidated.png` | Available |
| `back` | Contender | `back.png` | Available |
| `wrecked` | Stacked | `wrecked.png` | Available |
| `hardened` | Forged | `hardened.png` | Available — helmet and fire artwork |
| `profitable` | Master | `profitable.png` | Available |
| `elite` | Elite | `elite.png` | Available — crown and bright orb artwork |
| `plumber` | God | `plumber.png` | **Blocked** |

`plumber.png` and `elite.png` are currently byte-for-byte identical. There is
no approved distinct God replacement asset in the project. The canonical map
therefore marks `plumber` as blocked: the UI shows an explicit asset-blocked
state, and the metadata service refuses to serve a God image rather than
silently presenting Elite artwork under the God label.

When an approved God asset is provided, replace `plumber.png`, set the
`plumber` status to `available`, remove the blocker, and rerun the focused
artwork-map check before enabling metadata.