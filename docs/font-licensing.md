# Runtime font licensing

The current root layout uses Inter and Plus Jakarta Sans from `src/lib/fonts.ts`
through `next/font/google` and serves the generated font assets locally. The
latest-main integration retains these runtime families, rather than restoring
the older Geist/Playfair/Manrope/Tenor layout. Retain source distributions'
SIL OFL notices and confirm the shipped versions during release.

On 2026-10-17, the owner authorized removal of nine unused legacy binaries from
`public/fonts` and their obsolete `@font-face` declarations. The current source
scan found no consuming family references. Root font imports are unchanged.
Removal takes effect on the live application only after deployment; it does not
erase historical Git copies, prior deployments, or cached downloads.

Complete foundry packages, source
kits, specimens, license documents, and archives must not be placed under
`public`, because Next.js exposes that directory over HTTP.

## Removed legacy inventory (recoverable from Git history)

- `Harmond-ExtraBoldExpanded.otf`
- `Harmond-SemiBoldCondensed.otf`
- `HKGroteskWide-ExtraBold.otf`
- `MangoGrotesque-Light.ttf`
- `MangoGrotesque-Medium.ttf`
- `MangoGrotesque-Regular.ttf`
- `MangoGrotesque-SemiBold.ttf`
- `Ranade-Medium.woff`
- `Ranade-Medium.woff2`

## Release requirement

Removal does not establish historical rights to the legacy fonts. For the fonts
still used at runtime, the product owner must retain
evidence that each runtime font is covered by an appropriate commercial or
open-source web-font license. In particular, do not assume that a font copied
from a package labelled "free for personal use" is licensed for this product.

Keep purchase receipts, license certificates, and foundry source packages in
the approved private business records location, not in this repository or any
web-served directory.
