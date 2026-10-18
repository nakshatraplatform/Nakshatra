# Onboarding options and feedback ledger

October 17, 2026. Source: `BlueprintForm.tsx`, `blueprint-options.ts`,
`LocationFields.tsx`, form contract/readiness, Account and Dashboard. This is an
inventory and proposal recorded before implementation. The dated increment below
identifies the implemented subset; remaining proposals are not completed work.
Related implementation: `onboarding-foundations.md`.

## Dropdown standard

- One registry of stable stored values and familiar display labels. Reuse it in
  creation, editing, filtering and server validation where the contract applies.
- Empty means unanswered, not a silent default answer. Keep “Prefer not to say”,
  “Not applicable” and “Not sure” distinct; offer them only where meaningful.
- Preserve old saved answers during editing. A label change must not rewrite
  existing data or change eligibility/matching without a reviewed migration.
- Use native selects for short lists; searchable keyboard-accessible choices for
  long lists. Retain a visible label: an icon is not a replacement for the label.
- “Other” reveals a bounded self-description, rather than forcing an invented
  category. Do not discard its text when temporarily changing a selection.
- Sensitive family, religion, community and astrology answers stay optional.
  Do not infer community from surname/religion/location or rank identities.
- Test blank, each value, Other, opt-out, old values, keyboard/touch operation,
  API rejection and save/reload. Country support must match backend references.

## Current controls and proposed standardization

| Section / control | Current source/options | Proposed action (not yet implemented) |
| --- | --- | --- |
| Basics / Gender | Female; Male; Non-binary; Prefer not to say; Other | Keep stable values and opt-out; do not infer eligibility from label |
| Basics / Marital Status | Single; Married; Divorced; Widowed; Separated; Prefer not to say; previous answers retained | Prefer “Never married” as a display label for Single; review whether Married/Awaiting divorce are supported before changing enrollment rules |
| Basics / Height | 4 ft 0 in–7 ft 0 in, in one-inch increments, cm alongside | Keep dual units; review range inclusivity separately rather than silently extending UI beyond SQL |
| Current location / Country | India; United States | Keep only supported countries until canonical reference/provider/API support expands |
| Current location / State | Canonical subdivisions of selected country | Keep dependent country/state relationship; no free-text substitute or automatic geography inference |
| Current location / City | Lookup suggestions or manual entry | Keep manual recovery; no forced external lookup |
| Story / Diet | Vegetarian; Non-vegetarian; Vegan; Flexitarian; Pescatarian; Lacto-ovo vegetarian; Other; Prefer not to say | Review familiar labels (e.g. “Vegetarian, including eggs”) without changing underlying meaning; Other text |
| Story / Alcohol | Never; Occasionally; Socially; Regularly; Prefer not to say | Clarify overlap of Occasionally/Socially with user research; keep optional |
| Story / Tobacco | Never; Former user; Occasionally; Regularly; Prefer not to say | Keep optional, neutral wording |
| Story / Languages | Shared language suggestions, custom entry; maximum 10 | Expand reviewed language coverage; preserve custom scripts and deduplication |
| Story / Interests | Shared activity suggestions/custom entry; maximum 6 | Keep recognizable activities and custom entry; no minimum count |
| Story / Values | Shared value suggestions/custom entry; maximum 5 | Keep optional; no minimum count |
| Work / Highest qualification | High School; Diploma/Associate Degree; Bachelor's; Master's; Professional Specialization; Doctorate; Other; Prefer not to say | Review separating Diploma/Associate and clearer professional qualification labels; Other text |
| Work / Work status | Full-time; Contract; Self-employed; Business; Freelance; Student; Internship; Job search; Career break; Not working; Prefer not to say | Add Part-time subject to approval; use status to tailor profession examples, not require an employer from a student |
| Work / Income currency | INR; USD; CAD; GBP; AUD; EUR; AED; SGD; Other | Show currency names/codes; explicit Other currency; do not silently infer from residence |
| Work / Annual income | Under 25k through 500k+, and Prefer not to say | Current ranges are currency-agnostic; propose currency-specific annual bands (INR lakh labels vs USD etc.) before implementation; never request exact income |
| Work / Visa or residency | Citizen; Permanent resident; generic permits; US H-1B/Green Card/OPT/L-1/I-140; Not applicable; Other; Prefer not to say | Country-aware choices; distinguish immigration status from I-140 petition approval; retain historical data |
| Family / Religion or outlook | Hindu; Muslim; Christian; Sikh; Buddhist; Jain; Jewish; Zoroastrian; No Religion; Spiritual but not religious; Prefer not to say; Other | Keep optional/opt-out, include Other text; review inclusive coverage with users, not a claim of exhaustive classification |
| Family / Community | Regional suggestions in a datalist plus free text | Replace with searchable reviewed choices plus Other self-description, Not applicable and Prefer not to say; current list is not globally representative |
| Family / Sibling position | Oldest; Middle; Youngest; Twin; Only Child | Remove Only Child from new choices (zero siblings conveys it); retain legacy answer and protect rows when reducing count |
| Family / Sibling marital status | Same marital-status registry | Descriptive only; do not apply candidate enrollment policy to relatives |
| Astrology / Moon sign | Existing 12 Rashi keys/labels | Keep stable keys; optional; do not guess from date |
| Astrology / Birth star | Existing 27 Nakshatra names | Keep optional; review familiar aliases/transliterations without duplicating stored values |
| Astrology / Pada | 1–4 | Keep optional; do not require an unknown answer |
| Astrology / Manglik | Yes; No; Partial; Unsure; Not applicable | Keep optional; consider consistent “Not sure” wording |
| Preferences / Age and height minimum/maximum | Age 18–80; same height registry; No minimum/maximum | Keep independent open bounds and ordered ranges; review upper limits separately |
| Preferences / Community preference | Open to all; Specific; Not applicable; Prefer not to say | Keep optional; Specific reveals communities, no automatic restriction or ranking |
| Preferences / Specific communities | Shared community suggestions plus custom entry | Same reviewed taxonomy/Other behavior as own community; preserve old answers |
| Preferences / Horoscope matching | Yes; No; Flexible; Not applicable | Clearer question/labels, e.g. Important / Not important / Open to discussing; review semantic mapping |
| Preferences / Visa statuses | Same visa registry, multiple selections | Same country-aware cleanup as Work; no automatic matching added |
| Future / Marriage timeline | 6–12 months; 1–2 years; Open timeline; Still exploring; Discuss later; Prefer not to say | Keep optional and non-binding; do not treat unanswered as not interested |
| Future / Children | Would like; Would not like; Open/undecided; Discuss later; Prefer not to say | Keep optional and neutral; existing children is a separate question, not inferred |
| Future / Relocation | Open; Stay; Depends on careers/family; Return to India; Discuss later; Prefer not to say | Separate willingness from preferred country/state/city capture; no location-based ranking in this increment |
| Future / Careers | Equal support; Adapt; Pause by mutual choice; Flexible for family; Discuss later; Prefer not to say | Keep optional and gender-neutral |
| Future / Living arrangements | Own home; With family; Near family; Flexible; Discuss later; Prefer not to say | Keep optional and non-binding |
| Future / Family responsibilities | Shared equally; Strengths/availability; Shared family support; Flexible; Discuss later; Prefer not to say | Keep optional and gender-neutral |
| Contact / Who is this? | Self; Father; Mother; Guardian; Sibling; Other | Consider “Me”, “Parent”, “Sibling”, “Guardian”, “Other” labels while preserving values; private contacts only |
| Photos / Visibility | Visible to all; Blurred until shared (current UI) | Explain public vs private preview and primary role, with confirmation before deletion |
| Form section navigation | Seven existing sections | No taxonomy change; forward navigation now validates prior required answers, backward navigation stays available |

Unused exports such as COUNTRY_OPTIONS, WEALTH_STAGE_OPTIONS, FREQUENCY_OPTIONS,
WEDDING_EXPECTATION_OPTIONS, GIFT_EXPECTATION_OPTIONS, PARENT_SUPPORT_OPTIONS and
SECTION_AUDIENCE_OPTIONS are not evidence that those questions appear in onboarding.

## Implementation ledger

“Local” below means changed in the current worktree, not merged or deployed.

| Feedback | Status / boundary |
| --- | --- |
| Spaces in first/middle/last names | Local: preserve spaces during typing and normalized save responses. Unicode/single-name policy remains a separate coordinated UI/API/SQL change |
| Autosave unexpectedly closes editor | Local: routine requested refreshes wait for explicit editor/review exit; stale-revision recovery remains fail-closed |
| Identify missing Basics answers | Local: ordered error summary, field correction links, focus and inline required errors |
| Block Continue and publication | Local: forward Continue, sidebar and mobile navigation validate; final review/publish validate; backend checks remain |
| Preserve incomplete drafts | Local: autosave/Save draft still allow missing required answers; malformed supplied values may still be rejected |
| Misleading 11/11 on every step | Local: Basics-labelled count; optional sections show their own status. Removing address changes checklist to ten checks, not ten fields per section |
| Family/Astrology optional | Preserved; blank answers do not block, invalid supplied values still need correction |
| Remove street address | Local UI/readiness removal plus forward migration; historical addresses retained owner-only; SQL execution/deployment pending |
| Remove narrative minimums | Local UI/API/readiness plus forward SQL; existing 1600/1200/1200 maxima remain |
| Account names from form | Local: own complete self-created saved name parts drive Account display; no Auth/provider identity rewrite; explicit edit link |
| Future DOB | Existing adult/native max-date and server checks retained; future-date SQL regression added |
| Optional previews and final consent | Already in merged base; no forced preview visits restored |
| New Google account welcome state | Pending: distinguish an initialized empty draft from meaningful saved progress |
| Marital status / dropdowns | Local October 17 increment: familiar stable-value labels, Part-time, currency names/INR bands, horoscope/diet wording. Eligibility unchanged; further taxonomy/visa/language review remains |
| Community Other / Only Child | Local: explicit native community select with bounded Other, religion/education/diet/currency Other recovery, legacy values retained; Only Child removed from new choices; populated sibling truncation confirmed |
| Database traffic while editing | Local: two-second idle autosave, local malformed-value suppression, no-op save skip, single in-flight draft save; 800ms coalesced/serialized section progress. Backend atomicity/auth/rate limits unchanged |
| Profession entry | Existing free title + examples; contextual work-status flow pending |
| Story prompts | Current optional questions/examples retained; shorter answers now allowed; broader copy changes pending |
| Photo role/privacy/deletion | Existing limits and ownership safeguards retained; clearer primary selection and delete confirmation/undo pending |
| More mandatory fields per section | Not added. Agree useful field matrix, not arbitrary two-per-section quota; avoid mandatory sensitive answers |
| One private contact | Pending agreement on identity, acceptable phone/email and ownership verification; no extra OTP inferred |
| Global phone/email validation | Existing rules retained; international-format consistency audit still pending |
| Partner location preferences | Pending; saved preferences and actual matching/ranking are distinct features |
| Remove early editor Preview | Pending; optional final-review previews remain |
| Return to Dashboard after publication | Existing successful publish closes editor/review and refreshes Dashboard; retained, not newly invented |
| Liveness success/email | Completion outbox/worker already exist; success-copy and real provider/delivery checks pending, no duplicate sender added |
| Physical iPhone, real OAuth/email, production DB | Not established by mocked Chromium/unit checks; separate verification remains |

No PDF feature, pricing, family-created profile enrollment, production deployment
or broader matching change is included. Design tokens/fonts/portfolio navigation
and layout remain unchanged; validation uses existing surfaces and focus styling.

## October 17 options increment

See [contract, evidence and boundaries](onboarding-options-and-save-efficiency.md).
The table above remains the starting inventory, not a current screen transcript.
Community now uses a labelled native select plus Other, not the proposed new
searchable taxonomy: reuse the bounded existing list without claiming it represents
all Indian/diaspora identities. Existing custom values remain editable. Other
draft text is remembered only during the current editor component session; selected
answers use normal private draft persistence. No new localStorage or schema keys.
Currency changes with a recorded range require consent to clear it; historical
INR ranges remain unchanged until deliberately replaced. Religion/community remain
optional. Country-aware visa changes, language coverage, immigration semantics,
marital eligibility and a broader professionally reviewed taxonomy are deferred.
