# VivIntro identity system

Status: recommended creative direction, prepared for review. This package does not rename the application or change its behavior. Open `index.html` for the visual guide; all primary logo artwork is supplied as outlined SVG.

## 1. Brand foundation

**Name:** VivIntro. Always one word, capital V and I. Do not write Viv Intro, VIV INTRO or vivintro in prose. Lowercase is appropriate in technical addresses. No invented linguistic origin or pronunciation claim is attached to the name.

**Tagline:** Your Story. Your Introduction. Your Control.

**Category:** Personal portfolios for meaningful introductions. For the current marriage-introduction audience, use the concrete descriptor “A personal portfolio for marriage introductions.” A broader brand does not imply that new relationship use cases are implemented.

**Positioning:** For people and families making considered marriage introductions, VivIntro turns biodata into a current personal portfolio, helping a person tell their story and choose how much to share at each stage.

**Brand essence:** A considered beginning, authored by you.

**Emotional progression:** From the discomfort of being reduced to a file, to the confidence of being represented in your own words, to the clarity of deciding what to share next. The product should feel composed, warm, respectful and explicit. Never flirtatious, exclusive, mystical, competitive or bureaucratic.

## 2. Brand story

An introduction is often a list before it is a conversation: a name, an education, a profession, a handful of photographs. Useful facts, but an incomplete account of a person.

VivIntro gives those facts a home and the person behind them a voice. A portfolio can hold a story, a journey, values and the everyday details that help someone understand a life. One current introduction replaces the need to keep sending revised files.

And because a personal story deserves a personal say, sharing happens deliberately. You choose the first view. You review requests to see more. You decide what comes next.

VivIntro does not promise a perfect match. It makes room for a more meaningful beginning.

## 3. Product evidence and design decisions

The current task checkout is `6356/Nakshatra`, still named Nakshatra. The newer phase implementation is in `1521/Nakshatra`. Both were inspected; the latter contains the approved display terminology and 15-day access policy. This distinction matters when someone implements the brand later.

| Evidence | Identity decision | Boundary |
| --- | --- | --- |
| `DESIGN.md`: representation, trust and control | Authored editorial character with calm operational surfaces | Design vision is not proof every proposed feature exists |
| `src/components/landing/LandingExperience.module.css` | Paper, ink, deep teal and gold anchor the brand | Landing values do not replace portfolio values |
| `src/app/layout.tsx` | Retain Manrope, Playfair Display, Geist and Tenor Sans | No additional live font dependency |
| `src/features/portfolio/celestial-theme.ts` | Keep navy action, teal protection and gold editorial roles | Owner-selected portfolio appearance stays independent |
| `src/app/app-theme.css`, `docs/application-theme.md` | Dark assets use existing slate and light ink | Do not recolor owner portfolios from app theme |
| Newer `src/features/portfolio/template.ts` | Brief Introduction / Detailed Introduction / Complete Portfolio | Preserve internal persisted keys during any naming migration |
| Newer `src/features/portfolio/server/lifecycle-policy.ts` | Time-limited access is part of the control story | 15 days is product policy, not a permanent logo or slogan element |
| Lucide imports and existing controls | Rounded line icons and literal labels | Logo is not a verification seal |
| Recent mobile tour changes | Flat, readable content on small screens | Layered graphics and scrolling effects are optional decoration |

## 4. Symbol concepts and recommendation

1. **Opening chapter — recommended.** A folded folio suggests a V; the open right edge introduces a deliberate pause in its enclosure. It represents a personal story that opens with intent. The form works in one color and can become a restrained graphic motif. It can also read as a book: always introduce it beside the VivIntro wordmark until recognition develops.
2. **Chosen frame.** A partially open editorial frame contains a few story lines. Good alignment with self-presentation, but closer to generic document/scanning symbols. Retain as a supporting frame motif, not a second identity.
3. **Shared line.** Two strokes form a V connected by a short bridge. Compact and connection-oriented, but more generic and less expressive of the product's portfolio architecture.

These are original drawings prepared for this project. No claim of trademark clearance or market uniqueness is made. A final commercial identity needs a separate similarity/name clearance step before registration or broad launch.

## 5. Wordmark and logo use

The wordmark uses **Manrope 600**, taken from the same font family already used in the UI, with fixed tracking at the exported scale. Keep the capital I legible; never replace it with lowercase l. The delivery SVGs contain vector outlines, not live text. `build_identity.py` preserves the construction so files can be regenerated.

Primary: deep teal symbol and wordmark on paper or warm white. Secondary: ink on paper. Reverse: warm white on deep teal or slate. Black artwork is available for single-ink output. Do not pair Quiet teal as a small logo against dark backgrounds.

| Element | Minimum digital width | Proposed print minimum |
| --- | --- | --- |
| Symbol | 24px | 6mm |
| Horizontal lockup | 144px | 32mm |
| Wordmark alone | 112px | 25mm |
| Simplified favicon | 16px | Not for print |

Clear space: at least ¼ of the symbol's viewBox width around every logo; for wordmark-only use ½ the capital height. The tagline is a separate text element with at least one body-line gap; omit it if it would be smaller than 12px. Never compress the full tagline into a favicon or app icon.

Do not rotate, stretch, outline, recolor individual letters, add gradients, put the logo in a verification badge, place it on busy photographs, or add wedding imagery. Large-scale cropping of the symbol is permitted only as clearly decorative artwork; always include an intact logo elsewhere in that composition.

App icon: square 1024px master; the OS applies its mask. Do not bake platform corner shapes into the master. Social avatar: circle-safe composition inside a square. Favicon: separate simplified geometry at 16px, not a tiny detailed lockup. All three are supplied as SVG and PNG, with a multi-size ICO for browser fallback.

## 6. Color contracts

The brand palette is a compatible alias layer, not an instruction to normalize global CSS.

| Role | Light value | Existing origin / use |
| --- | --- | --- |
| Paper | `#F8F6F0` | Landing canvas; most brand layouts |
| Surface | `#FFFDF8` | Landing cards and reverse logo |
| Ink | `#162A33` | Landing primary copy |
| Muted | `#627178` | Secondary landing copy on light surfaces |
| Deep teal | `#174B55` | Brand signature and landing primary actions |
| Quiet teal | `#477B77` | Portfolio protected-content/verification role |
| Chapter gold | `#A86708` | Landing editorial emphasis and chapter numbering |
| Rule | `#D9D7CE` | Decorative separators, not essential control outlines |

Portfolio retains its existing **primary navy `#213F59`**, **gold `#8F6628`**, **teal `#477B77`**, and its own paper/ink values. Semantic role consistency matters more than making all hex values identical. Brand teal does not make every UI state teal.

Dark application values: canvas `#111B22`, surface `#1B2932`, ink `#EDF2EF`, muted `#B0BFCA`, teal accent `#8FD4C8`, gold `#E2C07A`, border `#6B838F`. Use the supplied warm-white logo on dark surfaces. Do not put a light accent text token on a light filled button.

Suggested visual balance: 70–80% paper/surfaces, 15–25% ink/deep teal, at most 5% gold or secondary accents. These guide composition, not exact page measurements.

**Accessibility:** See `contrast-report.json` for calculated sRGB text/background ratios. Use pair-specific results; aim for at least 4.5:1 for normal text and 3:1 for meaningful non-text boundaries. On Paper, Quiet teal measures 4.45:1 and Chapter gold 4.22:1: neither is approved for normal-size text on that background. Use existing portfolio gold `#8F6628` for small gold labels and existing app focus teal `#315F5C` for small teal labels; retain the lighter colors for decoration or qualifying large text. Muted `#627178` passes on Paper, but on the guide's darker tint `#EEECE3` use the proposed text variant `#58666D`. Color never carries verification or expiry alone. Borders used solely as separators may be subtle; inputs and focus outlines must remain discernible.

On the darker tint `#EEECE3`, use the proposed gold text variant `#805C24`: portfolio gold is only approved here on Paper, not every surface. The supplied guide demonstrates this distinction.

**Danger:** Never a decorative brand accent. Preserve app error and destructive-action roles. Destructive owner actions use the app danger treatment; validation errors keep their existing semantic error treatment. No red emphasis on a person's profile or traits.

## 7. Typography and layout

| Role | Typeface | Treatment |
| --- | --- | --- |
| Wordmark | Manrope 600 | Outlined artwork; fixed spacing |
| Editorial headline / personal name | Playfair Display 400–500 | 48–80px hero desktop; 36–48px mobile; 1.1–1.2 line height |
| Reading copy / portfolio | Manrope 400–500 | 16–18px, 1.55–1.7 line height |
| UI / operations | Geist 400–600 | 14–16px; explicit labels and statuses |
| Chapter label | Tenor Sans 400 | 12–14px, modest tracking; short labels only |
| Technical content | Existing Geist Mono | Only where monospacing improves reading |

Section headings 32–48px; card headings 24–32px. These are proposed ranges to use as components are touched. Do not rewrite all typography in one pass. Avoid gold paragraphs, ultra-light body weights, long all-caps text and typography that turns personal details into a luxury ranking.

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96px. Controls use the existing approximately 9px radius; cards can use 16px. Maintain 16–24px mobile gutters and 55–70-character reading measures. Borders and whitespace do most of the grouping; shadows are occasional depth cues.

At small widths: one reading column, normal document flow, wrap all meaningful copy, remove decorative stacked sheets, retain clear navigation and actions. Respect reduced motion; no auto-advancing story text. Proposed optional transitions are short fades around 160–200ms, with instant state changes under reduced motion. Avoid animating security status for effect.

All exported font files are Latin subsets of the fonts already cached by the application. Multilingual product text must use suitable native-script fallbacks; do not claim these subsets cover Indic scripts. Font licenses and embedded metadata are included. Pre-existing Source Sans files in this directory were preserved but are not part of the recommended system.

## 8. Iconography, imagery and graphic motifs

Continue Lucide's 24px line-icon system with 1.75–2px strokes, rounded joins and a text label for important actions. Story/document, link, preview, lock and person icons cover the product's real jobs. Use shields/checks only with a precise verification scope. The logo must never be mistaken for a verified-person stamp.

Motifs: numbered chapter rails (narrative sequence), offset sheets (multiple intentional views of one record), and interrupted frames (a deliberate opening). Keep them peripheral. Do not use a decorative open frame to indicate actual authorization.

Photography, when needed: individual portraits and everyday environments, natural light, relaxed expression, inclusive ages/skin tones, and space around the subject. Use consented, licensed imagery. Avoid paired romantic poses, ceremonial objects, bridal palettes, desirability cues and stock celebration imagery. No generated human portrait is necessary for this identity; the examples use typography and geometry.

## 9. Messaging system

| Pillar | Promise | Product proof | Sample line |
| --- | --- | --- | --- |
| Your story | Representation with context | Narrative and structured portfolio sections | “More than facts. A story in your own words.” |
| Your introduction | A considered first view | Brief and Detailed Introduction options | “Choose how your story begins.” |
| Your control | Deliberate sharing | Request, approval, time-limited access and revocation | “Choose who can see more.” |
| Meaningful beginnings | Space to understand someone | A shareable portfolio that supports conversation | “Make room for a real conversation.” |

Tone: respectful, plain, assured and warm. Address the person as “you.” Recognize family involvement without transferring agency away from the owner. Explain the next action and consequence in the same sentence. No urgency tricks, compatibility promises or comparative ranking.

Brand headline: **Your story. On your terms.**

Short descriptor: **A personal portfolio for meaningful introductions.**

Current audience descriptor: **Turn your biodata into a personal portfolio for marriage introductions.**

25-word description: **VivIntro turns biodata into a personal portfolio, helping you share your story, choose your introduction, and decide who can see more as a conversation develops.**

Social bio: **Personal portfolios for meaningful introductions. Your Story. Your Introduction. Your Control.**

Welcome: “Your story starts here.” Returning user: “Welcome back.” Saved state: “Your draft is saved.” Empty requests: “No requests yet. Share your introduction when you are ready.” Decline: “Decline request.” Revocation: “End access.” Describe consequences near these actions; do not soften them into ambiguous metaphors.

For access copy, prefer “Approve Complete Portfolio access for 15 days” when confirmed by the deployed policy. Identity checked and email confirmed are different claims. Identity verification does not verify biography, income or compatibility. Ending access cannot retract screenshots, downloads or information already seen. “No public directory” does not mean a shared public Introduction URL cannot be forwarded.

Pilot conversion language must preserve the release's eligibility rules: waitlist registration is not account/product access. Do not replace “Join waitlist” with unrestricted “Create portfolio” unless the actual flow supports it.

## 10. Applications and rollout

`index.html` shows the three concepts, recommended lockup, palette, typographic specimens, graphic motifs, landing composition, sign-in composition, social post, avatar, favicon and app icon. These are clearly identified brand compositions, not live product features. The example person is illustrative.

Recommended implementation sequence after selecting the identity:

1. Confirm the symbol/wordmark direction and perform name/logo clearance separately.
2. Replace visible brand signatures, favicons and metadata through a shared brand component. Inventory emails, social previews, auth/provider surfaces, legal text and support copy.
3. Preserve repository/project identifiers, database values, auth callbacks, theme-storage keys and URLs unless a separate technical migration calls for changing them. Do not silently change legal operator identity.
4. Map brand aliases to surface-specific tokens; keep owner portfolio themes isolated. Ship replacement artwork before any wider style refactor.
5. Verify small icons, logo contrast, keyboard names, light/dark variants, 320–440px layouts, 200% zoom, and actual share-preview rendering. Confirm live access wording and pilot eligibility.

No runtime application files were changed by creating this package. This keeps the creative recommendation concrete and reviewable before adoption.
