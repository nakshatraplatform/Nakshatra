import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  GraduationCap,
  FileText,
  ExternalLink,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { PortfolioNav, type PortfolioSectionLink } from "@/components/portfolio/presentation/PortfolioNav";
import { ChapterHeading, IconDataRow, Pill, ProtectedDataVault, TrustBadge } from "@/components/portfolio/presentation/PortfolioPrimitives";
import { BrandMotif } from "@/components/brand/BrandMotif";
import { formatPortfolioLocation, portfolioHobbies, isPortfolioAudienceLocked } from "@/features/portfolio/presentation";
import { PortfolioFooter } from "./PortfolioFooter";
import { PortfolioBackToTop } from "./PortfolioBackToTop";
import { AdaptivePortfolioGallery, AdaptivePortfolioHero } from "./AdaptivePortfolioMedia";
import { PortfolioNarrative } from "./PortfolioNarrative";
import { PortfolioContactActions } from "./PortfolioContactActions";
import type { PortfolioPhoto } from "@/features/media/portfolio-photo";
import {
  CELESTIAL_THEME_COLORS,
  getCelestialAppearance,
} from "@/features/portfolio/celestial-theme";
import { RASHI_OPTIONS, type PortfolioData, type PortfolioHoroscopeAttachment, type RashiKey } from "@/types/portfolio";

interface CelestialUnionProps {
  data: PortfolioData;
  sunSign: string | null;
  accessMode?: "owner" | "approved" | "public";
  accessExpiresAt?: string;
  identityVerified?: boolean;
  photos?: PortfolioPhoto[];
  horoscopeAttachment?: PortfolioHoroscopeAttachment;
  interestAction?: ReactNode;
  viewingOwnPortfolio?: boolean;
}

interface ChapterDefinition {
  id: string;
  eyebrow: string;
  title: string;
  content: ReactNode;
}

const ZODIAC_SYMBOLS: Record<RashiKey, string> = {
  mesha: "♈︎",
  vrishabha: "♉︎",
  mithuna: "♊︎",
  karka: "♋︎",
  simha: "♌︎",
  kanya: "♍︎",
  tula: "♎︎",
  vrishchika: "♏︎",
  dhanu: "♐︎",
  makara: "♑︎",
  kumbha: "♒︎",
  meena: "♓︎",
};

export default function CelestialUnion({
  data,
  sunSign,
  accessMode = "owner",
  accessExpiresAt,
  identityVerified = false,
  photos = [],
  horoscopeAttachment,
  interestAction,
  viewingOwnPortfolio = false,
}: CelestialUnionProps) {
  const appearance = getCelestialAppearance(data.style);
  const theme = CELESTIAL_THEME_COLORS[appearance];
  const ownerPreview = accessMode === "owner";
  const approvedViewer = accessMode === "approved";
  const hasApprovedAccess = ownerPreview || approvedViewer;
  const privacyMode = data.privacy_mode || "balanced";
  const briefPublicView = !hasApprovedAccess && privacyMode === "private";
  const rashi = normalizeRashi(data.astrology?.rashi || (ownerPreview ? sunSign : null));
  const rashiOption = RASHI_OPTIONS.find((option) => option.key === rashi);
  const heroPhoto = photos.find((photo) => photo.mediaType === "hero");
  const legacyOwnerPhoto: PortfolioPhoto | null =
    ownerPreview && data.personal.photo_url && !heroPhoto
      ? {
          id: "legacy-owner-photo",
          src: data.personal.photo_url,
          alt: `${data.personal.name || "Introduction"} portrait`,
          mediaType: "hero",
          orientation: "unknown",
        }
      : null;
  const heroPhotos = heroPhoto ? [heroPhoto] : legacyOwnerPhoto ? [legacyOwnerPhoto] : [];
  // The primary portrait is part of the portfolio's photo collection as well as
  // its hero. Keep it in the gallery so "all photos" means every authorized
  // portfolio photo, while preserving the hero-first order returned by the API.
  const galleryPhotos = heroPhoto
    ? photos
    : legacyOwnerPhoto
      ? [legacyOwnerPhoto, ...photos]
      : photos;
  const blurredPhotos = photos.filter((photo) => photo.presentation === "blurred");
  const personalVisible = !isPortfolioAudienceLocked(data, "personal", accessMode);
  const shortBio = personalVisible ? clean(data.personal.short_bio) : undefined;
  const profileSummary = personalVisible ? clean(data.personal.profile_summary) : undefined;
  const age = data.personal.age ?? ageFromDate(data.personal.dob);
  const currentLocation = formatPortfolioLocation(data.personal);
  const careerTitle = clean(data.career?.title);
  const educationTitle = clean(data.education?.degree) || clean(data.education?.qualification_level);
  const journeyVisible = !isPortfolioAudienceLocked(data, "journey", accessMode) && (hasApprovedAccess || !isRestricted(data, "journey"));
  const careerVisible = journeyVisible && !isPortfolioAudienceLocked(data, "career", accessMode);
  const lifestyleVisible = !isPortfolioAudienceLocked(data, "lifestyle", accessMode) && (hasApprovedAccess || !isRestricted(data, "lifestyle"));
  const familyVisible = !isPortfolioAudienceLocked(data, "family", accessMode) && (hasApprovedAccess || !isRestricted(data, "family"));
  const astrologyVisible = !isPortfolioAudienceLocked(data, "astrology", accessMode) && (hasApprovedAccess || !isRestricted(data, "astrology"));
  const preferencesVisible = !isPortfolioAudienceLocked(data, "preferences", accessMode) && (hasApprovedAccess || !isRestricted(data, "preferences"));
  const futurePlansVisible = !isPortfolioAudienceLocked(data, "future_plans", accessMode) && (hasApprovedAccess || !isRestricted(data, "future_plans"));
  const visibleRashi = astrologyVisible ? rashi : undefined;
  const hobbies = lifestyleVisible ? portfolioHobbies(data.lifestyle?.hobbies) : [];
  const languages = lifestyleVisible ? splitValues([data.lifestyle?.languages]) : [];
  const values = lifestyleVisible ? splitValues([data.lifestyle?.values_statement]) : [];
  const hasPersonalDetails = personalVisible && hasAny([
    data.personal.gender,
    data.personal.marital_status,
    data.personal.citizenship,
    data.personal.religion,
    data.personal.sub_community,
  ]);
  const hasLifestyle = lifestyleVisible && (
    hobbies.length > 0 ||
    hasAny([
      data.lifestyle?.diet,
      data.lifestyle?.drinking,
      data.lifestyle?.smoking,
    ])
  );
  const hasEducation = journeyVisible && hasAny([
    data.education?.degree,
    data.education?.qualification_level,
    data.education?.institution,
    data.education?.year,
    data.education?.location,
    data.education?.summary,
  ]);
  const hasCareer = careerVisible && hasAny([
    data.career?.title,
    data.career?.company,
    data.career?.location,
    data.career?.summary,
    data.career?.job_type,
    data.career?.career_goals,
  ]);
  const hasVisibleFamily = familyVisible && (hasAny([
    data.family?.public_summary,
    data.family?.paternal_origin,
    data.family?.maternal_origin,
    data.family?.ancestral_origin,
    data.family?.family_spread,
    data.personal.community,
    data.family?.sibling_position,
  ]) || data.family?.sibling_count !== undefined || (hasApprovedAccess && hasDetailedFamily(data)));
  const familyProtected = isPortfolioAudienceLocked(data, "family", accessMode) || isRestricted(data, "family") || isRestricted(data, "family_details");
  const hasVisibleAstrology = astrologyVisible && (Boolean(horoscopeAttachment) || (
      Boolean(visibleRashi)
      || hasAny([
        data.astrology?.nakshatra,
        data.astrology?.pada,
        data.vitals?.gotra,
        data.astrology?.maternal_gotra,
        data.astrology?.manglik_status,
      ])
      || (hasApprovedAccess && hasDetailedAstrology(data))
  ));
  const astrologyProtected = isPortfolioAudienceLocked(data, "astrology", accessMode) || isRestricted(data, "astrology") || isRestricted(data, "astrology_details");
  const hasVisiblePreferences = preferencesVisible && hasAny([
    data.preferences?.narrative,
    data.preferences?.age_range,
    data.preferences?.height_range,
    data.preferences?.lifestyle_expectations,
    data.preferences?.caste_preference,
    data.preferences?.horoscope_preference,
  ]);
  const hasStructuredFuturePlans = hasApprovedAccess && futurePlansVisible && hasAny([
    data.preferences?.marriage_timeline,
    data.preferences?.children_preference,
    data.personal.relocation_preference,
    data.preferences?.career_after_marriage,
    data.preferences?.living_arrangement,
    data.preferences?.family_responsibilities,
  ]);
  const sharedLifeStatement = futurePlansVisible
    ? clean(data.personal.shared_life_plans)
      || clean(data.personal.long_term_goals)
    : undefined;
  const visibleCareerTitle = careerVisible ? careerTitle : undefined;
  const heroLine = [visibleCareerTitle, currentLocation].filter(Boolean).join(", ");
  const contactEntries = isPortfolioAudienceLocked(data, "contact", accessMode) ? [] : normalizedContacts(data.contact);
  const quickFacts = compactPairs([
    ["Moon Sign (Rashi)", visibleRashi && rashiOption ? `${ZODIAC_SYMBOLS[visibleRashi]} ${rashiOption.label}` : undefined],
    ["Age", age ? `${age} years` : undefined],
    ["Height", clean(data.vitals?.height)],
    ["Marital Status", clean(data.personal.marital_status)],
  ]);
  const protectedItems = protectedSectionLabels({
    data,
    blurredPhotos: blurredPhotos.length,
    hasApprovedAccess,
  });
  const contactLocked = !hasApprovedAccess && (isRestricted(data, "contact") || isPortfolioAudienceLocked(data, "contact", accessMode));
  const showProtectedSection = contactLocked || protectedItems.length > 0 || (hasApprovedAccess && contactEntries.length > 0);
  const showInterestSection = Boolean(interestAction);
  const chapters: ChapterDefinition[] = [];

  if (profileSummary || hasPersonalDetails || languages.length > 0 || values.length > 0) {
    chapters.push({
      id: "personal-story",
      eyebrow: `Meet ${firstName(data.personal.name)}`,
      title: "Personal story",
      content: (
        <div className="portfolio-personal-content">
          {!personalVisible && <ProtectedDataVault title="Personal story shared privately" showAction={showInterestSection} />}
          {profileSummary && <PortfolioNarrative text={profileSummary} label="Personal story" />}
          {hasPersonalDetails && (
            <div className="portfolio-detail-grid portfolio-personal-details">
              <DataPair label="Gender" value={genderLabel(data.personal.gender)} />
              <DataPair label="Citizenship" value={clean(data.personal.citizenship)} />
              <DataPair label="Religion or outlook" value={clean(data.personal.religion)} />
              <DataPair label="Sub-community" value={clean(data.personal.sub_community)} />
              <DataPair label="Languages spoken" value={languages.join(", ")} />
            </div>
          )}
          {!hasPersonalDetails && (languages.length > 0 || values.length > 0) && (
            <div className="portfolio-detail-grid portfolio-personal-details">
              <DataPair label="Languages spoken" value={languages.join(", ")} />
            </div>
          )}
          {values.length > 0 && (
            <div className="portfolio-personal-values">
              <DataPair label="Values" value={values.join(", ")} />
            </div>
          )}
        </div>
      ),
    });
  } else if (!personalVisible) {
    chapters.push(protectedChapter("personal-story", "Introduction", "Personal story", "Personal details stay protected.", showInterestSection));
  }

  if (hasEducation || hasCareer || (journeyVisible && clean(data.personal.immigration_status))) {
    chapters.push({
      id: "journey",
      eyebrow: "Journey",
      title: hasEducation && hasCareer
        ? "Education and career"
        : hasEducation
          ? "Education"
          : hasCareer
            ? "Career"
            : "Work and residency",
      content: (
        <div className="portfolio-timeline">
          {hasEducation && (
            <TimelineItem
              icon={<GraduationCap aria-hidden="true" />}
              label="Education"
              title={educationTitle || clean(data.education?.institution) || "Education"}
              meta={joinValues([data.education?.institution, data.education?.year, data.education?.location])}
              detail={clean(data.education?.summary)}
            />
          )}
          {!careerVisible && isPortfolioAudienceLocked(data, "career", accessMode) && <ProtectedDataVault title="Career shared privately" showAction={showInterestSection} />}
          {hasCareer && (
            <>
              <TimelineItem
                icon={<BriefcaseBusiness aria-hidden="true" />}
                label="Today"
                title={careerTitle || clean(data.career?.company) || "Career"}
                meta={joinValues([data.career?.company, data.career?.location, data.career?.job_type])}
                detail={clean(data.career?.summary) || clean(data.career?.career_goals)}
              />
            </>
          )}
          {hasAny([
            data.personal.immigration_status,
            hasApprovedAccess && careerVisible ? data.career?.annual_income : undefined,
            hasApprovedAccess && careerVisible ? data.career?.income_currency : undefined,
          ]) && (
            <div className="portfolio-detail-grid portfolio-timeline-details">
              {journeyVisible && <DataPair label="Visa or residency" value={clean(data.personal.immigration_status)} />}
              {hasApprovedAccess && careerVisible && <DataPair label="Annual income range" value={joinValues([data.career?.annual_income, data.career?.income_currency])} />}
            </div>
          )}
        </div>
      ),
    });
  } else if (!journeyVisible || !careerVisible) {
    chapters.push(protectedChapter(
      "journey",
      "Journey",
      "Education and career",
      "Education and career information exists and may be shared after approval.",
      showInterestSection
    ));
  }

  if (hasLifestyle) {
    chapters.push({
      id: "lifestyle",
      eyebrow: "Everyday life",
      title: "Lifestyle and interests",
      content: (
        <div className="portfolio-lifestyle-groups">
          {hasAny([data.lifestyle?.diet, data.lifestyle?.drinking, data.lifestyle?.smoking]) && (
            <div className="portfolio-detail-grid portfolio-lifestyle-details">
              <DataPair label="Diet" value={clean(data.lifestyle?.diet)} />
              {(hasApprovedAccess || privacyMode === "balanced") && <DataPair label="Drinking" value={clean(data.lifestyle?.drinking)} />}
              {(hasApprovedAccess || privacyMode === "balanced") && <DataPair label="Smoking" value={clean(data.lifestyle?.smoking)} />}
            </div>
          )}
          {hobbies.length > 0 && (
            <div className="portfolio-lifestyle-group">
              <h3>Interests</h3>
              <div className="portfolio-tags">{hobbies.map((value) => <Pill key={value}>{value}</Pill>)}</div>
            </div>
          )}
        </div>
      ),
    });
  }

  if (!lifestyleVisible) {
    chapters.push(protectedChapter("lifestyle", "Everyday life", "Lifestyle and interests", "Lifestyle details stay protected.", showInterestSection));
  }

  if (hasVisibleFamily) {
    chapters.push({
      id: "family",
      eyebrow: "Family and roots",
      title: "Family",
      content: (
        <>
          {clean(data.family?.public_summary) && <PortfolioNarrative text={data.family?.public_summary || ""} label="Family introduction" />}
          <div className="portfolio-detail-grid">
            {hasApprovedAccess && <DataPair label="Father or guardian" value={familyMemberValue(data.family?.father)} />}
            {hasApprovedAccess && <DataPair label="Mother or guardian" value={familyMemberValue(data.family?.mother)} />}
            <DataPair label="Paternal origin" value={clean(data.family?.paternal_origin) || clean(data.family?.ancestral_origin)} />
            <DataPair label="Maternal origin" value={clean(data.family?.maternal_origin)} />
            <DataPair label="Community" value={clean(data.personal.community)} />
            <DataPair label="Family spread" value={clean(data.family?.family_spread)} />
            {hasApprovedAccess && <DataPair label="Parents live in" value={familyLocation(data.family)} />}
            <DataPair label="Number of siblings" value={data.family?.sibling_count !== undefined ? String(data.family.sibling_count) : undefined} />
            <DataPair label="Position among siblings" value={clean(data.family?.sibling_position)} />
            {hasApprovedAccess && data.family?.siblings?.map((sibling, index) => (
              <DataPair key={`${sibling.name || "sibling"}-${index}`} label={`Sibling ${index + 1}`} value={familyMemberValue(sibling)} />
            ))}
          </div>
          {familyProtected && !hasApprovedAccess && (
            <ProtectedInline
              heading="More family details are shared after approval"
              detail={privacyMode === "private"
                ? "Additional family background, names, occupations, and exact locations stay protected."
                : "Names, occupations, and exact family locations stay protected."}
              showAction={showInterestSection}
            />
          )}
        </>
      ),
    });
  } else if (!familyVisible && familyProtected) {
    chapters.push(protectedChapter(
      "family",
      "Family and roots",
      "Family",
      "Family information exists and can be requested after a respectful introduction.",
      showInterestSection
    ));
  }

  if (hasVisibleAstrology) {
    chapters.push({
      id: "astrology",
      eyebrow: "Astrology",
      title: "Cultural alignment",
      content: (
        <>
          <div className="portfolio-astrology-grid">
            <DataPair label="Moon sign (Rashi)" value={rashiOption?.label} />
            <DataPair label="Birth star (Nakshatra)" value={clean(data.astrology?.nakshatra)} />
            <DataPair label="Pada" value={clean(data.astrology?.pada)} />
            {hasApprovedAccess && <DataPair label="Date of birth" value={validDate(data.personal.dob)} />}
            {hasApprovedAccess && <DataPair label="Time of birth" value={clean(data.astrology?.time_of_birth)} />}
            {hasApprovedAccess && <DataPair label="Place of birth" value={clean(data.personal.place_of_birth)} />}
            {hasApprovedAccess && <DataPair label="Lagnam" value={clean(data.astrology?.lagnam)} />}
            <DataPair label="Paternal gothram" value={clean(data.vitals?.gotra)} />
            <DataPair label="Maternal gothram" value={clean(data.astrology?.maternal_gotra)} />
            <DataPair label="Manglik status" value={clean(data.astrology?.manglik_status)} />
          </div>
          {astrologyProtected && !hasApprovedAccess && (
            <ProtectedInline
              heading="More astrology details are shared after approval"
              detail={privacyMode === "private"
                ? "Additional astrology and exact birth details stay protected."
                : "Exact birth date, time, place, and chart stay protected."}
              showAction={showInterestSection}
            />
          )}
          {horoscopeAttachment && (
            <a className="portfolio-horoscope-attachment" href={horoscopeAttachment.href} target="_blank" rel="noreferrer">
              <span className="portfolio-horoscope-icon"><FileText aria-hidden="true" /></span>
              <span className="portfolio-horoscope-copy">
                <strong>Original horoscope</strong>
                <span>
                  {[horoscopeAttachment.formatLabel, horoscopeAttachment.languageLabel, horoscopeAttachment.pageCount ? `${horoscopeAttachment.pageCount} ${horoscopeAttachment.pageCount === 1 ? "page" : "pages"}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <small><LockKeyhole aria-hidden="true" /> Approved access</small>
              </span>
              <span className="portfolio-horoscope-action">View document <ExternalLink aria-hidden="true" /></span>
            </a>
          )}
        </>
      ),
    });
  } else if (!astrologyVisible && astrologyProtected) {
    chapters.push(protectedChapter(
      "astrology",
      "Astrology",
      "Cultural alignment",
      "Astrology information exists and can be shared after approval.",
      showInterestSection
    ));
  }

  if (hasVisiblePreferences) {
    chapters.push({
      id: "preferences",
      eyebrow: "Looking ahead",
      title: "Hopes for a partnership",
      content: (
        <>
          {clean(data.preferences?.narrative) && <PortfolioNarrative text={data.preferences?.narrative || ""} label="Hopes for a partnership" />}
          {hasApprovedAccess && (
            <div className="portfolio-detail-grid portfolio-preference-grid">
              <DataPair label="Preferred age" value={clean(data.preferences?.age_range)} />
              <DataPair label="Preferred height" value={clean(data.preferences?.height_range)} />
              <DataPair label="Visa or residency" value={clean(data.preferences?.visa_preferences)} />
              <DataPair label="Community preference" value={preferenceCommunity(data.preferences)} />
              <DataPair label="Horoscope matching" value={clean(data.preferences?.horoscope_preference)} />
              <DataPair label="Lifestyle expectations" value={clean(data.preferences?.lifestyle_expectations)} />
              <DataPair label="Education expectations" value={clean(data.preferences?.education_expectations)} />
              <DataPair label="Career expectations" value={clean(data.preferences?.career_expectations)} />
            </div>
          )}
        </>
      ),
    });
  }

  if (!preferencesVisible) {
    chapters.push(protectedChapter("preferences", "Looking ahead", "Hopes for a partnership", "Preferences stay protected.", showInterestSection));
  }

  if (hasStructuredFuturePlans) {
    chapters.push({
      id: "future-plans",
      eyebrow: "Important conversations",
      title: "Future plans",
      content: (
        <div className="portfolio-detail-grid">
          <DataPair label="Marriage timeline" value={clean(data.preferences?.marriage_timeline)} />
          <DataPair label="Children" value={clean(data.preferences?.children_preference)} />
          <DataPair label="Relocation" value={clean(data.personal.relocation_preference)} />
          <DataPair label="Supporting both careers" value={clean(data.preferences?.career_after_marriage)} />
          <DataPair label="Living arrangement" value={clean(data.preferences?.living_arrangement)} />
          <DataPair label="Family responsibilities" value={clean(data.preferences?.family_responsibilities)} />
        </div>
      ),
    });
  }

  if (sharedLifeStatement) {
    chapters.push({
      id: "shared-life",
      eyebrow: "Shared future",
      title: "The life I hope to build",
      content: hasApprovedAccess && clean(data.personal.long_term_goals) && clean(data.personal.shared_life_plans)
        ? (
            <div className="portfolio-personal-content">
              <div><h3>Life direction</h3><PortfolioNarrative text={data.personal.long_term_goals || ""} label="Life direction" /></div>
              <div><h3>What I hope to share</h3><PortfolioNarrative text={data.personal.shared_life_plans || ""} label="What I hope to share" /></div>
            </div>
          )
        : <PortfolioNarrative text={sharedLifeStatement} label="Shared future" />,
    });
  }

  const chapterOrder = [
    "personal-story",
    "astrology",
    "journey",
    "lifestyle",
    "family",
    "preferences",
    "future-plans",
    "shared-life",
  ];
  const numberedChapters = chapterOrder
    .map((id) => chapters.find((chapter) => chapter.id === id))
    .filter((chapter): chapter is ChapterDefinition => Boolean(chapter))
    .map((chapter, index) => ({
      ...chapter,
      number: index + 1,
    }));
  const astrologyChapter = numberedChapters.find((chapter) => chapter.id === "astrology");
  const pairedChapterIds = new Set(["journey", "lifestyle", "family"]);
  const firstStandardChapter = numberedChapters.find((chapter) => chapter.id !== "astrology");
  const pairedChapterRows = [
    ["journey", "lifestyle"],
    ["family"],
  ].map((row) => row
    .map((id) => numberedChapters.find((chapter) => chapter.id === id))
    .filter((chapter): chapter is typeof numberedChapters[number] => chapter !== undefined && chapter.id !== firstStandardChapter?.id)
  ).filter((row) => row.length > 0);
  const trailingChapters = numberedChapters.filter(
    (chapter) => chapter.id !== firstStandardChapter?.id
      && chapter.id !== "astrology"
      && !pairedChapterIds.has(chapter.id)
  );
  const firstFullChapter = numberedChapters.find((chapter) => chapter.id !== "astrology");
  const briefOverviewAvailable = Boolean(
    (journeyVisible && educationTitle) || visibleCareerTitle || languages.length || (lifestyleVisible && clean(data.lifestyle?.diet))
    || hobbies.length || values.length || (familyVisible && clean(data.family?.public_summary))
    || (preferencesVisible && clean(data.preferences?.narrative))
  );
  const navigationSections: PortfolioSectionLink[] = [{ href: "#main-content", label: "Overview" }];
  if (galleryPhotos.length || data.visibility?.gallery === "restricted") navigationSections.push({ href: "#portfolio-gallery-title", label: "Gallery" });
  if (astrologyChapter) navigationSections.push({ href: "#astrology", label: "Astrology" });
  if (briefPublicView) {
    if (briefOverviewAvailable) navigationSections.push({ href: "#portfolio-profile", label: "About" });
  } else {
    for (const [id, label] of [["journey", "Education & work"], ["family", "Family"]]) {
      if (numberedChapters.some(chapter => chapter.id === id)) navigationSections.push({ href: `#${id}`, label });
    }
  }
  const remainingFullChapters = numberedChapters.filter(
    (chapter) => chapter.id !== firstFullChapter?.id && chapter.id !== "astrology"
  );
  const astrologySection = astrologyChapter ? (
    <div className="portfolio-chapters portfolio-astrology-chapter">
      <Chapter {...astrologyChapter} />
    </div>
  ) : null;
  const briefAstrologySection = briefPublicView && astrologyChapter ? (
    <div className="portfolio-chapters portfolio-astrology-chapter">
      <Chapter
        {...protectedChapter(
          "astrology",
          "Astrology",
          "Cultural alignment",
          "Astrology information exists and can be shared after approval.",
          showInterestSection
        )}
        number={astrologyChapter.number}
      />
    </div>
  ) : null;

  const variables = {
    "--portfolio-background": theme.background,
    "--portfolio-surface": theme.surface,
    "--portfolio-surface-soft": theme.surfaceSoft,
    "--portfolio-foreground": theme.ink,
    "--portfolio-muted": theme.muted,
    "--portfolio-primary": theme.primary,
    "--portfolio-teal": theme.teal,
    "--portfolio-gold": theme.gold,
    "--portfolio-border": theme.border,
  } as CSSProperties;

  const gallery = data.visibility?.gallery === "restricted" && !hasApprovedAccess
    ? <section className="portfolio-gallery" aria-labelledby="portfolio-gallery-title">
        <ChapterHeading eyebrow="Captured moments" title="Gallery" id="portfolio-gallery-title" />
        <ProtectedDataVault title="Photos shared after approval" detail="Protected photos stay private until access is approved." showAction={showInterestSection} />
      </section>
    : <AdaptivePortfolioGallery photos={galleryPhotos} />;

  return (
    <div
      data-template="celestial-union"
      data-appearance={appearance}
      data-privacy-mode={privacyMode}
      data-access-mode={accessMode}
      id="portfolio-top"
      className="portfolio-root"
      style={variables}
    >
      <PortfolioNav sections={navigationSections} showInterest={showInterestSection} appearance={appearance} />

      {approvedViewer && (
        <aside className="portfolio-access-context" aria-label="Protected access details">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>Protected access</strong>
            <span>
              Shared with your signed-in account by the introduction owner
              {accessExpiresAt ? ` · Expires ${formatAccessExpiry(accessExpiresAt)}` : ""}
            </span>
          </div>
        </aside>
      )}
      <main id="main-content" className="portfolio-main" tabIndex={-1}>
        <section className="portfolio-hero" aria-labelledby="portfolio-name">
          <div className="portfolio-photo-stage">
            <div className="portfolio-portrait-artwork" aria-hidden="true">
              <BrandMotif />
              <span className="portfolio-orbit portfolio-orbit-one" />
              <span className="portfolio-orbit portfolio-orbit-two" />
            </div>
            <div className="portfolio-primary-photo">
              <AdaptivePortfolioHero photos={heroPhotos} fallbackColor={theme.surfaceSoft} />
            </div>
          </div>
          <div className="portfolio-hero-copy">
            <p className="portfolio-eyebrow">Marriage introduction</p>
            <div className="portfolio-name-row">
              <h1 id="portfolio-name">{clean(data.personal.name) || "Marriage introduction"}</h1>
              {identityVerified && <TrustBadge />}
            </div>
            {heroLine && <p className="portfolio-hero-line">{heroLine}</p>}
            {shortBio && <p className="portfolio-hero-summary">{shortBio}</p>}
          </div>
        </section>

        {quickFacts.length > 0 && (
          <section className="portfolio-quick-facts" aria-label="At a glance">
            {quickFacts.map(([label, value]) => <DataPair key={label} label={label} value={value} />)}
          </section>
        )}

        {briefPublicView ? (
          <>
            <BriefIntroduction
              name={data.personal.name}
              education={journeyVisible ? educationTitle : undefined}
              career={visibleCareerTitle}
              interests={hobbies}
              values={values}
              languages={languages}
              diet={lifestyleVisible ? clean(data.lifestyle?.diet) : undefined}
              familyIntroduction={familyVisible ? clean(data.family?.public_summary) : undefined}
              partnershipIntroduction={preferencesVisible ? clean(data.preferences?.narrative) : undefined}
            />
            {gallery}
            {briefAstrologySection}
          </>
        ) : hasApprovedAccess ? (
          <>
            {firstFullChapter && (
              <div id="portfolio-profile" className="portfolio-chapters portfolio-full-chapters">
                <Chapter {...firstFullChapter} />
              </div>
            )}
            {gallery}
            {astrologySection}
            {remainingFullChapters.length > 0 && (
              <div className="portfolio-chapters portfolio-full-chapters">
                {remainingFullChapters.map((chapter) => <Chapter key={chapter.id} {...chapter} />)}
              </div>
            )}
          </>
        ) : (
          <>
            {firstStandardChapter && (
              <div id="portfolio-profile" className="portfolio-chapters">
                <Chapter {...firstStandardChapter} />
              </div>
            )}
            {gallery}
            {astrologySection}
            {pairedChapterRows.length > 0 && (
              <div className="portfolio-chapters">
                <div className="portfolio-chapter-pairs">
                  {pairedChapterRows.map((row) => (
                    <div key={row.map((chapter) => chapter.id).join("-")} className="portfolio-chapter-pair" data-chapter-count={row.length}>
                      {row.map((chapter) => <Chapter key={chapter.id} {...chapter} />)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!briefPublicView && !hasApprovedAccess && trailingChapters.length > 0 && (
          <div className="portfolio-chapters portfolio-chapters-trailing">
            {trailingChapters.map((chapter) => <Chapter key={chapter.id} {...chapter} />)}
          </div>
        )}

        {(showProtectedSection || showInterestSection) && (
          <section id="portfolio-interest" className="portfolio-protected-section">
            <div className="portfolio-protected-copy">
              <p className="portfolio-eyebrow">Respectful access</p>
              <h2>{ownerPreview ? "Protected information preview" : approvedViewer ? "Contact shared by the introduction owner" : "More can be shared after approval."}</h2>
              <p>
                {ownerPreview
                  ? "These details are visible only in the authenticated owner view."
                  : approvedViewer
                    ? "These contact details became visible when the introduction owner approved your request."
                    : `Tap Show interest and confirm your email. ${firstName(data.personal.name)} decides whether to share the details below.`}
              </p>
            </div>
            {protectedItems.length > 0 && (
              <div className="portfolio-protected-summary">
                <div className="portfolio-protected-items" aria-label="Protected information available">
                  {protectedItems.map((item) => <span key={item}><LockKeyhole aria-hidden="true" />{item}</span>)}
                </div>
                {!hasApprovedAccess && (
                  <p className="portfolio-protected-clarifier">One approved request shares everything listed above for up to 15 days.</p>
                )}
              </div>
            )}
            {contactLocked && <ProtectedDataVault title="Contact shared after approval" detail="Phone numbers and email addresses stay protected." />}
            {hasApprovedAccess && contactEntries.length > 0 ? (
              <div className="portfolio-contact-list">
                {contactEntries.map((contact, index) => (
                  <div key={`${contact.name}-${index}`}>
                    <strong>{contact.name}{contact.relationship ? ` · ${contact.relationship}` : ""}</strong>
                    <PortfolioContactActions phone={contact.phone} email={contact.email} />
                  </div>
                ))}
              </div>
            ) : !hasApprovedAccess && interestAction ? (
              interestAction
            ) : null}
          </section>
        )}

        {!ownerPreview && !viewingOwnPortfolio && (
          <aside className="portfolio-creator-cta" aria-labelledby="portfolio-creator-cta-title">
            <div>
              <p className="portfolio-eyebrow">Make an introduction of your own</p>
              <h2 id="portfolio-creator-cta-title">Want an introduction like this?</h2>
              <p>Create yours privately. Share it when you’re ready, and keep private details behind your approval.</p>
            </div>
            <a href="/signup">
              Create your introduction
              <ArrowRight aria-hidden="true" />
            </a>
          </aside>
        )}
      </main>

      <PortfolioFooter livenessChecked={identityVerified} appearance={appearance} />
      <PortfolioBackToTop />
    </div>
  );
}

function BriefIntroduction({
  name,
  education,
  career,
  interests,
  values,
  languages,
  diet,
  familyIntroduction,
  partnershipIntroduction,
}: {
  name?: string;
  education?: string;
  career?: string;
  interests: string[];
  values: string[];
  languages: string[];
  diet?: string;
  familyIntroduction?: string;
  partnershipIntroduction?: string;
}) {
  const facts = compactPairs([
    ["Education", education],
    ["Career", career],
    ["Languages", languages.slice(0, 3).join(", ")],
    ["Diet", diet],
  ]);
  const tags = Array.from(new Set([...interests, ...values])).slice(0, 5);
  if (!facts.length && !tags.length && !familyIntroduction && !partnershipIntroduction) return null;

  return (
    <section id="portfolio-profile" className="portfolio-short-overview" aria-labelledby="short-overview-title" tabIndex={-1}>
      <ChapterHeading eyebrow="A quick introduction" title={`A little more about ${firstName(name)}`} id="short-overview-title" />
      {facts.length > 0 && (
        <div className="portfolio-detail-grid">
          {facts.map(([label, value]) => <DataPair key={label} label={label} value={value} />)}
        </div>
      )}
      {tags.length > 0 && <div className="portfolio-tags">{tags.map((value) => <Pill key={value}>{value}</Pill>)}</div>}
      {familyIntroduction && <div><h3>Family introduction</h3><PortfolioNarrative text={familyIntroduction} label="Family introduction" /></div>}
      {partnershipIntroduction && <div><h3>Hopes for a partnership</h3><PortfolioNarrative text={partnershipIntroduction} label="Hopes for a partnership" /></div>}
    </section>
  );
}

function Chapter({ number, id, eyebrow, title, content }: ChapterDefinition & { number: number }) {
  return (
    <section id={id} className="portfolio-chapter" aria-labelledby={`${id}-title`} tabIndex={-1}>
      <ChapterHeading number={number} eyebrow={eyebrow} title={title} id={`${id}-title`} />
      <div className="portfolio-chapter-content">{content}</div>
    </section>
  );
}

function TimelineItem({ icon, label, title, meta, detail }: { icon: ReactNode; label: string; title: string; meta?: string; detail?: string }) {
  return (
    <IconDataRow icon={icon} label={label} title={title} subtitle={meta}>
      {detail && <PortfolioNarrative text={detail} label={label} className="portfolio-section-copy" />}
    </IconDataRow>
  );
}

function ProtectedInline({ heading, detail, showAction }: { heading: string; detail: string; showAction: boolean }) {
  return (
    <ProtectedDataVault title={heading} detail={detail} showAction={showAction} />
  );
}

function DataPair({ label, value }: { label: string; value?: string | null }) {
  const meaningfulValue = clean(value);
  if (!meaningfulValue) return null;
  return <div className="portfolio-data-pair"><span>{label}</span><strong>{meaningfulValue}</strong></div>;
}

function protectedChapter(id: string, eyebrow: string, title: string, message: string, showAction = false): ChapterDefinition {
  return {
    id,
    eyebrow,
    title,
    content: <ProtectedDataVault title={`${title} shared after approval`} detail={message} showAction={showAction} />,
  };
}

function protectedSectionLabels({
  data,
  blurredPhotos,
  hasApprovedAccess,
}: {
  data: PortfolioData;
  blurredPhotos: number;
  hasApprovedAccess: boolean;
}) {
  if (hasApprovedAccess) return [];
  const labels: string[] = [];
  if (isRestricted(data, "journey")) labels.push("Education and career details");
  if (isRestricted(data, "lifestyle")) labels.push("Lifestyle details");
  if (isRestricted(data, "family") || isRestricted(data, "family_details")) labels.push("Family details");
  if (isRestricted(data, "astrology") || isRestricted(data, "astrology_details")) labels.push("Astrology details");
  if (isRestricted(data, "preferences")) labels.push("Partner preferences");
  if (isRestricted(data, "future_plans")) labels.push("Shared-life plans");
  if (blurredPhotos > 0) labels.push(`${blurredPhotos} protected ${blurredPhotos === 1 ? "photo" : "photos"}`);
  if (isRestricted(data, "contact")) labels.push("Direct contact");
  return Array.from(new Set(labels));
}

function normalizeRashi(value?: string | null): RashiKey | undefined {
  return RASHI_OPTIONS.some((option) => option.key === value) ? value as RashiKey : undefined;
}

function isRestricted(data: PortfolioData, key: keyof NonNullable<PortfolioData["visibility"]>) {
  return data.visibility?.[key] === "restricted";
}

function compactPairs(values: Array<[string, string | undefined]>): Array<[string, string]> {
  return values.filter((pair): pair is [string, string] => Boolean(clean(pair[1])));
}

function splitValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.flatMap((value) => clean(value)?.split(/[,;\n]/) ?? []).map((value) => value.trim()).filter(Boolean)));
}

function joinValues(values: Array<string | null | undefined>) {
  const populated = values.map(clean).filter((value): value is string => Boolean(value));
  return populated.length ? populated.join(" · ") : undefined;
}

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function hasAny(values: Array<string | null | undefined>) {
  return values.some((value) => Boolean(clean(value)));
}

function firstName(value?: string) {
  return clean(value)?.split(/\s+/)[0] || "this profile";
}

function genderLabel(value?: PortfolioData["personal"]["gender"]) {
  if (!value || value === "prefer_not_to_say") return undefined;
  if (value === "non_binary") return "Non-binary";
  if (value === "other") return "Other";
  return value === "male" ? "Male" : "Female";
}

function preferenceCommunity(preferences?: PortfolioData["preferences"]) {
  const choice = clean(preferences?.caste_preference);
  if (!choice) return undefined;
  if (choice === "open") return "Open to all communities";
  if (choice === "not_applicable") return "Not applicable";
  if (choice === "prefer_not_to_say") return "Prefer not to say";
  if (choice === "specific") return clean(preferences?.specific_communities) || "Open to specific communities";
  return choice;
}

function ageFromDate(value?: string) {
  if (!value) return undefined;
  const birth = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return undefined;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  if (today.getUTCMonth() < birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age >= 18 && age <= 120 ? age : undefined;
}

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return undefined;
  return value;
}

function formatAccessExpiry(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "soon";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function familyMemberValue(member?: { name?: string; occupation?: string; location?: string; marital_status?: string }) {
  if (!clean(member?.name)) return undefined;
  return joinValues([member?.name, member?.occupation, member?.location, member?.marital_status]);
}

function familyLocation(family?: PortfolioData["family"]) {
  return joinValues([family?.current_city, family?.current_region, family?.current_country])
    || clean(family?.parents_location)
    || clean(family?.current_settlement);
}

function hasDetailedFamily(data: PortfolioData) {
  return Boolean(
    clean(data.family?.father?.name)
    || clean(data.family?.mother?.name)
    || data.family?.siblings?.some((sibling) => hasAny([sibling.name, sibling.occupation, sibling.location]))
    || clean(data.family?.parents_location)
    || clean(data.family?.family_note)
  );
}

function hasDetailedAstrology(data: PortfolioData) {
  return hasAny([
    data.personal.dob,
    data.astrology?.time_of_birth,
    data.personal.place_of_birth,
    data.astrology?.lagnam,
  ]);
}

function normalizedContacts(contact?: PortfolioData["contact"]) {
  if (contact?.contacts?.length) return contact.contacts.filter((item) => clean(item.name) && (clean(item.phone) || clean(item.email)));
  if (clean(contact?.contact_person) && (clean(contact?.phone) || clean(contact?.email))) {
    return [{ relationship: "", name: contact?.contact_person, phone: contact?.phone, email: contact?.email }];
  }
  return [];
}
