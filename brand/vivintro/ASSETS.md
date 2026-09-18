# VivIntro asset inventory

- `index.html` + `identity.css`: responsive visual brand guide; serve this directory locally for review.
- `BRAND-GUIDE.md`: positioning, story, messaging, brand usage and adoption guidance.
- `tokens.json`: proposed brand reference tokens, not live application configuration.
- `contrast-report.json`: measured foreground/background ratios.
- `assets/symbol-{teal,ink,reverse,black}.svg`: recommended Opening chapter mark.
- `assets/wordmark-{teal,ink,reverse,black}.svg`: outlined Manrope wordmark.
- `assets/lockup-{teal,ink,reverse,black}.svg`: horizontal combined logo.
- `assets/concept-02-chosen-frame.svg`, `assets/concept-03-shared-line.svg`: alternative concepts, not additional brand marks.
- `assets/app-icon.svg`, `assets/app-icon-1024.png`, `assets/app-icon-512.png`, `assets/apple-touch-icon.png`: square app masters; no baked platform mask.
- `assets/social-avatar.svg`, `assets/social-avatar-512.png`: avatar with circular safe composition.
- `assets/favicon.svg`, `assets/favicon-16.png`, `assets/favicon-32.png`, `assets/favicon-48.png`, `assets/favicon.ico`: optically simplified small mark and fallbacks.
- `assets/chapter-pattern.svg`: optional decorative motif.
- `previews/brand-overview.png`, `previews/mobile-guide.png`: rendered guide previews.
- `assets/social-post-1200.png`: raster example social composition.
- `fonts/`: existing application font specimens, embedded metadata and OFL licenses. Retain licenses when distributing font files. Pre-existing Source Sans files are not used.
- `build_identity.py`: reproducible vector construction. Requires Python fonttools/brotli and the app's cached Latin WOFF2 files via `--font-cache`.
- `render_identity.cjs`: PNG/ICO export and viewport verification; accepts a Node dependency directory as its argument. Requires the guide served on localhost:4178 and installed Edge.

SVG logo paths contain no live text/font dependency. App icon and social avatar backgrounds are intentional; symbol and lockup SVGs have transparent backgrounds. PNGs are sRGB digital assets. Print production should use the SVG vectors with printer-specific color proofing; no generic CMYK conversion is claimed.
