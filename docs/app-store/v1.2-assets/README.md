# Pocket Bullseye 1.2 screenshot assets

The files in `screenshots/` are 1242 × 2688 portrait PNGs prepared for the App Store listing.

They use the product's current dark/neon visual language and accurately represent existing Pocket Bullseye features. Scanner beams, target locks and radar sweeps visualize analysis of an uploaded chart screenshot; they do not imply a live market feed, broker connection or order execution. All chart prices, account values and examples are deterministic illustrative fixtures created for the listing; no customer chart or personal information is included.

Generate them with:

```bash
node scripts/generate-pocket-v1-2-app-store-assets.mjs
```

The generator also rebuilds `pocket-v1.2-contact-sheet.png` so the complete seven-screen story can be reviewed together.

Before uploading, visually inspect all seven assets and confirm that the approved 1.2 binary still contains every depicted feature.
