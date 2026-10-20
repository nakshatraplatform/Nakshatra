"use client";

import { useEffect, useId, useState, type ComponentProps, type HTMLInputTypeAttribute, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
} from "lucide-react";
import { LocationFields, type LocationValue } from "@/components/portfolio/LocationFields";
import { PhoneNumberField } from "@/components/portfolio/PhoneNumberField";
import { PortfolioAnswer, PortfolioFieldValidation, usePortfolioFieldError } from "@/components/portfolio/PortfolioFieldValidation";
import { portfolioFieldAnchor, type EditorFieldIssue } from "@/features/portfolio/editor-validation";
import { CELESTIAL_THEME_COLORS } from "@/features/portfolio/celestial-theme";
import { CELESTIAL_UNION_TEMPLATE_NAME } from "@/features/portfolio/template";
import { calculatePortfolioCompletion } from "@/features/portfolio/readiness";
import { formListValues, latestAdultBirthDate, NAME_PART_MAX_LENGTH, NAME_PART_PATTERN } from "@/features/portfolio/form-contract";
import {
  composePortfolioName,
  resolvePortfolioNameParts,
} from "@/features/portfolio/name";
import {
  AGE_OPTIONS,
  CAREER_AFTER_MARRIAGE_OPTIONS,
  CASTE_PREFERENCE_OPTIONS,
  CHILDREN_OPTIONS,
  COMMUNITY_OPTIONS,
  CURRENCY_OPTIONS,
  DIET_OPTIONS,
  ALCOHOL_USE_OPTIONS,
  TOBACCO_USE_OPTIONS,
  GENDER_OPTIONS,
  FAMILY_RESPONSIBILITY_OPTIONS,
  HEIGHT_OPTIONS,
  HOBBY_OPTIONS,
  HOROSCOPE_PREFERENCE_OPTIONS,
  incomeRangeOptions,
  JOB_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  LIVING_ARRANGEMENT_OPTIONS,
  MANGLIK_OPTIONS,
  MARRIAGE_TIMELINE_OPTIONS,
  NAKSHATRA_OPTIONS,
  QUALIFICATION_OPTIONS,
  RELOCATION_OPTIONS,
  RELIGION_OPTIONS,
  SIBLING_POSITION_OPTIONS,
  VALUE_OPTIONS,
  VISA_OPTIONS,
  withLegacyMaritalStatus,
  type BlueprintOption,
} from "@/features/portfolio/blueprint-options";
import { RASHI_OPTIONS, type PortfolioData } from "@/types/portfolio";

type UpdatePortfolioSection = <K extends keyof PortfolioData>(
  key: K,
  value: PortfolioData[K]
) => void;

export type PortfolioEditorSection =
  | "foundation"
  | "story"
  | "work"
  | "family"
  | "lifestyle"
  | "preferences"
  | "future"
  | "astrology"
  | "privacy";

export const PORTFOLIO_EDITOR_SECTIONS: Array<{ id: PortfolioEditorSection; label: string; optional?: boolean; time: string }> = [
  { id: "foundation", label: "Basics", time: "3 min" },
  { id: "story", label: "Personal story & lifestyle", optional: true, time: "4 min" },
  { id: "work", label: "Education & work", optional: true, time: "3 min" },
  { id: "family", label: "Family", optional: true, time: "4 min" },
  { id: "astrology", label: "Astrology & horoscope", optional: true, time: "3 min" },
  { id: "preferences", label: "Match & future", optional: true, time: "4 min" },
  { id: "privacy", label: "Appearance & contact", time: "2 min" },
];

export function navigableSection(section: PortfolioEditorSection): PortfolioEditorSection {
  if (section === "lifestyle") return "story";
  if (section === "future") return "preferences";
  return PORTFOLIO_EDITOR_SECTIONS.some((item) => item.id === section) ? section : "foundation";
}

export function PortfolioMobileSectionNav({ activeSection, completedCount, totalCount, onSectionChange }: {
  activeSection: PortfolioEditorSection;
  completedCount: number;
  totalCount: number;
  onSectionChange: (section: PortfolioEditorSection) => void;
}) {
  const activeIndex = PORTFOLIO_EDITOR_SECTIONS.findIndex((section) => section.id === activeSection);
  return <div className="biodata-editor-mobile-nav flex-none rounded-xl p-4 lg:hidden">
    <div className="mb-2 flex items-center justify-between gap-4 text-sm">
      <strong className="text-[color:var(--workspace-ink)]">Section {activeIndex + 1} of {PORTFOLIO_EDITOR_SECTIONS.length}</strong>
      <span className="text-[color:var(--workspace-ink-muted)]">{activeSection === "foundation"
        ? `Basics: ${completedCount} of ${totalCount} checks`
        : PORTFOLIO_EDITOR_SECTIONS[activeIndex]?.optional ? "Optional section" : "Your settings"}</span>
    </div>
    <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[color:var(--workspace-border)]" role="progressbar" aria-label="Current form section" aria-valuemin={1} aria-valuemax={PORTFOLIO_EDITOR_SECTIONS.length} aria-valuenow={activeIndex + 1} aria-valuetext={`Section ${activeIndex + 1} of ${PORTFOLIO_EDITOR_SECTIONS.length}`}>
      <span className="block h-full rounded-full bg-[color:var(--workspace-teal)]" style={{ width: `${((activeIndex + 1) / PORTFOLIO_EDITOR_SECTIONS.length) * 100}%` }} />
    </div>
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-end gap-2">
      <button type="button" aria-label="Previous section" disabled={activeIndex === 0} onClick={() => onSectionChange(PORTFOLIO_EDITOR_SECTIONS[activeIndex - 1].id)} className="workspace-focus flex h-11 items-center justify-center rounded-lg border border-[color:var(--workspace-border)] bg-[var(--workspace-surface)] text-[color:var(--workspace-ink)] disabled:opacity-35"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></button>
      <label className="grid gap-2 text-sm font-semibold text-[color:var(--workspace-ink)]"><span className="sr-only">Go to section</span>
        <select aria-label="Go to introduction section" value={activeSection} onChange={(event) => onSectionChange(event.target.value as PortfolioEditorSection)} className="biodata-field min-h-11">
          {PORTFOLIO_EDITOR_SECTIONS.map((section, index) => <option key={section.id} value={section.id}>{index + 1}. {section.label}{section.optional ? " (optional)" : ""}</option>)}
        </select>
      </label>
      <button type="button" aria-label="Next section" disabled={activeIndex === PORTFOLIO_EDITOR_SECTIONS.length - 1} onClick={() => onSectionChange(PORTFOLIO_EDITOR_SECTIONS[activeIndex + 1].id)} className="workspace-focus flex h-11 items-center justify-center rounded-lg border border-[color:var(--workspace-border)] bg-[var(--workspace-surface)] text-[color:var(--workspace-ink)] disabled:opacity-35"><ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
    </div>
  </div>;
}

const RASHI_SELECT_OPTIONS: BlueprintOption[] = [
  { value: "", label: "Select moon sign" },
  ...RASHI_OPTIONS.map((rashi) => ({ value: rashi.key, label: rashi.label })),
];

const PADA_OPTIONS: BlueprintOption[] = [
  { value: "", label: "Select pada" },
  { value: "1", label: "Pada 1" },
  { value: "2", label: "Pada 2" },
  { value: "3", label: "Pada 3" },
  { value: "4", label: "Pada 4" },
];

const CONTACT_RELATIONSHIPS: BlueprintOption[] = [
  { value: "self", label: "Me" },
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "guardian", label: "Guardian" },
  { value: "sibling", label: "Sibling" },
  { value: "other", label: "Other" },
];

export function BlueprintForm({
  data,
  onUpdate,
  photoManager,
  horoscopeManager,
  hasShareablePrimaryPhoto = false,
  activeSection: controlledSection,
  initialSection = "foundation",
  onSectionChange,
  validationIssues = [],
  onErrorSelect,
}: {
  data: PortfolioData;
  onUpdate: UpdatePortfolioSection;
  photoManager?: ReactNode;
  horoscopeManager?: ReactNode;
  hasShareablePrimaryPhoto?: boolean;
  activeSection?: PortfolioEditorSection;
  initialSection?: PortfolioEditorSection;
  onSectionChange?: (section: PortfolioEditorSection) => void;
  validationIssues?: EditorFieldIssue[];
  onErrorSelect?: (issue: EditorFieldIssue) => void;
}) {
  const [internalSection, setInternalSection] = useState<PortfolioEditorSection>(() => navigableSection(initialSection));
  // Session-only recovery for Other answers; no additional persisted profile keys.
  const [otherAnswers, setOtherAnswers] = useState<Record<string, { text: string; active: boolean }>>({});
  const otherAnswer = (fieldPath: string) => ({
    memory: otherAnswers[fieldPath],
    onRemember: (memory: { text: string; active: boolean }) => setOtherAnswers(current => ({ ...current, [fieldPath]: memory })),
  });
  const activeSection = controlledSection ?? internalSection;
  const activeIndex = PORTFOLIO_EDITOR_SECTIONS.findIndex((section) => section.id === activeSection);
  const resolvedNameParts = resolvePortfolioNameParts(data.personal);
  // Normalize for persistence, not on each keystroke: trimming an in-progress
  // trailing space makes a two-word name impossible to type naturally.
  const nameParts = {
    first_name: data.personal.first_name ?? resolvedNameParts.first_name,
    middle_name: data.personal.middle_name ?? resolvedNameParts.middle_name,
    last_name: data.personal.last_name ?? resolvedNameParts.last_name,
  };
  const completion = calculatePortfolioCompletion(data, hasShareablePrimaryPhoto);
  const contacts = data.contact?.contacts?.length
    ? data.contact.contacts
    : data.contact?.contact_person || data.contact?.phone || data.contact?.email
      ? [{
          relationship: "self",
          name: data.contact.contact_person,
          phone: data.contact.phone,
          email: data.contact.email,
        }]
      : [];

  function updatePersonal(changes: Partial<PortfolioData["personal"]>) {
    const next = { ...data.personal, profile_for: data.personal.profile_for || "self", ...changes };
    if ("country" in changes || "region" in changes || "city" in changes) {
      next.current_location = [next.city, next.region, next.country].filter(Boolean).join(", ");
    }
    onUpdate("personal", next);
  }

  function updateNamePart(
    key: "first_name" | "middle_name" | "last_name",
    value: string
  ) {
    const nextParts = { ...nameParts, [key]: value };
    updatePersonal({ ...nextParts, name: composePortfolioName(nextParts) });
  }

  function updateResidence(changes: LocationValue) {
    updatePersonal({
      ...("country" in changes && { country: changes.country }),
      ...("countryCode" in changes && { country_code: changes.countryCode }),
      ...("region" in changes && { region: changes.region }),
      ...("regionCode" in changes && { region_code: changes.regionCode }),
      ...("city" in changes && { city: changes.city }),
      ...("cityGeonameId" in changes && { city_geoname_id: changes.cityGeonameId }),
      ...("postalCode" in changes && { postal_code: changes.postalCode }),
      ...("locationSource" in changes && {
        location_source: changes.locationSource,
      }),
    });
  }

  function updateFamily(changes: Partial<NonNullable<PortfolioData["family"]>>) {
    onUpdate("family", { ...(data.family || {}), ...changes });
  }

  function setSiblingCount(rawValue: string) {
    const count = Math.min(10, Math.max(0, Number(rawValue) || 0));
    const previous = data.family?.siblings || [];
    if (previous.slice(count).some(sibling => Object.values(sibling).some(value => Boolean(value?.trim())))
      && !window.confirm("Reducing this number removes the extra sibling details. Continue?")) return;
    const siblings = Array.from({ length: count }, (_, index) => previous[index] || {});
    updateFamily({ sibling_count: count, siblings });
  }

  function updateIncomeCurrency(value: string) {
    const income = data.career?.annual_income;
    const changesMeaning = value !== (data.career?.income_currency || "") && Boolean(income && income !== "Prefer not to say");
    if (changesMeaning && !window.confirm("Changing currency clears the current income range so it is not misrepresented. Continue?")) return false;
    onUpdate("career", { ...(data.career || {}), income_currency: value, ...(changesMeaning && { annual_income: "" }) });
    return true;
  }

  function updateSibling(index: number, changes: Record<string, string>) {
    const siblings = [...(data.family?.siblings || [])];
    siblings[index] = { ...(siblings[index] || {}), ...changes };
    updateFamily({ siblings });
  }

  function updateContacts(nextContacts: typeof contacts) {
    onUpdate("contact", { ...(data.contact || {}), contacts: nextContacts });
  }

  function setAppearance(appearance: "light" | "dark") {
    onUpdate("style", {
      ...(data.style || {}),
      appearance,
      template_name: CELESTIAL_UNION_TEMPLATE_NAME,
      theme_color: CELESTIAL_THEME_COLORS[appearance].background,
    });
  }

  function goTo(section: PortfolioEditorSection) {
    setInternalSection(section);
    onSectionChange?.(section);
    // Controlled editors own their scroll container. scrollIntoView can also
    // scroll hidden dialog ancestors, moving the header/footer off screen.
    if (onSectionChange) return;
    const stage = document.getElementById("blueprint-stage");
    if (stage && typeof stage.scrollIntoView === "function") {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      stage.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    }
  }

  return (
    <PortfolioFieldValidation issues={validationIssues}>
    <div className="biodata-editor grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden lg:sticky lg:top-0 lg:block lg:self-start">
        <div className="biodata-editor-sidebar rounded-2xl p-4">
          <div className="biodata-editor-progress mb-4 rounded-xl p-4">
            <p className="text-sm font-semibold text-[color:var(--workspace-teal)]">
              {completion.readyToPublish ? "Ready to review" : completion.missing.length ? "Complete required details" : "Review entered answers"}
            </p>
            <p className="mt-2 text-sm leading-5 text-[color:var(--workspace-ink-muted)]">
              {completion.readyToPublish
                ? "Recommended fields can be finished now or later."
                : completion.missing.length
                  ? `Basics: ${completion.completedCount} of ${completion.totalCount} checks complete`
                  : completion.invalidAnswers[0]?.label}
            </p>
          </div>
          <nav aria-label="Introduction form sections" className="space-y-2">
            {PORTFOLIO_EDITOR_SECTIONS.map((section, index) => {
              const selected = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={selected ? "step" : undefined}
                  onClick={() => goTo(section.id)}
                  className={`workspace-focus flex min-h-12 w-full items-center gap-4 rounded-xl px-4 py-2 text-left transition-[transform,box-shadow,filter] ${
                    selected ? "bg-[color:var(--workspace-teal-soft)] text-[color:var(--workspace-ink)]" : "text-[color:var(--workspace-ink-muted)] hover:bg-[color:var(--workspace-surface-muted)] hover:text-[color:var(--workspace-ink)]"
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${selected ? "border-[color:var(--workspace-teal)] text-[color:var(--workspace-teal)]" : "border-[color:var(--workspace-border)]"}`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{section.label}</span>
                    <span className="block text-xs font-normal text-[color:var(--workspace-ink-muted)]">{section.optional ? "Optional · " : ""}{section.time}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      <div id="blueprint-stage" tabIndex={-1} className="min-w-0 scroll-mt-4">
        {validationIssues.length > 0 && <div role="alert" aria-label="Check these answers" className="mb-4 rounded-xl border border-[color:var(--workspace-border)] bg-[color:var(--workspace-surface-muted)] p-4">
          <p className="font-semibold text-[color:var(--workspace-ink)]">Check these answers</p>
          <p className="mt-1 text-sm text-[color:var(--workspace-ink-muted)]">Your draft is still saved privately. Choose an answer below to fix it.</p>
          <ul className="mt-2 space-y-2">{validationIssues.map(issue => <li key={issue.path}><button type="button" onClick={() => onErrorSelect?.(issue)} className="workspace-focus min-h-11 text-left text-sm text-[color:var(--workspace-ink)] underline underline-offset-4">{issue.label}: {issue.message}</button></li>)}</ul>
        </div>}
        {controlledSection === undefined && <div className="mb-4 lg:hidden">
          <PortfolioMobileSectionNav activeSection={activeSection} completedCount={completion.completedCount} totalCount={completion.totalCount} onSectionChange={goTo} />
        </div>}
        <p className="mb-4 hidden text-sm font-semibold text-[color:var(--workspace-ink-muted)] lg:block">
          Step {activeIndex + 1} of {PORTFOLIO_EDITOR_SECTIONS.length} · {PORTFOLIO_EDITOR_SECTIONS[activeIndex].label}
        </p>
        {PORTFOLIO_EDITOR_SECTIONS[activeIndex].optional && (
          <p className="mb-4 rounded-xl border border-[color:var(--workspace-border)] bg-[color:var(--workspace-surface-muted)] px-4 py-4 text-sm leading-6 text-[color:var(--workspace-ink-muted)]">
            Optional section · Answer only what feels useful. You can continue now and return at any time.
          </p>
        )}
        {activeSection === "foundation" && (
          <FormSection eyebrow="Quick start" title="The essentials" description="Start with your name and the details people need for a useful introduction. Your draft stays private until you review and publish it.">
              {data.personal.profile_for && data.personal.profile_for !== "self" ? (
                <p role="alert" className="rounded-xl border border-[color:var(--workspace-border)] bg-[color:var(--workspace-surface-muted)] px-4 py-4 text-sm leading-6 text-[color:var(--workspace-ink)]">
                  This draft was started for someone else. The initial pilot supports only introductions created by the person featured. Your draft remains private, but it cannot be saved or published during this pilot. Please contact VivIntro support if this is your own introduction.
                </p>
              ) : null}
            <fieldset className="space-y-4">
              <legend className="text-[15px] font-semibold text-[color:var(--workspace-ink)]">Full name</legend>
              <p className="text-sm text-[color:var(--workspace-ink-muted)]">Your full name appears in the public introduction and private details. New share links include your first and last name and may be guessed.</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextInput fieldPath="personal.first_name" label="First name" value={nameParts.first_name} onChange={(value) => updateNamePart("first_name", value)} required requirement="Required" audience="All introduction views" autoComplete="given-name" maxLength={NAME_PART_MAX_LENGTH} pattern={NAME_PART_PATTERN} />
              <TextInput fieldPath="personal.middle_name" label="Middle name" value={nameParts.middle_name} onChange={(value) => updateNamePart("middle_name", value)} requirement="Optional" audience="All introduction views" autoComplete="additional-name" maxLength={NAME_PART_MAX_LENGTH} pattern={NAME_PART_PATTERN} />
              <TextInput fieldPath="personal.last_name" label="Last name" value={nameParts.last_name} onChange={(value) => updateNamePart("last_name", value)} required requirement="Required" audience="All introduction views" autoComplete="family-name" maxLength={NAME_PART_MAX_LENGTH} pattern={NAME_PART_PATTERN} />
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextInput fieldPath="personal.dob" label="Date of birth" type="date" value={data.personal?.dob || ""} onChange={(value) => updatePersonal({ dob: value })} required requirement="Required" audience="Age in public introduction · Exact date in private details" hint="You must be at least 18. Only your age is public; your exact date is shared only when you choose." min="1920-01-01" max={latestAdultBirthDate()} autoComplete="bday" />
              <SelectInput fieldPath="personal.gender" label="Gender" value={data.personal?.gender || ""} options={GENDER_OPTIONS} onChange={(value) => updatePersonal({ gender: value ? value as PortfolioData["personal"]["gender"] : undefined })} required requirement="Required" audience="Public introduction and private details" />
              <SelectInput fieldPath="personal.marital_status" label="Marital Status" value={data.personal?.marital_status || ""} options={withLegacyMaritalStatus(data.personal.marital_status)} onChange={(value) => updatePersonal({ marital_status: value })} required requirement="Required" audience="Public introduction and private details" />
              <SelectInput fieldPath="vitals.height" label="Height" value={data.vitals?.height || ""} options={HEIGHT_OPTIONS} onChange={(value) => onUpdate("vitals", { ...(data.vitals || {}), height: value })} required requirement="Required" audience="All introduction views" />
            </div>
            <PortfolioAnswer path="personal.current_location"><p className="text-[15px] font-semibold text-[color:var(--workspace-ink)]">Current location</p><CurrentLocationInput value={{ country: data.personal.country, countryCode: data.personal.country_code, region: data.personal.region, regionCode: data.personal.region_code, city: data.personal.city, cityGeonameId: data.personal.city_geoname_id, postalCode: data.personal.postal_code, locationSource: data.personal.location_source }} onChange={updateResidence} labels={{ country: "Current country", region: "Current state", city: "Current city", postalCode: "ZIP or PIN code" }} requireCompleteHierarchy /></PortfolioAnswer>
            <TextInput fieldPath="career.title" label="Current profession title" maxLength={200} value={data.career?.title || ""} onChange={(value) => onUpdate("career", { ...(data.career || {}), title: value })} required requirement="Required" audience="All introduction views" hint="Use a clear title, such as Product designer or Data engineer. If you are studying or between roles, say that directly." autoComplete="organization-title" />
            <TextArea fieldPath="personal.short_bio" label="Short description" value={data.personal?.short_bio || ""} onChange={(value) => updatePersonal({ short_bio: value })} maxLength={240} required requirement="Required" audience="All introduction views" hint="One or two natural sentences are enough. You can write a longer Personal story later." placeholder="For example: I value family, open conversation, and building a meaningful life together." />
            {photoManager && <PortfolioAnswer path="media.primary_photo"><EmbeddedPanel title="Photos" description="Choose a clear primary portrait first. Gallery photos can be added now or later.">{photoManager}</EmbeddedPanel></PortfolioAnswer>}
          </FormSection>
        )}

        {activeSection === "story" && (
          <FormSection eyebrow="Your voice" title="Personal story" description="Use your own words. A warm, specific answer is more helpful than a formal résumé-style summary.">
            <TextArea fieldPath="personal.profile_summary" label="How would your close friends describe you?" value={data.personal?.profile_summary || ""} onChange={(value) => updatePersonal({ profile_summary: value })} maxLength={1600} requirement="Optional" audience="Public introduction and private details" hint="Share 2–3 specific aspects of your personality, daily routine, or core values—beyond just your hobbies." placeholder="For example: I’m grounded, curious, and value clear communication. I balance a busy tech career with morning workouts and quiet weekends with family." example="I’m usually the person who brings friends together for a relaxed meal. They’d describe me as curious and dependable; I make time for my family and try to listen before offering advice." />
            <TextArea fieldPath="personal.long_term_goals" label="What kind of life are you building?" value={data.personal?.long_term_goals || ""} onChange={(value) => updatePersonal({ long_term_goals: value })} maxLength={1200} requirement="Optional" audience="Private details" hint="What are your priorities for the next 3–5 years regarding career, family life, and personal growth?" placeholder="For example: Building a warm, supportive home, growing in my leadership role, maintaining strong family ties, and making time to travel twice a year." example="Over the next few years, I hope to grow in my work while building a home where both people feel supported. Staying close to family and making room for travel matter to me too." />
            <TextArea fieldPath="personal.shared_life_plans" label="How do you picture quality time with your partner?" value={data.personal?.shared_life_plans || ""} onChange={(value) => updatePersonal({ shared_life_plans: value })} maxLength={1200} requirement="Optional" audience="Public introduction and private details" hint="Describe simple weekend rituals, shared activities, or how you like to unwind together." placeholder="For example: Cooking Sunday meals together, exploring weekend hiking spots, enjoying meaningful conversations over coffee, or trying new cuisines." example="I’d enjoy cooking together on Sundays and taking an unhurried walk afterward. On busier weeks, even a quiet dinner and honest conversation would feel like quality time." />
          </FormSection>
        )}

        {activeSection === "work" && (
          <FormSection eyebrow="Journey" title="Education and work" description="Share the level of detail that helps someone understand your path and present situation.">
            <fieldset className="space-y-4">
              <legend className="text-lg font-semibold text-[color:var(--workspace-ink)]">Education</legend>
              <div className="grid gap-4 sm:grid-cols-2">
              <SelfDescribeSelect {...otherAnswer("education.qualification_level")} fieldPath="education.qualification_level" label="Highest qualification" customLabel="Describe your qualification" maxLength={100} value={data.education?.qualification_level || ""} options={QUALIFICATION_OPTIONS} onChange={(value) => onUpdate("education", { ...(data.education || {}), qualification_level: value })} requirement="Recommended" audience="All introduction views" />
              <TextInput fieldPath="education.degree" label="Degree or qualification" maxLength={200} value={data.education?.degree || ""} onChange={(value) => onUpdate("education", { ...(data.education || {}), degree: value })} requirement="Recommended" audience="All introduction views" />
              <TextInput fieldPath="education.institution" label="Institution" maxLength={200} value={data.education?.institution || ""} onChange={(value) => onUpdate("education", { ...(data.education || {}), institution: value })} requirement="Optional" audience="Public introduction and private details" />
              <TextInput fieldPath="education.location" label="Education location" maxLength={200} value={data.education?.location || ""} onChange={(value) => onUpdate("education", { ...(data.education || {}), location: value })} requirement="Optional" audience="Public introduction and private details" hint="City and country where you studied, if you want to share them." />
              </div>
            </fieldset>
            <fieldset className="space-y-4 border-t border-[color:var(--workspace-border)] pt-6">
              <legend className="text-lg font-semibold text-[color:var(--workspace-ink)]">Current work</legend>
              <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput fieldPath="career.job_type" label="Work status" value={data.career?.job_type || ""} options={JOB_TYPE_OPTIONS} onChange={(value) => onUpdate("career", { ...(data.career || {}), job_type: value })} requirement="Optional" audience="Public introduction and private details" />
              <TextInput fieldPath="career.company" label="Employer or organisation" maxLength={200} value={data.career?.company || ""} onChange={(value) => onUpdate("career", { ...(data.career || {}), company: value })} audience="Private details" />
              <TextInput fieldPath="career.location" label="Work location" maxLength={200} value={data.career?.location || ""} onChange={(value) => onUpdate("career", { ...(data.career || {}), location: value })} requirement="Recommended" audience="All introduction views" />
              <SelfDescribeSelect {...otherAnswer("career.income_currency")} fieldPath="career.income_currency" label="Income currency" customLabel="Other currency code" maxLength={20} value={data.career?.income_currency || ""} options={CURRENCY_OPTIONS} onChange={updateIncomeCurrency} requirement="Optional" audience="Private details" hint="Choose a currency only if you want to share an income range." />
              <SelectInput fieldPath="career.annual_income" label="Annual income range" value={data.career?.annual_income || ""} options={incomeRangeOptions(data.career?.income_currency || "")} onChange={(value) => onUpdate("career", { ...(data.career || {}), annual_income: value })} requirement="Optional" audience="Private details" hint="Never shown in your public introduction. Exact income is not requested." />
            </div>
            <TextArea fieldPath="career.career_goals" label="Where would you like your career to grow?" value={data.career?.career_goals || ""} onChange={(value) => onUpdate("career", { ...(data.career || {}), career_goals: value })} maxLength={800} requirement="Optional" audience="Public introduction and private details" hint="A sentence or two about the direction you hope to take is enough; avoid confidential work details." />
            </fieldset>
            <fieldset className="space-y-4 border-t border-[color:var(--workspace-border)] pt-6">
              <legend className="text-lg font-semibold text-[color:var(--workspace-ink)]">Citizenship and residency</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput fieldPath="personal.citizenship" label="Citizenship" maxLength={100} value={data.personal?.citizenship || ""} onChange={(value) => updatePersonal({ citizenship: value })} requirement="Recommended" audience="Public introduction and private details" />
                <SelectInput fieldPath="personal.immigration_status" label="Visa or residency status" value={data.personal?.immigration_status || ""} options={VISA_OPTIONS} onChange={(value) => updatePersonal({ immigration_status: value })} requirement="Optional" audience="Public introduction and private details" />
              </div>
            </fieldset>
          </FormSection>
        )}

        {activeSection === "family" && (
          <FormSection eyebrow="Roots" title="Family and background" description="Introduce your family in a warm, respectful way. Personal contact details remain protected.">
            <TextArea fieldPath="family.public_summary" label="How would you describe your family?" value={data.family?.public_summary || ""} onChange={(value) => updateFamily({ public_summary: value })} maxLength={600} requirement="Recommended" audience="Public introduction and private details" hint="Describe the family without phone numbers, exact addresses, or private documents." />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelfDescribeSelect {...otherAnswer("personal.religion")} fieldPath="personal.religion" label="Religion or outlook" customLabel="Describe your religion or outlook" maxLength={100} value={data.personal?.religion || ""} options={RELIGION_OPTIONS} onChange={(value) => updatePersonal({ religion: value })} requirement="Optional" audience="Public introduction and private details" hint="Share this only if it is meaningful to you." />
              <SelfDescribeSelect {...otherAnswer("personal.community")} fieldPath="personal.community" label="Community or cultural background" customLabel="Describe your community or background" otherValue="Other / self-describe" maxLength={150} value={data.personal?.community || ""} onChange={(value) => updatePersonal({ community: value })} options={COMMUNITY_OPTIONS} requirement="Optional" audience="Public introduction and private details" hint="Optional. These suggestions are not exhaustive; choose Other to use your own words." />
              <TextInput fieldPath="personal.sub_community" label="Sub-community (if relevant)" maxLength={150} value={data.personal?.sub_community || ""} onChange={(value) => updatePersonal({ sub_community: value })} requirement="Optional" audience="Public introduction and private details" />
              <TextInput fieldPath="family.parents_location" label="Parents' current location" maxLength={200} value={data.family?.parents_location || ""} onChange={(value) => updateFamily({ parents_location: value })} requirement="Optional" audience="Private details" />
              <TextInput fieldPath="family.father.name" label="Father or guardian name" maxLength={100} value={data.family?.father?.name || ""} onChange={(value) => updateFamily({ father: { ...(data.family?.father || {}), name: value } })} requirement="Optional" audience="Private details" />
              <TextInput fieldPath="family.father.occupation" label="Father or guardian profession" maxLength={200} value={data.family?.father?.occupation || ""} onChange={(value) => updateFamily({ father: { ...(data.family?.father || {}), occupation: value } })} requirement="Optional" audience="Private details" />
              <TextInput fieldPath="family.mother.name" label="Mother or guardian name" maxLength={100} value={data.family?.mother?.name || ""} onChange={(value) => updateFamily({ mother: { ...(data.family?.mother || {}), name: value } })} requirement="Optional" audience="Private details" />
              <TextInput fieldPath="family.mother.occupation" label="Mother or guardian profession" maxLength={200} value={data.family?.mother?.occupation || ""} onChange={(value) => updateFamily({ mother: { ...(data.family?.mother || {}), occupation: value } })} requirement="Optional" audience="Private details" />
              <TextInput label="Paternal family origin" maxLength={200} value={data.family?.paternal_origin || data.family?.ancestral_origin || ""} onChange={(value) => updateFamily({ paternal_origin: value })} requirement="Optional" audience="Public introduction and private details" hint="Place or region your family traces its roots to, not a current address." />
              <TextInput fieldPath="family.maternal_origin" label="Maternal family origin" maxLength={200} value={data.family?.maternal_origin || ""} onChange={(value) => updateFamily({ maternal_origin: value })} requirement="Optional" audience="Public introduction and private details" hint="Place or region your family traces its roots to, not a current address." />
              <TextInput label="Number of siblings" type="number" min="0" max="10" value={String(data.family?.sibling_count ?? "")} onChange={setSiblingCount} requirement="Optional" audience="Public introduction and private details" />
              <SelectInput fieldPath="family.sibling_position" label="Your position among siblings" value={data.family?.sibling_position || ""} options={SIBLING_POSITION_OPTIONS} onChange={(value) => updateFamily({ sibling_position: value })} requirement="Optional" audience="Public introduction and private details" />
            </div>
            {(data.family?.siblings || []).map((sibling, index) => (
              <div key={index} className="rounded-xl border border-[color:var(--workspace-border)] bg-[color:var(--workspace-surface-muted)] p-4">
                <p className="mb-4 text-base font-semibold text-[color:var(--workspace-ink)]">Sibling {index + 1} <span className="ml-2 text-sm font-normal text-[color:var(--workspace-ink-muted)]">Optional details</span></p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput fieldPath={`family.siblings.${index}.name`} label="Name" maxLength={100} value={sibling.name || ""} onChange={(value) => updateSibling(index, { name: value })} audience="Private details" />
                  <TextInput fieldPath={`family.siblings.${index}.occupation`} label="Occupation" maxLength={200} value={sibling.occupation || ""} onChange={(value) => updateSibling(index, { occupation: value })} audience="Private details" />
                  <TextInput fieldPath={`family.siblings.${index}.location`} label="Location" maxLength={200} value={sibling.location || ""} onChange={(value) => updateSibling(index, { location: value })} audience="Private details" />
                  <SelectInput fieldPath={`family.siblings.${index}.marital_status`} label="Marital status" value={sibling.marital_status || ""} options={withLegacyMaritalStatus(sibling.marital_status)} onChange={(value) => updateSibling(index, { marital_status: value })} audience="Private details" />
                </div>
              </div>
            ))}
          </FormSection>
        )}

        {activeSection === "story" && (
          <FormSection eyebrow="Everyday life" title="Lifestyle and interests" description="Choose what genuinely reflects you.">
            <div className="grid gap-4 sm:grid-cols-3">
              <SelfDescribeSelect {...otherAnswer("lifestyle.diet")} fieldPath="lifestyle.diet" label="Dietary preference" customLabel="Describe your dietary preference" maxLength={100} value={data.lifestyle?.diet || ""} options={DIET_OPTIONS} onChange={(value) => onUpdate("lifestyle", { ...(data.lifestyle || {}), diet: value })} requirement="Recommended" audience="All introduction views" />
              <SelectInput fieldPath="lifestyle.drinking" label="Alcohol use" value={data.lifestyle?.drinking || ""} options={ALCOHOL_USE_OPTIONS} onChange={(value) => onUpdate("lifestyle", { ...(data.lifestyle || {}), drinking: value })} requirement="Optional" audience="Public introduction and private details" />
              <SelectInput fieldPath="lifestyle.smoking" label="Tobacco use" value={data.lifestyle?.smoking || ""} options={TOBACCO_USE_OPTIONS} onChange={(value) => onUpdate("lifestyle", { ...(data.lifestyle || {}), smoking: value })} requirement="Optional" audience="Public introduction and private details" />
            </div>
            <MultiSelectInput fieldPath="lifestyle.languages" label="Languages" value={data.lifestyle?.languages || ""} options={LANGUAGE_OPTIONS} onChange={(value) => onUpdate("lifestyle", { ...(data.lifestyle || {}), languages: value })} requirement="Recommended" audience="All introduction views" maxItems={10} />
            <MultiSelectInput fieldPath="lifestyle.hobbies" label="Select up to 6 Interests" value={data.lifestyle?.hobbies || ""} options={HOBBY_OPTIONS} onChange={(value) => onUpdate("lifestyle", { ...(data.lifestyle || {}), hobbies: value })} requirement="Recommended" audience="All introduction views" maxItems={6} hint="Pick specific activities you actually enjoy; use the story above for personality and values." />
            <MultiSelectInput fieldPath="lifestyle.values_statement" label="Values that matter to you" value={data.lifestyle?.values_statement || ""} options={VALUE_OPTIONS} onChange={(value) => onUpdate("lifestyle", { ...(data.lifestyle || {}), values_statement: value })} requirement="Recommended" audience="All introduction views" maxItems={5} hint="Choose a few that genuinely guide your decisions and relationships." />
          </FormSection>
        )}

        {activeSection === "preferences" && (
          <FormSection eyebrow="Compatibility" title="Partner preferences" description="Lead with values rather than a checklist. Detailed filters stay visible only to people you choose to share with.">
            <TextArea fieldPath="preferences.narrative" label="What qualities would support a good partnership?" value={data.preferences?.narrative || ""} onChange={(value) => onUpdate("preferences", { ...(data.preferences || {}), narrative: value })} maxLength={1200} requirement="Recommended" audience="Public introduction and private details" hint="Describe the relationship dynamic that matters to you." placeholder="For example: kindness, emotional maturity, honest communication, and the ability to balance family connection with independence." />
            <div className="grid gap-4 sm:grid-cols-2">
              <RangeSelectInput label="Preferred age range" value={data.preferences?.age_range || ""} options={AGE_OPTIONS} onChange={(value) => onUpdate("preferences", { ...(data.preferences || {}), age_range: value })} audience="People you choose to share with" />
              <RangeSelectInput label="Preferred height range" value={data.preferences?.height_range || ""} options={HEIGHT_OPTIONS} onChange={(value) => onUpdate("preferences", { ...(data.preferences || {}), height_range: value })} audience="People you choose to share with" />
              <SelectInput fieldPath="preferences.caste_preference" label="Community preference" value={data.preferences?.caste_preference || ""} options={CASTE_PREFERENCE_OPTIONS} onChange={(value) => onUpdate("preferences", { ...(data.preferences || {}), caste_preference: value, ...(value !== "specific" && { specific_communities: "" }) })} requirement="Optional" audience="People you choose to share with" />
              <SelectInput fieldPath="preferences.horoscope_preference" label="Horoscope matching preference" value={data.preferences?.horoscope_preference || ""} options={HOROSCOPE_PREFERENCE_OPTIONS} onChange={(value) => onUpdate("preferences", { ...(data.preferences || {}), horoscope_preference: value })} requirement="Optional" audience="People you choose to share with" />
            </div>
            {data.preferences?.caste_preference === "specific" && <MultiSelectInput fieldPath="preferences.specific_communities" label="Specific communities" value={data.preferences?.specific_communities || ""} options={COMMUNITY_OPTIONS.filter((item) => item.value)} onChange={(value) => onUpdate("preferences", { ...(data.preferences || {}), specific_communities: value })} audience="People you choose to share with" />}
            <MultiSelectInput fieldPath="preferences.visa_preferences" label="Preferred visa or residency statuses" value={data.preferences?.visa_preferences || ""} options={VISA_OPTIONS.filter((item) => item.value)} onChange={(value) => onUpdate("preferences", { ...(data.preferences || {}), visa_preferences: value })} audience="People you choose to share with" hint="Useful only when international location compatibility matters." />
          </FormSection>
        )}

        {activeSection === "preferences" && (
          <FormSection eyebrow="Looking ahead" title="Future plans" description="These are conversation starters, not commitments. Choose only what you are comfortable sharing.">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput fieldPath="preferences.marriage_timeline" label="When would you ideally like to marry?" value={data.preferences?.marriage_timeline || ""} options={MARRIAGE_TIMELINE_OPTIONS} onChange={(value) => onUpdate("preferences", { ...(data.preferences || {}), marriage_timeline: value })} requirement="Optional" audience="People you choose to share with" />
              <SelectInput fieldPath="preferences.children_preference" label="How do you feel about having children?" value={data.preferences?.children_preference || ""} options={CHILDREN_OPTIONS} onChange={(value) => onUpdate("preferences", { ...(data.preferences || {}), children_preference: value })} requirement="Optional" audience="People you choose to share with" />
              <SelectInput fieldPath="personal.relocation_preference" label="Would you consider relocating after marriage?" value={data.personal?.relocation_preference || ""} options={RELOCATION_OPTIONS} onChange={(value) => updatePersonal({ relocation_preference: value })} requirement="Optional" audience="People you choose to share with" />
              <SelectInput fieldPath="preferences.career_after_marriage" label="How should careers be supported after marriage?" value={data.preferences?.career_after_marriage || ""} options={CAREER_AFTER_MARRIAGE_OPTIONS} onChange={(value) => onUpdate("preferences", { ...(data.preferences || {}), career_after_marriage: value })} requirement="Optional" audience="People you choose to share with" />
              <SelectInput fieldPath="preferences.living_arrangement" label="What living arrangement feels comfortable?" value={data.preferences?.living_arrangement || ""} options={LIVING_ARRANGEMENT_OPTIONS} onChange={(value) => onUpdate("preferences", { ...(data.preferences || {}), living_arrangement: value })} requirement="Optional" audience="People you choose to share with" />
              <SelectInput fieldPath="preferences.family_responsibilities" label="How should family responsibilities be handled?" value={data.preferences?.family_responsibilities || ""} options={FAMILY_RESPONSIBILITY_OPTIONS} onChange={(value) => onUpdate("preferences", { ...(data.preferences || {}), family_responsibilities: value })} requirement="Optional" audience="People you choose to share with" />
            </div>
          </FormSection>
        )}

        {activeSection === "astrology" && (
          <FormSection eyebrow="Astrology" title="Astrology and horoscope" description="This section is optional. Leave it blank, or add the details you know and want to share. We’ll help you correct any invalid answers.">
            <InfoCard title="No guessing required" audience="Optional" text="Leave unknown details blank. Exact birth time, place, Manglik status, and the horoscope remain in the private details only." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextInput fieldPath="personal.place_of_birth" label="Place of birth" maxLength={200} value={data.personal?.place_of_birth || ""} onChange={(value) => updatePersonal({ place_of_birth: value })} requirement="Optional" audience="Private details" />
              <TextInput fieldPath="astrology.time_of_birth" label="Time of birth" type="time" value={data.astrology?.time_of_birth || ""} onChange={(value) => onUpdate("astrology", { ...(data.astrology || {}), time_of_birth: value })} requirement="Optional" audience="Private details" hint="Leave blank if the recorded time is unknown." />
              <SelectInput fieldPath="astrology.rashi" label="Moon sign (Rashi)" value={data.astrology?.rashi || ""} options={RASHI_SELECT_OPTIONS} onChange={(value) => onUpdate("astrology", { ...(data.astrology || {}), rashi: value as NonNullable<PortfolioData["astrology"]>["rashi"] })} requirement="Optional" audience="All introduction views" hint="Your Vedic moon sign. Leave blank if you are unsure." />
              <SelectInput fieldPath="astrology.nakshatra" label="Birth star (Nakshatra)" value={data.astrology?.nakshatra || ""} options={NAKSHATRA_OPTIONS} onChange={(value) => onUpdate("astrology", { ...(data.astrology || {}), nakshatra: value })} requirement="Optional" audience="All introduction views" hint="Your Vedic birth star, which is different from a zodiac sign." />
              <SelectInput fieldPath="astrology.pada" label="Pada" value={data.astrology?.pada || ""} options={PADA_OPTIONS} onChange={(value) => onUpdate("astrology", { ...(data.astrology || {}), pada: value as NonNullable<PortfolioData["astrology"]>["pada"] })} requirement="Optional" audience="Private details" />
              <TextInput fieldPath="astrology.lagnam" label="Lagnam" maxLength={100} value={data.astrology?.lagnam || ""} onChange={(value) => onUpdate("astrology", { ...(data.astrology || {}), lagnam: value })} requirement="Optional" audience="Private details" />
              <TextInput fieldPath="vitals.gotra" label="Gotra" maxLength={100} value={data.vitals?.gotra || ""} onChange={(value) => onUpdate("vitals", { ...(data.vitals || {}), gotra: value })} requirement="Optional" audience="Public introduction and private details" />
              <TextInput fieldPath="astrology.maternal_gotra" label="Maternal gotra" maxLength={100} value={data.astrology?.maternal_gotra || ""} onChange={(value) => onUpdate("astrology", { ...(data.astrology || {}), maternal_gotra: value })} requirement="Optional" audience="Public introduction and private details" />
              <SelectInput fieldPath="astrology.manglik_status" label="Manglik status" value={data.astrology?.manglik_status || ""} options={MANGLIK_OPTIONS} onChange={(value) => onUpdate("astrology", { ...(data.astrology || {}), manglik_status: value })} requirement="Optional" audience="Private details" />
            </div>
            {horoscopeManager && <EmbeddedPanel title="Original horoscope attachment" description="Only people you’ve shared with can open it as a separate document.">{horoscopeManager}</EmbeddedPanel>}
          </FormSection>
        )}

        {activeSection === "privacy" && (
          <FormSection eyebrow="You stay in control" title="Appearance and contact" description="Choose your introduction appearance and optionally add private contact details. Contact details are shared only when you choose.">
            <InfoCard title="Sensitive details stay protected" audience="Never public" text="Exact birth details, contact information, income, and the horoscope are not shown in the public introduction." />
            <div>
              <p className="mb-2 text-base font-semibold text-[color:var(--workspace-ink)]">Introduction appearance</p>
              <p className="mb-4 text-sm leading-6 text-[color:var(--workspace-ink-muted)]">This changes the published introduction only. Light is recommended for comfortable reading across generations. Use the header theme switch to change your workspace separately.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["light", "dark"] as const).map((appearance) => {
                  const selected = (data.style?.appearance || "light") === appearance;
                  const Icon = appearance === "light" ? Sun : Moon;
                  return <button key={appearance} type="button" aria-pressed={selected} onClick={() => setAppearance(appearance)} className={`workspace-focus min-h-20 rounded-xl border p-4 text-left transition-[transform,box-shadow,filter] ${selected ? "border-[color:var(--workspace-teal)] bg-[color:var(--workspace-teal-soft)]" : "border-[color:var(--workspace-border)] bg-[var(--workspace-surface)] hover:border-[var(--workspace-border)]"}`}><span className="flex items-center gap-4 text-base font-semibold text-[color:var(--workspace-ink)]"><Icon className="h-5 w-5 text-[color:var(--workspace-teal)]" aria-hidden="true" />{appearance === "light" ? "Light" : "Dark"}{selected && <Check className="ml-auto h-5 w-5 text-[color:var(--workspace-teal)]" aria-hidden="true" />}</span></button>;
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 text-base font-semibold text-[color:var(--workspace-ink)]">Who can see what</p>
              <p className="mb-4 text-sm leading-6 text-[color:var(--workspace-ink-muted)]">You can review the public introduction before publishing. Contact, income, and exact birth details are never public.</p>
              <InfoCard title="Public introduction" audience="Public link" text="Anyone with your active link can see your full name, profession, location, story, interests, family introduction, and selected astrology. You can open the optional preview before giving publication consent." />
              {data.privacy_mode === "private" && <div className="mt-4 rounded-xl border border-[color:var(--workspace-border)] p-4"><p className="text-sm leading-6 text-[color:var(--workspace-ink)]">This saved draft uses an older sharing setup. Your current published link will not change until you review and publish again. To publish changes, update this draft to the current sharing setup, then confirm publication consent.</p><button type="button" className="workspace-focus mt-4 min-h-11 rounded-lg border border-[color:var(--workspace-teal)] px-4 text-sm font-semibold" onClick={() => onUpdate("privacy_mode", "balanced")}>Update sharing setup</button></div>}
            </div>
            <div className="space-y-4 border-t border-[color:var(--workspace-border)] pt-6">
              <InfoCard title="Private contact" audience="Optional · private details" text="These contacts stay out of the public introduction and unlock only for someone you choose to share with. People you’ve shared with may save the details they receive." />
              {contacts.map((contact, index) => (
                <div key={index} className="rounded-xl border border-[color:var(--workspace-border)] bg-[color:var(--workspace-surface-muted)] p-4">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <p className="text-base font-semibold text-[color:var(--workspace-ink)]">Private contact {index + 1}</p>
                    <button type="button" onClick={() => updateContacts(contacts.filter((_, itemIndex) => itemIndex !== index))} className="workspace-focus inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-[var(--ui-danger)] hover:bg-[var(--workspace-canvas)]"><Trash2 className="h-4 w-4" aria-hidden="true" /> Remove</button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectInput fieldPath={`contact.contacts.${index}.relationship`} label="Who is this?" value={contact.relationship || "self"} options={CONTACT_RELATIONSHIPS} onChange={(value) => updateContacts(contacts.map((item, itemIndex) => itemIndex === index ? { ...item, relationship: value } : item))} />
                    <TextInput fieldPath={`contact.contacts.${index}.name`} label="Name of contact" maxLength={100} value={contact.name || ""} onChange={(value) => updateContacts(contacts.map((item, itemIndex) => itemIndex === index ? { ...item, name: value } : item))} />
                    <ContactPhoneInput fieldPath={`contact.contacts.${index}.phone`} value={contact.phone || ""} onChange={(value) => updateContacts(contacts.map((item, itemIndex) => itemIndex === index ? { ...item, phone: value } : item))} hint="Add the country code and number, or provide an email instead." />
                    <TextInput fieldPath={`contact.contacts.${index}.email`} label="Email" maxLength={254} type="email" value={contact.email || ""} onChange={(value) => updateContacts(contacts.map((item, itemIndex) => itemIndex === index ? { ...item, email: value } : item))} />
                  </div>
                </div>
              ))}
              {contacts.length < 5 && <button type="button" onClick={() => updateContacts([...contacts, { relationship: contacts.length ? "other" : "self", name: "", phone: "", email: "" }])} className="workspace-focus min-h-12 rounded-lg border border-[color:var(--workspace-border)] bg-[var(--workspace-surface)] px-4 text-sm font-semibold text-[color:var(--workspace-ink)] hover:bg-[color:var(--workspace-surface-muted)]">{contacts.length ? "Add another private contact" : "Add a private contact"}</button>}
            </div>
          </FormSection>
        )}

        <p className="mt-6 flex items-start gap-2 text-sm leading-6 text-[color:var(--workspace-ink-muted)]"><LockKeyhole className="mt-2 h-4 w-4 shrink-0" aria-hidden="true" /><span>Fields marked with a lock are shared only when you choose. Next, confirm consent in Review and publish. Previews are optional.</span></p>

        <div className="mt-6 hidden flex-wrap items-center justify-between gap-4 border-t border-[color:var(--workspace-border)] pt-6 sm:flex">
          <button type="button" disabled={activeIndex === 0} onClick={() => goTo(PORTFOLIO_EDITOR_SECTIONS[activeIndex - 1].id)} className="workspace-focus inline-flex min-h-12 items-center gap-2 rounded-lg border border-[color:var(--workspace-border)] bg-[var(--workspace-surface)] px-4 text-sm font-semibold text-[color:var(--workspace-ink)] hover:bg-[color:var(--workspace-surface-muted)] disabled:invisible"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Previous</button>
          <p className="hidden text-sm text-[color:var(--workspace-ink-muted)] sm:block">You can change saved answers at any time.</p>
          {activeIndex < PORTFOLIO_EDITOR_SECTIONS.length - 1 ? (
            <button type="button" onClick={() => goTo(PORTFOLIO_EDITOR_SECTIONS[activeIndex + 1].id)} className="dashboard-primary-action workspace-focus min-h-12 px-6">Continue: {PORTFOLIO_EDITOR_SECTIONS[activeIndex + 1].label}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
          ) : <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--workspace-teal)]"><Check className="h-4 w-4" aria-hidden="true" /> Last section · confirm consent and publish when ready</span>}
        </div>
      </div>
    </div>
    </PortfolioFieldValidation>
  );
}

function CurrentLocationInput(props: ComponentProps<typeof LocationFields>) {
  const error = usePortfolioFieldError("personal.current_location");
  return <LocationFields {...props} errorDescriptionId={error ? `${portfolioFieldAnchor("personal.current_location")}-error` : undefined} />;
}

function ContactPhoneInput({ fieldPath, ...props }: ComponentProps<typeof PhoneNumberField> & { fieldPath: string }) {
  const error = usePortfolioFieldError(fieldPath);
  return <div id={portfolioFieldAnchor(fieldPath)}><PhoneNumberField {...props} error={error} /></div>;
}

function FormSection({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <section className="biodata-editor-card space-y-6 rounded-2xl p-6 sm:p-8"><div><p className="text-sm font-semibold text-[color:var(--workspace-teal)]">{eyebrow}</p><h3 className="mt-2 text-2xl font-semibold text-[color:var(--workspace-ink)]">{title}</h3><p className="mt-2 max-w-3xl text-base leading-7 text-[color:var(--workspace-ink-muted)]">{description}</p></div>{children}</section>;
}

function InfoCard({ title, text, audience }: { title: string; text: string; audience: string }) {
  const protectedAudience = audience === "Never public" || audience.toLowerCase().includes("private details");
  return <div className="rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-canvas)] p-4"><div className="flex items-start gap-4"><ShieldCheck className="mt-2 h-5 w-5 shrink-0 text-[color:var(--workspace-teal)]" aria-hidden="true" /><div><p className="text-base font-semibold text-[color:var(--workspace-ink)]">{title}</p><p className="mt-2 text-sm leading-6 text-[color:var(--workspace-ink-muted)]">{text}</p>{protectedAudience && <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--workspace-teal)]"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />{audience === "Never public" ? "Never public" : "Shared when you choose"}</span>}</div></div></div>;
}

function EmbeddedPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="rounded-xl border border-[color:var(--workspace-border)] bg-[color:var(--workspace-surface-muted)] p-4"><div className="mb-4"><p className="text-base font-semibold text-[color:var(--workspace-ink)]">{title}</p><p className="mt-2 text-sm leading-6 text-[color:var(--workspace-ink-muted)]">{description}</p></div>{children}</div>;
}

function approvalOnlyAudience(audience?: string) {
  return audience === "Private details" || audience === "People you choose to share with";
}

function FieldLabel({ label, required, audience }: { label: string; hint?: string; required?: boolean; requirement?: string; audience?: string }) {
  return <span className="inline-flex items-start gap-2">{approvalOnlyAudience(audience) && <LockKeyhole className="mt-2 h-3.5 w-3.5 shrink-0 text-[color:var(--workspace-teal)]" aria-hidden="true" />}<span className="min-w-0">{label}{required && <><span className="ml-2 text-[color:var(--workspace-teal)]" aria-hidden="true">*</span><span className="sr-only"> (required)</span></>}</span></span>;
}

function FieldHelp({ id, hint, audience }: { id: string; hint?: string; audience?: string }) {
  return <>{hint && <span id={`${id}-hint`} className="text-sm font-normal leading-5 text-[color:var(--workspace-ink-muted)]">{hint}</span>}{approvalOnlyAudience(audience) && <span id={`${id}-privacy`} className="sr-only">Shared only when you choose, never in your public introduction.</span>}</>;
}

function fieldDescriptionIds(id: string, hint: string | undefined, audience: string | undefined, errorId?: string) {
  return [hint && `${id}-hint`, approvalOnlyAudience(audience) && `${id}-privacy`, errorId].filter(Boolean).join(" ") || undefined;
}

function TextInput({ fieldPath, label, value, onChange, type = "text", placeholder, hint, required, min, max, maxLength, pattern, requirement, audience, list, name, autoComplete }: { fieldPath?: string; label: string; value: string; onChange: (value: string) => void; type?: HTMLInputTypeAttribute; placeholder?: string; hint?: string; required?: boolean; min?: string; max?: string; maxLength?: number; pattern?: RegExp; requirement?: string; audience?: string; list?: string; name?: string; autoComplete?: string }) {
  const [touched, setTouched] = useState(false);
  const fallbackId = useId();
  const id = fieldPath ? portfolioFieldAnchor(fieldPath) : fallbackId;
  const externalError = usePortfolioFieldError(fieldPath);
  const errorId = useId();
  const exceedsDateMaximum = type === "date" && Boolean(value && max && value > max);
  const precedesDateMinimum = type === "date" && Boolean(value && min && value < min);
  const invalidPattern = Boolean(value.trim() && pattern && !pattern.test(value.trim()));
  const invalid = Boolean(externalError || touched && ((required && !value.trim()) || exceedsDateMaximum || precedesDateMinimum || invalidPattern || (maxLength && value.length > maxLength)));
  const errorMessage = externalError || (exceedsDateMaximum ? "You must be 18 or older." : precedesDateMinimum ? "Enter a date from 1920 onward." : invalidPattern ? "Use letters, spaces, apostrophes or hyphens only." : maxLength && value.length > maxLength ? `Use at most ${maxLength} characters.` : "This field is required.");
  const resolvedName = name || label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return <label htmlFor={id} className="min-w-0 flex flex-col gap-2 text-[15px] font-semibold text-[color:var(--workspace-ink)]"><FieldLabel label={label} hint={hint} required={required} requirement={requirement} audience={audience} /><input id={id} name={resolvedName} aria-label={label} aria-invalid={invalid} aria-describedby={fieldDescriptionIds(id, hint, audience, invalid ? errorId : undefined)} type={type} value={value} placeholder={placeholder} required={required} min={min} max={max} maxLength={maxLength} pattern={pattern?.source.replaceAll("-", "\\-")} list={list} autoComplete={autoComplete || (type === "email" ? "email" : type === "tel" ? "tel" : "off")} spellCheck={type === "email" ? false : undefined} onBlur={() => setTouched(true)} onChange={(event) => onChange(event.target.value)} className="biodata-field min-h-12" /><FieldHelp id={id} hint={hint} audience={audience} />{invalid && <span id={errorId} role="alert" className="text-sm font-normal text-[var(--ui-danger)]">{errorMessage}</span>}</label>;
}

function TextArea({ fieldPath, label, value, onChange, hint, required, maxLength, requirement, audience, placeholder, example }: { fieldPath?: string; label: string; value: string; onChange: (value: string) => void; hint?: string; required?: boolean; maxLength?: number; requirement?: string; audience?: string; placeholder?: string; example?: string }) {
  const [touched, setTouched] = useState(false);
  const fallbackId = useId();
  const id = fieldPath ? portfolioFieldAnchor(fieldPath) : fallbackId;
  const externalError = usePortfolioFieldError(fieldPath);
  const errorId = useId();
  const invalid = Boolean(externalError || touched && required && !value.trim());
  return <div className="min-w-0 flex flex-col gap-2 text-[15px] font-semibold text-[color:var(--workspace-ink)]"><label htmlFor={id}><FieldLabel label={label} hint={hint} required={required} requirement={requirement} audience={audience} /></label><textarea id={id} name={label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")} aria-label={label} aria-invalid={invalid} aria-describedby={fieldDescriptionIds(id, hint, audience, invalid ? errorId : undefined)} value={value} placeholder={placeholder} required={required} maxLength={maxLength} autoComplete="off" onBlur={() => setTouched(true)} onChange={(event) => onChange(event.target.value)} rows={4} className="biodata-field min-h-32 resize-y py-4 leading-7" /><FieldHelp id={id} hint={hint} audience={audience} />{invalid && <span id={errorId} role="alert" className="text-sm font-normal text-[var(--ui-danger)]">{externalError || "This field is required."}</span>}{maxLength && <span className={`self-end text-xs font-normal text-[color:var(--workspace-ink-muted)]`}>{value.trim().length} · maximum {maxLength} characters</span>}{example && <details className="rounded-lg border border-[color:var(--workspace-border)] px-4 py-2 text-sm font-normal text-[color:var(--workspace-ink-muted)]"><summary className="workspace-focus cursor-pointer font-semibold text-[color:var(--workspace-teal)]">See a good example</summary><p className="mt-2 leading-6">{example}</p></details>}</div>;
}

function SelectInput({ fieldPath, label, value, options, onChange, required, requirement, audience, hint }: { fieldPath?: string; label: string; value: string; options: BlueprintOption[]; onChange: (value: string) => void; required?: boolean; requirement?: string; audience?: string; hint?: string }) {
  const [touched, setTouched] = useState(false);
  const resolvedOptions = value && !options.some((item) => item.value === value)
    ? [{ value, label: `${value} (current)` }, ...options]
    : options;
  const fallbackId = useId();
  const id = fieldPath ? portfolioFieldAnchor(fieldPath) : fallbackId;
  const externalError = usePortfolioFieldError(fieldPath);
  const errorId = useId();
  const invalid = Boolean(externalError || required && touched && !value.trim());
  return <label htmlFor={id} className="min-w-0 flex flex-col gap-2 text-[15px] font-semibold text-[color:var(--workspace-ink)]"><FieldLabel label={label} hint={hint} required={required} requirement={requirement} audience={audience} /><select id={id} name={label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")} aria-label={label} aria-invalid={invalid} aria-describedby={fieldDescriptionIds(id, hint, audience, invalid ? errorId : undefined)} value={value} required={required} onBlur={() => setTouched(true)} onChange={(event) => onChange(event.target.value)} className="biodata-field min-h-12">{resolvedOptions.map((item) => <option key={`${item.value}-${item.label}`} value={item.value}>{item.label}</option>)}</select><FieldHelp id={id} hint={hint} audience={audience} />{invalid && <span id={errorId} role="alert" className="text-sm font-normal text-[var(--ui-danger)]">{externalError || "This field is required."}</span>}</label>;
}

function SelfDescribeSelect({ memory, onRemember, customLabel, maxLength, otherValue = "Other", onChange, ...props }: Omit<ComponentProps<typeof SelectInput>, "onChange"> & {
  memory?: { text: string; active: boolean };
  onRemember: (memory: { text: string; active: boolean }) => void;
  customLabel: string;
  maxLength: number;
  otherValue?: string;
  onChange: (value: string) => void | boolean;
}) {
  const custom = Boolean(props.value && !props.options.some(item => item.value === props.value));
  const isOther = props.value === otherValue || custom || Boolean(memory?.active && memory.text === props.value);
  const text = props.value === otherValue ? "" : props.value;
  return <div className="min-w-0 space-y-3">
    <SelectInput {...props} value={isOther ? otherValue : props.value} onChange={value => {
      const next = value === otherValue ? memory?.text || otherValue : value;
      if (onChange(next) === false) return;
      onRemember({ active: value === otherValue, text: isOther ? text : memory?.text || "" });
    }} />
    {isOther && <TextInput label={customLabel} value={text} maxLength={maxLength} audience={props.audience} onChange={value => {
      if (onChange(value || otherValue) === false) return;
      onRemember({ active: true, text: value });
    }} />}
  </div>;
}

function RangeSelectInput({ label, value, options, onChange, audience }: { label: string; value: string; options: BlueprintOption[]; onChange: (value: string) => void; audience?: string }) {
  const descriptionId = useId();
  const range = parseRange(value, options);
  const subject = label.toLowerCase().includes("height") ? "height" : "age";
  const legacyValue = value && !range.minimum && !range.maximum ? value : undefined;
  const selectable = options.filter((item) => item.value);
  const minimumOptions = [{ value: "", label: "No minimum" }, ...selectable];
  const maximumOptions = [{ value: "", label: "No maximum" }, ...selectable];
  return (
    <fieldset aria-describedby={fieldDescriptionIds(descriptionId, undefined, audience)} className="space-y-4 rounded-xl border border-[color:var(--workspace-border)] bg-[color:var(--workspace-surface-muted)] p-4">
      <legend className="px-2 text-[15px] font-semibold text-[color:var(--workspace-ink)]"><FieldLabel label={label} audience={audience} /></legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label={`Minimum ${subject}`} value={range.minimum} options={minimumOptions} onChange={(minimum) => onChange(updateRange(range, "minimum", minimum, selectable))} />
        <SelectInput label={`Maximum ${subject}`} value={range.maximum} options={maximumOptions} onChange={(maximum) => onChange(updateRange(range, "maximum", maximum, selectable))} />
      </div>
      <FieldHelp id={descriptionId} audience={audience} />
      {legacyValue && <p className="text-sm text-[color:var(--workspace-ink-muted)]">Previous entry: {legacyValue}. Choose a minimum and maximum to replace it.</p>}
      {(range.minimum || range.maximum) && <button type="button" onClick={() => onChange("")} className="workspace-focus min-h-11 rounded-lg px-2 text-sm font-semibold text-[color:var(--workspace-teal)] hover:text-[color:var(--workspace-navy)]">Clear range</button>}
    </fieldset>
  );
}

function MultiSelectInput({ fieldPath, label, value, options, onChange, audience, hint, requirement, allowCustom = true, maxItems }: { fieldPath?: string; label: string; value: string; options: BlueprintOption[]; onChange: (value: string) => void; audience?: string; hint?: string; requirement?: string; allowCustom?: boolean; maxItems?: number }) {
  const externalError = usePortfolioFieldError(fieldPath);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const values = formListValues(value);
  const atLimit = maxItems !== undefined && values.length >= maxItems;
  const listId = useId();
  const query = draft.trim().toLowerCase();
  const available = options.filter((item) => item.value && !values.some((selected) => selected.toLowerCase() === item.value.toLowerCase()));
  const suggestions = available.filter((item) => !query || item.label.toLowerCase().includes(query)).slice(0, 12);
  const expanded = open && !atLimit && suggestions.length > 0;
  const activeIndex = suggestions.findIndex(item => item.value === activeValue);
  const activeId = expanded && activeIndex >= 0 ? listId + "-option-" + activeIndex : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  function addValue(selectedValue?: string) {
    const match = available.find((item) => item.value.toLowerCase() === (selectedValue || draft.trim()).toLowerCase());
    const next = match?.value || (allowCustom ? (selectedValue || draft.trim()) : "");
    if (!next || atLimit || values.some((item) => item.toLowerCase() === next.toLowerCase())) return;
    onChange([...values, next].join(", "));
    setDraft("");
    setOpen(false);
    setActiveValue(null);
  }

  return (
    <div className="space-y-2 text-[15px] font-semibold text-[color:var(--workspace-ink)]">
      <label htmlFor={fieldPath ? portfolioFieldAnchor(fieldPath) : listId + "-input"}><FieldLabel label={label} requirement={requirement} audience={audience} /></label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1" onKeyDown={(event) => {
          if (event.key === "Escape" && expanded) {
            event.preventDefault(); event.stopPropagation();
            event.currentTarget.querySelector("input")?.focus();
            setOpen(false); setActiveValue(null);
          }
        }} onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActiveValue(null); }
        }}>
          <input id={fieldPath ? portfolioFieldAnchor(fieldPath) : listId + "-input"} aria-invalid={Boolean(externalError)} aria-describedby={fieldDescriptionIds(listId, hint, audience, externalError ? listId + "-error" : undefined)}
            name={label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}
            autoComplete="off" aria-label={label} role="combobox" aria-autocomplete="list"
            aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-activedescendant={activeId}
            value={draft} disabled={atLimit}
            onFocus={() => { setOpen(true); setActiveValue(null); }}
            onChange={(event) => { setDraft(event.target.value); setOpen(true); setActiveValue(null); }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length) {
                event.preventDefault();
                const index = !expanded || activeIndex < 0
                  ? event.key === "ArrowDown" ? 0 : suggestions.length - 1
                  : (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length;
                setOpen(true); setActiveValue(suggestions[index].value);
              } else if (event.key === "Enter") {
                event.preventDefault(); addValue(expanded && activeIndex >= 0 ? suggestions[activeIndex].value : undefined);
              } else if (event.key === "Escape" && open) {
                event.preventDefault(); event.stopPropagation(); setOpen(false); setActiveValue(null);
              } else if (event.key === "Tab") { setOpen(false); setActiveValue(null); }
            }}
            placeholder={atLimit ? "Selection limit reached" : "Search or type to add…"} className="biodata-field min-h-12 w-full" />
          {expanded && <ul id={listId} role="listbox" aria-label={label + " suggestions"} className="location-suggestions">
            {suggestions.map((item, index) => <li key={item.value} role="none">
              <button id={listId + "-option-" + index} type="button" role="option" tabIndex={-1}
                aria-selected={index === activeIndex} onMouseDown={event => event.preventDefault()}
                onMouseMove={() => setActiveValue(item.value)} onClick={() => addValue(item.value)}
                className="location-suggestion">{item.label}</button>
            </li>)}
          </ul>}
        </div>
        <button type="button" disabled={atLimit} onClick={() => addValue()} className="workspace-focus min-h-12 rounded-lg border border-[color:var(--workspace-border)] bg-[var(--workspace-surface)] px-6 text-sm font-semibold text-[color:var(--workspace-ink)] hover:bg-[color:var(--workspace-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50">Add</button>
      </div>
      <FieldHelp id={listId} hint={hint} audience={audience} />
      {externalError && <p id={listId + "-error"} role="alert" className="text-sm font-normal text-[var(--ui-danger)]">{externalError}</p>}
      {maxItems !== undefined && <p className="text-xs font-normal text-[color:var(--workspace-ink-muted)]" aria-live="polite">{values.length} of {maxItems} selected</p>}
      {values.length > 0 && <div className="flex flex-wrap gap-2" aria-label={label + " selected"}>
        {values.map(item => <button key={item} type="button" onClick={() => onChange(values.filter(valueItem => valueItem !== item).join(", "))}
          className="workspace-focus inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--workspace-border)] bg-[var(--workspace-surface-muted)] px-4 text-sm font-medium text-[var(--workspace-ink)]"
          aria-label={"Remove " + item}>{item}<span aria-hidden="true">×</span></button>)}
      </div>}
    </div>
  );
}

function parseRange(value: string, options: BlueprintOption[]) {
  const allowed = new Set(options.filter((item) => item.value).map((item) => item.value));
  const [minimum = "", maximum = ""] = value.split(/\s*(?:–|—|\bto\b|-)\s*/i, 2);
  return {
    minimum: allowed.has(minimum) ? minimum : "",
    maximum: allowed.has(maximum) ? maximum : "",
  };
}

function updateRange(range: { minimum: string; maximum: string }, boundary: "minimum" | "maximum", nextValue: string, options: BlueprintOption[]) {
  let minimum = boundary === "minimum" ? nextValue : range.minimum;
  let maximum = boundary === "maximum" ? nextValue : range.maximum;
  const order = new Map(options.map((item, index) => [item.value, index]));
  if (minimum && maximum && (order.get(minimum) ?? 0) > (order.get(maximum) ?? 0)) {
    if (boundary === "minimum") maximum = minimum;
    else minimum = maximum;
  }
  return minimum || maximum ? `${minimum}–${maximum}` : "";
}
