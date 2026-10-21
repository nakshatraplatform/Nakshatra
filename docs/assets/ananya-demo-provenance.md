# Ananya demonstration assets

Ananya is an entirely fictional adult. This is demonstration content, not a real
customer, testimonial, identity proof or liveness result. No real personal data
was submitted to generate or record the sample.

## Generated portrait

- Generator: built-in `image_gen`, 2026-10-20.
- Original: `exec-f93b9865-bd5b-4d1f-82a5-845bc02a16da.png` in the task's
  generated-images directory. Inspected before selection.
- Shipping derivative: `public/demo/ananya-traditional.webp`, mechanically
  resized to 900px wide and encoded as WebP. Image description retains origin.
- Exact prompt:

> Use case: photorealistic-natural. Asset type: fictional demonstration profile portrait for VivIntro, a marriage-sharing web app. Create a natural editorial photograph of an entirely fictional Indian woman named Ananya, clearly an adult around age 29, wearing an elegant teal silk saree with a muted gold border and simple traditional gold earrings, a small bindi. Warm, approachable expression, looking toward camera, natural skin texture, dark hair neatly arranged. Portrait composition from waist up, both shoulders and whole head visible, generous space above head for responsive crops. Soft daylight in a restrained Indian courtyard with foliage out of focus, tasteful, realistic, not a bridal fashion advertisement. Portrait 3:4 aspect. No text, no logos, no watermarks, no collage, no existing person's likeness. This represents a synthetic person, not a real customer or testimonial.

## Product captures

Capture only the local `/demo` route with the shared `BiodataTemplate` renderer,
synthetic `demoPortfolio` and the generated portrait. The recording test has an
explicit `UPDATE_DEMO_ASSETS=1` export mode; normal CI must not rewrite public
assets. Screenshots represent public-view states, not a mocked approval.

- Shipping captures: `public/demo/ananya-overview.png`, `ananya-story.png` and
  `ananya-privacy.png`, each 1024×2048 pixels.
- Walkthrough: `public/demo/ananya-walkthrough.webm`, a short three-chapter recording,
  silent, with English captions in `ananya-walkthrough.vtt` and an adjacent text
  explanation. Native playback controls; no autoplay or submitted access request.
- The final export was recorded from the local **production build**, not from
  Didit or a real account. Use `UPDATE_DEMO_ASSETS=1 npx playwright test
  --config=playwright.demo.config.ts` only when intentionally updating these
  captures with the production preview already running on loopback port 3195.
- Raster provenance scan: four shipping rasters, zero missing origin/prompt
  records. The portrait also has a prompt sidecar for metadata-reader fallback.

### October 20 framing repair

The three captures and recording were regenerated from the local production
build after making the synthetic disclosure non-sticky. It remains visible at
entry; later chapters show the real public renderer without an overlapping demo
banner. Each heading is required to fit wholly below the viewer navigation
before capture. Authoring fixes a 390×780 logical mobile viewport, 2.625 device
scale factor and reduced motion; exported PNGs remain 1024×2048. The portrait,
demo facts and public/private policy were not regenerated or changed.

Landing images now use static imports, so updated capture content receives a
new asset hash instead of reusing an old optimized image URL. The device shell
surrounds an independent 1:2 screen with contained images, not a cropped cover.

## Typography

Akaya Kanadaka Regular, Vaishnavi Murthy and Juan Luis Blanco. Kannada and Latin
display face, self-hosted and scoped to the Vivara naming section only. Source:
https://github.com/google/fonts/tree/main/ofl/akayakanadaka
License: SIL OFL, retained in `docs/assets/licenses/AkayaKanadaka-OFL.txt`.

## Motion references

Finwise's paired phone/feature presentation and Prompt Motion's
https://prompt-motion.com/twoclipping-d89be5 were inspected as references.
Their media, wording, code and customer claims are not copied. Native scrolling,
real product captures and a bounded lettering reveal are authored for VivIntro.
