"use client";

import { ThemeSwitch } from "@/components/theme/ThemeSwitch";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  type Portfolio,
  type PortfolioData,
  type PortfolioHoroscope,
  type PortfolioMedia,
  type PortfolioMediaVisibility,
  normalizePortfolioPrivacyMode,
} from "@/types/portfolio";
import type { PortfolioApiFailure } from "@/features/portfolio/client/portfolio-dashboard.api";
import type {
  AccessAuditEvent,
  AccessGrant,
  PortfolioAccessSummary,
} from "@/features/access/server/access.contract";
import {
  isShareablePrimaryPhoto,
  MAX_PORTFOLIO_PHOTOS,
} from "@/features/media/portfolio-photo";
import {
  BlueprintForm,
  type PortfolioEditorSection,
} from "@/components/portfolio/BlueprintForm";
import { IdentityVerificationDashboard } from "@/features/identity-verification/client/identity-verification-dashboard";
import {
  Eye,
  Clock,
  Edit3,
  Share2,
  LogOut,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  LockKeyhole,
  PanelRightOpen,
  ImagePlus,
  Images,
  Trash2,
  Crown,
  Upload,
  FileText,
  ExternalLink,
  ShieldCheck,
  Inbox,
  History,
  UserRoundCheck,
  Settings,
  CheckCircle2,
  Circle,
  ArrowLeft,
} from "lucide-react";
import { normalizePortfolioName } from "@/features/portfolio/name";
import type { PilotAccessState } from "@/features/pilot-access/server/pilot-access.contract";
import type { DashboardInterest } from "@/features/interest/server/interest-dashboard.contract";
import type { OwnerBrokerIntroductionResponse } from "@/features/broker-introductions/server/broker-introduction.contract";
import { calculatePortfolioCompletion } from "@/features/portfolio/readiness";
import {
  PORTFOLIO_VIEW_LABELS,
  publicIntroductionLabel,
} from "@/features/portfolio/template";
import {
  EMPTY_PUBLICATION_READINESS,
  type PublicationReadiness,
} from "@/features/portfolio/server/publication-readiness.contract";

interface Props {
  portfolio: Portfolio | null;
  canCreatePortfolio: boolean;
  pilotAccessState?: PilotAccessState | null;
  viewCount: number;
  userEmail: string;
  shareUrl: string | null;
  isExpired: boolean;
  daysLeft: number | null;
  media: PortfolioMedia[];
  mediaUrls?: Record<string, string>;
  horoscope?: PortfolioHoroscope | null;
  initialEditorOpen?: boolean;
  interests?: DashboardInterest[];
  accessSummary?: PortfolioAccessSummary;
  publicationReadiness?: PublicationReadiness;
  brokerIntroductionResponses?: OwnerBrokerIntroductionResponse[];
}

const EMPTY_ACCESS_SUMMARY: PortfolioAccessSummary = { grants: [], events: [] };

export default function DashboardClient({
  portfolio,
  canCreatePortfolio,
  pilotAccessState = null,
  viewCount,
  userEmail,
  shareUrl,
  isExpired,
  daysLeft,
  media,
  mediaUrls: initialMediaUrls = {},
  horoscope = null,
  initialEditorOpen = false,
  interests = [],
  accessSummary = EMPTY_ACCESS_SUMMARY,
  publicationReadiness = EMPTY_PUBLICATION_READINESS,
  brokerIntroductionResponses = [],
}: Props) {
  const [copied, setCopied] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [formOpen, setFormOpen] = useState(initialEditorOpen && canCreatePortfolio);
  const [draftData, setDraftData] = useState<PortfolioData>(() =>
    normalizePortfolioData(portfolio?.draft_data, portfolio?.privacy_mode)
  );
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<"saved" | "unsaved" | "saving">("saved");
  const [publishing, setPublishing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rotatingLink, setRotatingLink] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [portfolioMedia, setPortfolioMedia] = useState(media);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>(initialMediaUrls);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [portfolioHoroscope, setPortfolioHoroscope] = useState(horoscope);
  const [uploadingHoroscope, setUploadingHoroscope] = useState(false);
  const [activePortfolioId, setActivePortfolioId] = useState(portfolio?.id ?? null);
  const [interestItems, setInterestItems] = useState(interests);
  const [accessGrants, setAccessGrants] = useState(accessSummary.grants);
  const [readinessState, setReadinessState] = useState(publicationReadiness);
  const accessEvents = accessSummary.events;
  const photoInputRef = useRef<HTMLInputElement>(null);
  const horoscopeInputRef = useRef<HTMLInputElement>(null);
  const reviewPublishRef = useRef<HTMLButtonElement>(null);
  const draftRevisionRef = useRef(0);
  const lastAutosaveAttemptRevisionRef = useRef(-1);
  const sectionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const disclosedCategories = fullViewDisclosureCategories(
    draftData,
    portfolioMedia,
    portfolioHoroscope
  );
  const completion = calculatePortfolioCompletion(
    draftData,
    portfolioMedia.some(isShareablePrimaryPhoto)
  );
  const initialEditorSection = (
    readinessState.lastEditorSection || completion.nextEditorSection
  ) as PortfolioEditorSection;
  const linkStatisticState = !portfolio?.is_published
    ? undefined
    : isExpired || (daysLeft !== null && daysLeft <= 0)
      ? "expired"
      : daysLeft !== null && daysLeft <= 7
        ? "warning"
        : "active";

  useEffect(() => {
    if (draftSaveState === "saved") return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [draftSaveState]);

  useEffect(() => {
    if (!reviewOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    reviewPublishRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !publishing) {
        setReviewOpen(false);
        return;
      }
      trapDialogFocus(event, reviewPublishRef.current?.closest<HTMLElement>("[role='dialog']") || null);
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [reviewOpen, publishing]);

  useEffect(() => {
    if (draftSaveState !== "unsaved" || !canCreatePortfolio) return;
    const revision = draftRevisionRef.current;
    if (lastAutosaveAttemptRevisionRef.current === revision) return;
    const timer = window.setTimeout(() => {
      lastAutosaveAttemptRevisionRef.current = revision;
      void persistDashboardDraft({ refresh: false, silent: true });
    }, 1400);
    return () => window.clearTimeout(timer);
    // The save operation intentionally uses the latest render's draft snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftData, draftSaveState, canCreatePortfolio]);

  useEffect(() => () => {
    if (sectionSaveTimerRef.current) clearTimeout(sectionSaveTimerRef.current);
  }, []);

  function closePortfolioEditor() {
    if (
      draftSaveState !== "saved"
      && !confirm("You have changes that are not saved. Close the form and keep them only on this screen?")
    ) return;
    setFormOpen(false);
  }

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareWhatsApp() {
    if (!shareUrl) return;
    const profileName = portfolio?.published_data?.personal?.name
      || portfolio?.draft_data?.personal?.name
      || "this profile";
    const text = encodeURIComponent(
      `Sharing ${profileName}'s Nakshatra wedding portfolio.\n\n`
      + `View the introduction: ${shareUrl}\n\n`
      + "This link opens the selected public Introduction. The Complete Portfolio is shared only after the profile owner approves an introduction."
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  /**
   * Maps a feature API failure to a session redirect or an actionable dashboard message.
   * Input: a normalized client API failure. Output: true when navigation has replaced the current dashboard flow.
   */
  function handlePortfolioApiFailure(failure: PortfolioApiFailure): boolean {
    if (
      failure.error.code === "AUTH_SESSION_MISSING"
      || failure.error.code === "AUTH_SESSION_INVALID"
      || failure.error.code === "AUTH_SESSION_REVOKED"
    ) {
      const reason = failure.error.code === "AUTH_SESSION_REVOKED" ? "session_revoked" : "session_expired";
      router.push(`/login?error=${reason}`);
      return true;
    }

    setDraftError(failure.error.message);
    return false;
  }

  async function renewLink() {
    if (!portfolio) return;
    if (!confirm("Renew link for 30 days?")) return;
    setRenewing(true);
    setDraftError(null);
    try {
      const { renewPortfolioLinkRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await renewPortfolioLinkRequest();
      if (!result.ok) {
        handlePortfolioApiFailure(result);
        return;
      }
      router.refresh();
    } finally {
      setRenewing(false);
    }
  }

  /** Confirms the reviewed disclosure when needed, then atomically refreshes the public snapshot from the draft. */
  async function publishPortfolio() {
    setPublishing(true);
    setDraftError(null);
    try {
      if (!readinessState.disclosureConfirmed) {
        const { updatePublicationProgressRequest } = await import(
          "@/features/portfolio/client/portfolio-dashboard.api"
        );
        const disclosureResult = await updatePublicationProgressRequest({
          action: "confirm_disclosure",
          value: "publication-disclosure-v1",
        });
        if (!disclosureResult.ok) return void handlePortfolioApiFailure(disclosureResult);
        setReadinessState(disclosureResult.data.readiness);
      }

      const { publishPortfolioRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await publishPortfolioRequest(draftData);
      if (!result.ok) return void handlePortfolioApiFailure(result);
      setFormOpen(false);
      setReviewOpen(false);
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  /** Replaces the active public URL after the owner confirms that the previous link should stop working. */
  async function rotateLink() {
    if (!confirm("Rotate this link? The existing portfolio URL will stop working immediately.")) return;
    setRotatingLink(true);
    setDraftError(null);
    try {
      const { rotatePortfolioLinkRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await rotatePortfolioLinkRequest();
      if (!result.ok) return void handlePortfolioApiFailure(result);
      router.refresh();
    } finally {
      setRotatingLink(false);
    }
  }

  /** Removes public access without deleting the owner draft, media, or dashboard configuration. */
  async function unpublishPortfolio() {
    if (!confirm("Unpublish this portfolio? Anyone using the current link will no longer be able to view it.")) return;
    setUnpublishing(true);
    setDraftError(null);
    try {
      const { unpublishPortfolioRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await unpublishPortfolioRequest();
      if (!result.ok) return void handlePortfolioApiFailure(result);
      router.refresh();
    } finally {
      setUnpublishing(false);
    }
  }

  async function handleSignOut() {
    const { clearLocalAccountSession } = await import("@/features/account/client/account.api");
    await clearLocalAccountSession();
    router.push("/");
  }

  function updateSection<K extends keyof PortfolioData>(
    key: K,
    value: PortfolioData[K]
  ) {
    draftRevisionRef.current += 1;
    setDraftData((current) => ({ ...current, [key]: value }));
    setDraftSaveState("unsaved");
    setReadinessState((current) => ({ ...current, disclosureConfirmed: false }));
  }

  async function persistDashboardDraft({
    refresh = true,
    silent = false,
  }: { refresh?: boolean; silent?: boolean } = {}) {
    const savingRevision = draftRevisionRef.current;
    setSavingDraft(true);
    setDraftSaveState("saving");
    setDraftError(null);
    try {
      const { saveDashboardDraftRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await saveDashboardDraftRequest(draftData);
      if (!result.ok) {
        setDraftSaveState("unsaved");
        handlePortfolioApiFailure(result);
        return false;
      }
      setActivePortfolioId(result.data.portfolioId);
      if (draftRevisionRef.current === savingRevision) setDraftSaveState("saved");
      if (refresh) router.refresh();
      return true;
    } catch {
      setDraftSaveState("unsaved");
      if (!silent) {
        setDraftError("Your changes could not be saved. Please check your connection and try again.");
      }
      return false;
    } finally {
      setSavingDraft(false);
    }
  }

  function saveDashboardDraft() {
    return persistDashboardDraft();
  }

  async function reviewPortfolio() {
    const saved = await persistDashboardDraft({ refresh: false });
    if (!saved) return;
    await markPreviewed();
    setFormOpen(false);
    setReviewOpen(true);
  }

  async function markPreviewed() {
    const { updatePublicationProgressRequest } = await import(
      "@/features/portfolio/client/portfolio-dashboard.api"
    );
    const result = await updatePublicationProgressRequest({ action: "previewed" });
    if (!result.ok) return void handlePortfolioApiFailure(result);
    setReadinessState(result.data.readiness);
  }

  async function openEarlyPreview() {
    const saved = await persistDashboardDraft({ refresh: false });
    if (!saved) return;
    await markPreviewed();
    window.open("/preview", "_blank", "noopener,noreferrer");
  }

  function rememberEditorSection(section: PortfolioEditorSection) {
    setReadinessState((current) => ({ ...current, lastEditorSection: section }));
    if (sectionSaveTimerRef.current) clearTimeout(sectionSaveTimerRef.current);
    sectionSaveTimerRef.current = setTimeout(async () => {
      const { updatePublicationProgressRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await updatePublicationProgressRequest({
        action: "editor_section",
        value: section,
      });
      if (result.ok) {
        setReadinessState((current) => ({
          ...current,
          lastEditorSection: result.data.readiness.lastEditorSection,
        }));
      }
    }, 300);
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    if (!activePortfolioId) {
      setDraftError("Save your profile details before uploading photos.");
      return;
    }

    const availableSlots = Math.max(0, MAX_PORTFOLIO_PHOTOS - portfolioMedia.length);
    const selectedFiles = Array.from(files).slice(0, availableSlots);
    if (!selectedFiles.length) {
      setDraftError("Your gallery already has the maximum of eight photos.");
      return;
    }

    setUploadingMedia(true);
    setDraftError(null);
    try {
      const { uploadPortfolioPhotoRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const uploaded: PortfolioMedia[] = [];
      const uploadedUrls: Record<string, string> = {};
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("photo", file);
        formData.append("portfolioId", activePortfolioId);
        const result = await uploadPortfolioPhotoRequest(formData);
        if (!result.ok) return void handlePortfolioApiFailure(result);
        uploaded.push(result.data.media);
        if (result.data.previewUrl) {
          uploadedUrls[result.data.media.id] = result.data.previewUrl;
        }
      }
      setPortfolioMedia((current) => [...current, ...uploaded]);
      setMediaUrls((current) => ({ ...current, ...uploadedUrls }));
      setReadinessState((current) => ({ ...current, disclosureConfirmed: false }));
      router.refresh();
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Photo upload failed.");
    } finally {
      setUploadingMedia(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function updatePhoto(
    mediaId: string,
    changes: Partial<Pick<PortfolioMedia, "visibility" | "media_type" | "alt_text">>
  ) {
    const { updatePortfolioPhotoRequest } = await import(
      "@/features/portfolio/client/portfolio-dashboard.api"
    );
    const result = await updatePortfolioPhotoRequest(mediaId, changes);
    if (!result.ok) return void handlePortfolioApiFailure(result);
    setPortfolioMedia((current) =>
      current.map((item) => {
        if (item.id === result.data.media.id) return result.data.media;
        if (changes.media_type === "hero" && item.media_type === "hero") {
          return { ...item, media_type: "gallery" };
        }
        return item;
      })
    );
    setReadinessState((current) => ({ ...current, disclosureConfirmed: false }));
  }

  async function deletePhoto(mediaId: string) {
    const { deletePortfolioPhotoRequest } = await import(
      "@/features/portfolio/client/portfolio-dashboard.api"
    );
    const result = await deletePortfolioPhotoRequest(mediaId);
    if (!result.ok) return void handlePortfolioApiFailure(result);
    setPortfolioMedia((current) => current.filter((item) => item.id !== mediaId));
    setMediaUrls((current) => Object.fromEntries(
      Object.entries(current).filter(([id]) => id !== mediaId)
    ));
    setReadinessState((current) => ({ ...current, disclosureConfirmed: false }));
  }

  async function uploadHoroscopeFile(file: File | null, language: string) {
    if (!file) return;
    if (!activePortfolioId) {
      setDraftError("Save your profile details before attaching a horoscope.");
      return;
    }
    setUploadingHoroscope(true);
    setDraftError(null);
    try {
      const { uploadHoroscopeRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const formData = new FormData();
      formData.append("horoscope", file);
      formData.append("portfolioId", activePortfolioId);
      formData.append("language", language);
      const result = await uploadHoroscopeRequest(formData);
      if (!result.ok) return void handlePortfolioApiFailure(result);
      setPortfolioHoroscope(result.data.horoscope);
      setReadinessState((current) => ({ ...current, disclosureConfirmed: false }));
      router.refresh();
    } finally {
      setUploadingHoroscope(false);
      if (horoscopeInputRef.current) horoscopeInputRef.current.value = "";
    }
  }

  function reviewHoroscope() {
    if (!portfolioHoroscope) return;
    window.open("/api/portfolio-horoscope/view", "_blank", "noopener,noreferrer");
  }

  async function removeHoroscope() {
    if (!portfolioHoroscope || !confirm("Remove this horoscope attachment? Approved viewers will lose access immediately.")) return;
    const { deleteHoroscopeRequest } = await import(
      "@/features/portfolio/client/portfolio-dashboard.api"
    );
    const result = await deleteHoroscopeRequest(portfolioHoroscope.id);
    if (!result.ok) return void handlePortfolioApiFailure(result);
    setPortfolioHoroscope(null);
    setReadinessState((current) => ({ ...current, disclosureConfirmed: false }));
    router.refresh();
  }

  return (
    <div className="dashboard-shell flex flex-1 flex-col">
      <header className="dashboard-header px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-lg font-bold tracking-[0.12em]">NAKSHATRA</h1>
          <div className="flex items-center gap-3">
            <ThemeSwitch />
            <span className="hidden text-sm text-[light-dark(#64748b,var(--app-dark-muted))] sm:inline">
              {userEmail}
            </span>
            <Link
              href="/account"
              aria-label="Account and privacy"
              title="Account and privacy"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[light-dark(#475569,var(--app-dark-muted))] transition-colors hover:bg-[light-dark(#f1f5f9,var(--app-dark-canvas))]"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[light-dark(#475569,var(--app-dark-muted))] transition-colors hover:bg-[light-dark(#f1f5f9,var(--app-dark-canvas))]"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-6">
          {!canCreatePortfolio && !portfolio ? (
            <section className="dashboard-glass dashboard-onboarding flex flex-col items-center gap-6 px-6 py-12 text-center sm:px-12">
              <div className="rounded-full bg-[light-dark(#dcebe5,var(--app-dark-success-surface))] p-4">
                <LockKeyhole className="h-7 w-7 text-[light-dark(#315f57,var(--app-dark-accent))]" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[light-dark(#477b77,var(--app-dark-accent))]">
                  Private beta testing
                </p>
                <h2 className="mt-2 text-3xl font-medium text-[light-dark(#18272e,var(--app-dark-ink))]">
                  Portfolio creation is currently invite-only.
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-[light-dark(#475569,var(--app-dark-muted))]">
                  New portfolio creation is closed while we prepare for launch. You can join the waitlist for updates, or continue using portfolio links shared with you.
                </p>
              </div>
              {pilotAccessState?.application?.status === "pending" ? (
                <div className="rounded-xl border border-[light-dark(#c9bc91,var(--app-dark-border))] bg-[light-dark(#f4efdf,var(--app-dark-surface-soft))] px-4 py-3 text-sm text-[light-dark(#725d2b,var(--app-dark-gold))]">
                  You are on the Nakshatra launch waitlist. This does not provide portfolio creation access.
                </div>
              ) : pilotAccessState?.application?.status === "declined" ? (
                <div className="rounded-xl border border-[light-dark(#d6aaaa,var(--app-dark-border))] bg-[light-dark(#fff3f0,var(--app-dark-canvas))] px-4 py-3 text-sm text-[light-dark(#873a3a,var(--app-dark-danger))]">
                  Creator access is not available for this account yet. Your viewer access remains active.
                </div>
              ) : pilotAccessState?.application?.status === "revoked" ? (
                <div className="rounded-xl border border-[light-dark(#d6aaaa,var(--app-dark-border))] bg-[light-dark(#fff3f0,var(--app-dark-canvas))] px-4 py-3 text-sm text-[light-dark(#873a3a,var(--app-dark-danger))]">
                  Creator access for this account has been paused. Your saved information remains protected.
                </div>
              ) : (
                <Link href="/pilot-access" className="dashboard-primary-action">
                  Join the waitlist
                </Link>
              )}
              <Link href="/" className="text-sm font-semibold text-[light-dark(#315f57,var(--app-dark-accent))]">
                Learn about the private beta
              </Link>
            </section>
          ) : !portfolio?.is_published ? (
            <div className="dashboard-glass dashboard-onboarding flex flex-col items-center gap-6 px-6 py-12 text-center sm:px-12">
              <div className="rounded-full bg-[light-dark(#dcebe5,var(--app-dark-success-surface))] p-4">
                <Edit3 className="h-7 w-7 text-[light-dark(#315f57,var(--app-dark-accent))]" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[light-dark(#477b77,var(--app-dark-accent))]">
                  Start your portfolio
                </p>
                <h2 className="mt-2 text-3xl font-medium text-[light-dark(#18272e,var(--app-dark-ink))]">
                  Let&apos;s build one clear introduction.
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-[light-dark(#475569,var(--app-dark-muted))]">
                  Begin with the main details. Add photos, family information, and your horoscope when you are ready.
                </p>
              </div>
              {canCreatePortfolio ? (
                <button
                  type="button"
                  onClick={() => completion.readyToPublish ? setReviewOpen(true) : setFormOpen(true)}
                  className="dashboard-primary-action"
                >
                  <PanelRightOpen className="h-4 w-4" />
                  {completion.readyToPublish
                    ? "Review and publish"
                    : portfolio
                      ? "Continue portfolio"
                      : "Start with the basics"}
                </button>
              ) : (
                <p className="rounded-xl border border-[light-dark(#477b7740,var(--app-dark-border))] bg-[light-dark(#dcebe580,var(--app-dark-success-surface))] px-4 py-3 text-sm text-[light-dark(#315f57,var(--app-dark-accent))]">
                  Creator access is paused for this account. Your saved portfolio and history remain available.
                </p>
              )}
              <p className="text-sm text-[light-dark(#64748b,var(--app-dark-muted))]">Save your work and continue later. Nothing is published until you complete the final review.</p>
            </div>
          ) : (
              <section className="dashboard-welcome">
                <div>
                  <span className={`dashboard-status ${isExpired ? "is-expired" : ""}`}>{isExpired ? "Link expired" : "Portfolio active"}</span>
                  <h2>Your portfolio is ready to share.</h2>
                  <p>Review new interests, see recent activity, or update your portfolio.</p>
                </div>
                <div className="dashboard-welcome-actions">
                  {canCreatePortfolio && (
                    <button type="button" onClick={() => setFormOpen(true)} className="dashboard-secondary-action">
                      <Edit3 className="h-4 w-4" /> Portfolio details
                    </button>
                  )}
                  {isExpired
                    ? canCreatePortfolio && (
                      <button type="button" onClick={renewLink} disabled={renewing} className="dashboard-primary-action">
                        <RefreshCw className={`h-4 w-4 ${renewing ? "animate-spin" : ""}`} />
                        {renewing ? "Renewing link..." : "Renew public link"}
                      </button>
                    )
                    : <button type="button" onClick={shareWhatsApp} className="dashboard-primary-action"><Share2 className="h-4 w-4" /> Share portfolio</button>}
                </div>
              </section>
          )}

          {(canCreatePortfolio || portfolio) && <>
          {canCreatePortfolio && (
            <CreatorReadinessTracker
              completion={completion}
              readiness={readinessState}
              draftSaveState={draftSaveState}
              onPreview={openEarlyPreview}
            />
          )}
          <RelationshipLifecycle
            interests={interestItems}
            grants={accessGrants}
            events={accessEvents}
            disclosedCategories={disclosedCategories}
            onDecision={(id, status) => {
              setInterestItems((current) =>
                current.map((interest) =>
                  interest.id === id ? { ...interest, status } : interest
                )
              );
              router.refresh();
            }}
            onGrantChange={(grantId, action, expiresAt) => {
              setAccessGrants((current) => current.map((grant) =>
                grant.id === grantId
                  ? action === "revoke"
                    ? { ...grant, status: "revoked", revokedAt: new Date().toISOString() }
                    : { ...grant, status: "active", expiresAt: expiresAt || grant.expiresAt }
                  : grant
              ));
              router.refresh();
            }}
          />
          {brokerIntroductionResponses.length > 0 && <section className="dashboard-glass p-5 sm:p-6" aria-labelledby="broker-introduction-responses-heading">
            <div className="dashboard-section-heading">
              <div><h2 id="broker-introduction-responses-heading">Broker introduction responses</h2><p>Responses to introductions shared under your standing broker mandate.</p></div>
              <span>{brokerIntroductionResponses.length}</span>
            </div>
            <div className="mt-4 grid gap-3">{brokerIntroductionResponses.map((response) => <article key={response.introductionRef} className="rounded-xl border border-[color:var(--workspace-border)] p-4">
              <strong className="capitalize">{response.response}</strong>
              <p className="mt-1 text-sm text-[color:var(--workspace-ink-muted)]">{response.recipientLabel} · shared through {response.brokerName} · {new Date(response.respondedAt).toLocaleDateString()}</p>
              {response.comment && <p className="mt-3 text-sm">“{response.comment}”</p>}
            </article>)}</div>
          </section>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="dashboard-glass dashboard-stat-card p-4">
                  <div className="flex items-center gap-2 text-[light-dark(#64748b,var(--app-dark-muted))]">
                    <Eye className="h-4 w-4" />
                    <span className="text-sm font-medium">Portfolio views</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-[light-dark(#18272e,var(--app-dark-ink))]">{viewCount}</p>
                </div>
                <div className="dashboard-glass dashboard-stat-card p-4">
                  <div className="flex items-center gap-2 text-[light-dark(#64748b,var(--app-dark-muted))]">
                    <Inbox className="h-4 w-4" />
                    <span className="text-sm font-medium">Interests received</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-[light-dark(#18272e,var(--app-dark-ink))]">{interests.length}</p>
                  <p className="mt-1 text-sm text-[light-dark(#64748b,var(--app-dark-muted))]">{interestItems.filter((item) => item.status === "new" || item.status === "pending_review").length} need a response</p>
                </div>
                <div
                  className="dashboard-glass dashboard-stat-card p-4"
                  data-link-state={linkStatisticState}
                >
                  <div className="flex items-center gap-2 text-[light-dark(#64748b,var(--app-dark-muted))]">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">Public link</span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-[light-dark(#18272e,var(--app-dark-ink))]">
                    {isExpired
                      ? "Expired"
                      : portfolio?.is_published && daysLeft !== null
                      ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
                      : "Not published"}
                  </p>
                </div>
              </div>

          {portfolio?.is_published && shareUrl ? (
                <div className="dashboard-glass p-4">
                  <p className="mb-3 text-sm font-semibold text-[light-dark(#18272e,var(--app-dark-ink))]">Portfolio link</p>
                  <div className="dashboard-share-link-row">
                    <code className="flex-1 overflow-x-auto rounded-lg bg-[light-dark(#f1f5f9,var(--app-dark-canvas))] px-3 py-2 text-sm text-[light-dark(#475569,var(--app-dark-muted))]">
                      {shareUrl}
                    </code>
                    <button
                      onClick={copyLink}
                      className="dashboard-secondary-action"
                    >
                      {copied ? "Link copied" : "Copy link"}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canCreatePortfolio && (
                      <button
                        onClick={rotateLink}
                        disabled={rotatingLink}
                        className="dashboard-secondary-action"
                      >
                        <RotateCcw className={`h-4 w-4 ${rotatingLink ? "animate-spin" : ""}`} />
                        Rotate link
                      </button>
                    )}
                    <button
                      onClick={unpublishPortfolio}
                      disabled={unpublishing}
                      className="dashboard-danger-action"
                    >
                      <LockKeyhole className="h-4 w-4" />
                      {unpublishing ? "Unpublishing..." : "Unpublish"}
                    </button>
                  </div>
                </div>
          ) : (
            <div className="dashboard-glass p-4">
              <p className="text-sm font-semibold text-[light-dark(#18272e,var(--app-dark-ink))]">Public sharing is off</p>
              <p className="mt-1 text-sm leading-6 text-[light-dark(#475569,var(--app-dark-muted))]">
                Your saved portfolio, interests, access history, and view totals remain available here. Review and publish when you are ready to create a shareable link.
              </p>
            </div>
          )}

          {portfolio && <div className="flex flex-wrap gap-3">
                <Link
                  href="/preview"
                  className="dashboard-secondary-action"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview public Introduction
                </Link>
                <Link
                  href="/approved-preview"
                  className="dashboard-secondary-action"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Preview Complete Portfolio
                </Link>
          </div>}
          </>}
          </div>
          {canCreatePortfolio && portfolio?.candidate_id ? <div className="mt-6"><IdentityVerificationDashboard candidateId={portfolio.candidate_id} /></div> : null}
        </div>
      </main>

      {canCreatePortfolio && reviewOpen && (
        <div className="fixed inset-0 z-[60] bg-[#18272e]/70 p-3 backdrop-blur-sm sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="portfolio-review-heading"
            className="mx-auto flex h-full w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl bg-[light-dark(#f8f6f0,var(--app-dark-canvas))] text-[light-dark(#18272e,var(--app-dark-ink))] shadow-2xl"
          >
            <header className="flex flex-none flex-col gap-4 border-b border-[light-dark(#e2e8f0,var(--app-dark-border))] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[light-dark(#477b77,var(--app-dark-accent))]">Review before publishing</p>
                <h2 id="portfolio-review-heading" className="mt-1 text-xl font-semibold">Check both views before publishing</h2>
                <p className="mt-1 text-sm text-[light-dark(#475569,var(--app-dark-muted))]">Your draft is saved. Open each preview in a new tab; nothing public changes from this review.</p>
              </div>
              <div className="app-header-actions"><ThemeSwitch /><button type="button" className="dashboard-secondary-action" disabled={publishing} onClick={() => { setReviewOpen(false); setFormOpen(true); }}>
                Back to editing
              </button></div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid gap-4 lg:grid-cols-2">
              <article className="flex flex-col rounded-xl border border-[light-dark(#e2e8f0,var(--app-dark-border))] bg-[light-dark(#ffffff,var(--app-dark-surface))] p-5">
                <div className="border-b border-[light-dark(#e2e8f0,var(--app-dark-border))] px-4 py-3">
                  <h3 className="font-semibold">{publicIntroductionLabel(normalizePortfolioPrivacyMode(draftData.privacy_mode))}</h3>
                  <p className="mt-1 text-xs text-[light-dark(#475569,var(--app-dark-muted))]">What anyone with the share link can see.</p>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-5 px-4 py-5">
                  <p className="text-sm leading-6 text-[light-dark(#475569,var(--app-dark-muted))]">Check the public introduction, primary photo and the details visible before approval.</p>
                  <a href="/preview" target="_blank" rel="noreferrer" className="dashboard-secondary-action w-full justify-center sm:w-fit">
                    <ExternalLink className="h-4 w-4" />
                    Open public Introduction
                  </a>
                </div>
              </article>
              <article className="flex flex-col rounded-xl border border-[light-dark(#e2e8f0,var(--app-dark-border))] bg-[light-dark(#ffffff,var(--app-dark-surface))] p-5">
                <div className="border-b border-[light-dark(#e2e8f0,var(--app-dark-border))] px-4 py-3">
                  <h3 className="font-semibold">{PORTFOLIO_VIEW_LABELS.complete} · Approved people only</h3>
                  <p className="mt-1 text-xs text-[light-dark(#475569,var(--app-dark-muted))]">What a verified person receives after your approval.</p>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-5 px-4 py-5">
                  <p className="text-sm leading-6 text-[light-dark(#475569,var(--app-dark-muted))]">Check protected details and confirm that nothing appears in the Complete Portfolio unexpectedly.</p>
                  <a href="/approved-preview" target="_blank" rel="noreferrer" className="dashboard-secondary-action w-full justify-center sm:w-fit">
                    <ExternalLink className="h-4 w-4" />
                    Open Complete Portfolio
                  </a>
                </div>
              </article>
              </div>

              <section aria-labelledby="publish-readiness-heading" className="mt-4 rounded-xl border border-[light-dark(#e2e8f0,var(--app-dark-border))] bg-[light-dark(#ffffff,var(--app-dark-surface))] p-5">
                <h3 id="publish-readiness-heading" className="font-semibold">What happens next</h3>
                <p className="mt-1 text-sm text-[light-dark(#475569,var(--app-dark-muted))]">Reviewing is always available. Publishing unlocks only after every required step below is complete.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <ReviewRequirement complete={completion.readyToPublish} label="Required portfolio details complete" pendingLabel={`${completion.missing.length} required item${completion.missing.length === 1 ? "" : "s"} missing`} />
                  <ReviewRequirement complete={readinessState.verificationStatus === "verified"} label="Identity verification complete" pendingLabel="Verification integration coming soon" />
                  <ReviewRequirement complete={readinessState.paymentActive} label="Active plan confirmed" pendingLabel="Plan payment integration coming soon" />
                  <ReviewRequirement complete={readinessState.disclosureConfirmed} label="Final disclosure confirmed" pendingLabel="Confirmed by the publish action below" />
                </div>
              </section>
            </div>

            <footer className="flex flex-none flex-col gap-3 border-t border-[light-dark(#e2e8f0,var(--app-dark-border))] bg-[light-dark(#fffdf8,var(--app-dark-surface))] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-sm font-semibold">Publishing creates or updates your public Introduction link.</p>
                <p className="mt-1 text-xs text-[light-dark(#475569,var(--app-dark-muted))]">The Complete Portfolio remains locked until you approve a verified interest request.</p>
                {draftError && <p className="dashboard-action-error mt-2" role="alert">{draftError}</p>}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button type="button" className="dashboard-secondary-action" disabled={publishing} onClick={() => setReviewOpen(false)}>Back to dashboard</button>
                <button
                  ref={reviewPublishRef}
                  type="button"
                  className="dashboard-primary-action"
                  disabled={
                    publishing
                    || !completion.readyToPublish
                    || readinessState.verificationStatus !== "verified"
                    || !readinessState.paymentActive
                  }
                  onClick={publishPortfolio}
                >
                  <Send className={`h-4 w-4 ${publishing ? "animate-pulse" : ""}`} />
                  {publishing
                    ? "Working..."
                    : !completion.readyToPublish
                      ? "Complete required details"
                      : readinessState.verificationStatus !== "verified"
                        ? "Verification required"
                        : !readinessState.paymentActive
                          ? "Payment coming soon"
                        : portfolio?.is_published
                          ? readinessState.disclosureConfirmed
                            ? "Publish reviewed changes"
                            : "Confirm & publish changes"
                          : readinessState.disclosureConfirmed
                            ? "Publish portfolio"
                            : "Confirm & publish portfolio"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {canCreatePortfolio && formOpen && (
        <div className="dashboard-editor fixed inset-0 z-50 bg-[#18272e]/45 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="portfolio-editor-heading" className="dashboard-editor-surface absolute inset-0 flex h-full w-full flex-col overflow-hidden shadow-2xl">
            <div className="flex-none border-b border-[light-dark(#e2e8f0,var(--app-dark-border))] px-4 py-4 sm:px-6 lg:px-8">
              <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 id="portfolio-editor-heading" className="text-lg font-semibold">Portfolio details</h2>
                    <span className={`dashboard-save-state is-${draftSaveState}`} aria-live="polite">
                      {draftSaveState === "saving"
                        ? "Saving..."
                        : draftSaveState === "saved"
                          ? portfolio?.is_published ? "Draft saved" : "Saved"
                          : "Changes not saved"}
                    </span>
                  </div>
                  <p className="text-sm text-[light-dark(#64748b,var(--app-dark-muted))]">
                    Complete what you know. Save your work and continue later.
                  </p>
                </div>
                <div className="app-header-actions"><ThemeSwitch /><button
                  type="button"
                  onClick={closePortfolioEditor}
                  className="dashboard-secondary-action flex-none"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to dashboard</span>
                  <span className="sm:hidden">Dashboard</span>
                </button></div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 [scrollbar-gutter:stable] sm:px-6 lg:px-8">
              <div className="mx-auto w-full max-w-[90rem]">
                <BlueprintForm
                  data={draftData}
                  onUpdate={updateSection}
                  initialSection={initialEditorSection}
                  onSectionChange={rememberEditorSection}
                  hasShareablePrimaryPhoto={portfolioMedia.some(isShareablePrimaryPhoto)}
                  photoManager={
                    <PhotoManager
                      media={portfolioMedia}
                      urls={mediaUrls}
                      uploading={uploadingMedia}
                      inputRef={photoInputRef}
                      onUpload={uploadPhotos}
                      onUpdate={updatePhoto}
                      onDelete={deletePhoto}
                    />
                  }
                  horoscopeManager={
                    <HoroscopeManager
                      horoscope={portfolioHoroscope}
                      uploading={uploadingHoroscope}
                      inputRef={horoscopeInputRef}
                      onUpload={uploadHoroscopeFile}
                      onReview={reviewHoroscope}
                      onDelete={removeHoroscope}
                    />
                  }
                />
              </div>
            </div>

            <div className="dashboard-editor-footer flex-none border-t border-[light-dark(#e2e8f0,var(--app-dark-border))] bg-[light-dark(#f3f0e8,var(--app-dark-surface-soft))] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
              <div className="mx-auto w-full max-w-[90rem]">
                {draftError && (
                  <div role="alert" className="mb-3 rounded-lg border border-[light-dark(#d8a7a1,var(--app-dark-border))] bg-[light-dark(#fff0ee,var(--app-dark-canvas))] px-4 py-3 text-sm text-[light-dark(#7f3535,var(--app-dark-danger))]">
                    <p className="font-semibold">We couldn&apos;t complete that action.</p>
                    <p className="mt-1 leading-5">{draftError}</p>
                    <p className="mt-1 leading-5">Your answers are still on this screen.</p>
                    {draftSaveState === "unsaved" && (
                      <button type="button" onClick={saveDashboardDraft} disabled={savingDraft} className="mt-2 min-h-10 rounded-lg border border-[light-dark(#b96a63,var(--app-dark-border))] bg-[light-dark(#ffffff,var(--app-dark-surface))] px-3 font-semibold text-[light-dark(#7f3535,var(--app-dark-danger))] hover:bg-[light-dark(#fff8f6,var(--app-dark-surface))]">
                        Try saving again
                      </button>
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="dashboard-editor-footer-copy text-sm leading-6 text-[light-dark(#64748b,var(--app-dark-muted))]">
                    {portfolio?.is_published
                      ? "Changes autosave as a draft. Review and publish to update what people see."
                      : "Changes autosave as a draft. Publishing creates the portfolio people can view."}
                  </p>
                  <div className="dashboard-editor-actions flex gap-2">
                    <button
                      type="button"
                      onClick={openEarlyPreview}
                      disabled={savingDraft || !completion.basicsComplete}
                      className="dashboard-secondary-action flex-1 sm:flex-none"
                    >
                      <Eye className="h-4 w-4" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={saveDashboardDraft}
                      disabled={savingDraft}
                      className="dashboard-editor-save-action dashboard-secondary-action flex-1 sm:flex-none"
                    >
                      <Save className="h-4 w-4" />
                      {savingDraft ? "Saving..." : "Save draft"}
                    </button>
                    <button
                      type="button"
                      onClick={reviewPortfolio}
                      disabled={publishing || savingDraft}
                      aria-label={savingDraft
                        ? "Saving..."
                        : portfolio?.is_published
                          ? "Review saved changes"
                          : "Review before publishing"}
                      className="dashboard-editor-review-action dashboard-primary-action flex-1 sm:flex-none"
                    >
                      <Send className={`h-4 w-4 ${publishing ? "animate-pulse" : ""}`} />
                      <span className="sm:hidden">{savingDraft ? "Saving..." : "Review changes"}</span>
                      <span className="hidden sm:inline">{savingDraft
                          ? "Saving..."
                          : portfolio?.is_published
                            ? "Review saved changes"
                            : "Review before publishing"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewRequirement({
  complete,
  label,
  pendingLabel,
}: {
  complete: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${complete ? "border-[light-dark(#b8d8ce,var(--app-dark-border))] bg-[light-dark(#eef7f3,var(--app-dark-canvas))]" : "border-[light-dark(#ded5bd,var(--app-dark-border))] bg-[light-dark(#faf7ed,var(--app-dark-canvas))]"}`}>
      {complete
        ? <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-[light-dark(#315f57,var(--app-dark-accent))]" aria-hidden="true" />
        : <Circle className="mt-0.5 h-5 w-5 flex-none text-[light-dark(#9a7b32,var(--app-dark-gold))]" aria-hidden="true" />}
      <div>
        <p className="text-sm font-semibold">{complete ? label : pendingLabel}</p>
        {!complete && <p className="mt-0.5 text-xs text-[light-dark(#475569,var(--app-dark-muted))]">{label}</p>}
      </div>
    </div>
  );
}

function CreatorReadinessTracker({
  completion,
  readiness,
  draftSaveState,
  onPreview,
}: {
  completion: ReturnType<typeof calculatePortfolioCompletion>;
  readiness: PublicationReadiness;
  draftSaveState: "saved" | "unsaved" | "saving";
  onPreview: () => void;
}) {
  const steps = [
    { label: "Basics", complete: completion.basicsComplete },
    { label: "Portfolio details", complete: completion.detailsComplete },
    { label: "Preview", complete: Boolean(readiness.previewedAt) },
    { label: "Ready to publish", complete: completion.readyToPublish },
    { label: "Verification", complete: readiness.verificationStatus === "verified", comingSoon: readiness.verificationStatus !== "verified" },
    { label: "Payment", complete: readiness.paymentActive, comingSoon: !readiness.paymentActive },
    { label: "Disclosure", complete: readiness.disclosureConfirmed },
    { label: "Published", complete: readiness.published },
  ];
  const nextStep = steps.find((step) => !step.complete);

  return (
    <section className="dashboard-glass p-4 sm:p-5" aria-labelledby="creator-readiness-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[light-dark(#477b77,var(--app-dark-accent))]">Your publishing journey</p>
          <h2 id="creator-readiness-heading" className="mt-1 text-xl font-semibold text-[light-dark(#18272e,var(--app-dark-ink))]">
            {completion.percentage}% complete
          </h2>
          <p className="mt-1 text-sm text-[light-dark(#475569,var(--app-dark-muted))]">
            {nextStep ? `Next: ${nextStep.label}` : "Your portfolio is published."}
            {draftSaveState === "saving" ? " · Saving changes…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {completion.basicsComplete && (
            <button type="button" onClick={onPreview} className="dashboard-secondary-action">
              <Eye className="h-4 w-4" /> Preview
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[light-dark(#e2e8f0,var(--app-dark-surface-soft))]" aria-hidden="true">
        <div className="h-full rounded-full bg-[#477b77] transition-[width]" style={{ width: `${completion.percentage}%` }} />
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Publication steps">
        {steps.map((step) => (
          <li key={step.label} className={`flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2 text-xs ${step.complete ? "border-[light-dark(#a9cfc3,var(--app-dark-border))] bg-[light-dark(#e8f3ef,var(--app-dark-surface-soft))] text-[light-dark(#315f57,var(--app-dark-accent))]" : "border-[light-dark(#e2e8f0,var(--app-dark-border))] bg-[light-dark(#ffffff,var(--app-dark-surface))] text-[light-dark(#475569,var(--app-dark-muted))]"}`}>
            {step.complete
              ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              : <Circle className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span>
              {step.label}
              {step.comingSoon ? <span className="block text-[10px] text-[light-dark(#94a3b8,var(--app-dark-muted))]">Coming soon</span> : null}
            </span>
          </li>
        ))}
      </ol>

      {!completion.readyToPublish && completion.missing.length > 0 ? (
        <p className="mt-4 text-xs leading-5 text-[light-dark(#64748b,var(--app-dark-muted))]">
          Still needed: {completion.missing.slice(0, 4).map((item) => item.label).join(", ")}
          {completion.missing.length > 4 ? ` and ${completion.missing.length - 4} more` : ""}.
        </p>
      ) : null}
    </section>
  );
}

function HoroscopeManager({
  horoscope,
  uploading,
  inputRef,
  onUpload,
  onReview,
  onDelete,
}: {
  horoscope: PortfolioHoroscope | null;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (file: File | null, language: string) => void;
  onReview: () => void;
  onDelete: () => void;
}) {
  const [language, setLanguage] = useState(horoscope?.language_label || "");
  const format = horoscope?.file_extension === "pdf"
    ? "PDF document"
    : horoscope?.file_extension === "doc" || horoscope?.file_extension === "docx"
      ? "Word document"
      : "Scanned image";

  return (
    <section className="mb-7 border-b border-white/10 pb-7">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <FileText className="h-4 w-4 text-[#f4d98f]" />
          Horoscope attachment
        </h3>
        <p className="mt-1 text-xs leading-5 text-white/55">
          One private scanned image. It appears only to signed-in viewers you approve and opens separately from the portfolio.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        onChange={(event) => onUpload(event.target.files?.[0] || null, language)}
      />

      {horoscope ? (
        <article className="rounded-xl border border-[#f4d98f]/20 bg-[#f4d98f]/[0.06] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#f4d98f]/25 bg-black/15 text-[#f4d98f]">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-white">Original horoscope</p>
                <p className="mt-1 text-xs text-white/55">
                  {[format, horoscope.language_label, formatBytes(horoscope.byte_size)].filter(Boolean).join(" · ")}
                </p>
                <p className={`mt-2 text-xs ${horoscope.published_at ? "text-emerald-300" : "text-[#f4d98f]"}`}>
                  {horoscope.file_extension !== "webp"
                    ? "Legacy document — replace it with a scanned image before sharing"
                    : horoscope.published_at
                      ? "Published for approved viewers"
                      : "Ready — publish or update the portfolio to share it"}
                </p>
              </div>
            </div>
            <LockKeyhole className="h-4 w-4 shrink-0 text-white/45" aria-label="Approved viewers only" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onReview} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs font-medium text-white hover:bg-white/10">
              <ExternalLink className="h-3.5 w-3.5" /> Review
            </button>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-50">
              <Upload className={`h-3.5 w-3.5 ${uploading ? "animate-pulse" : ""}`} /> Replace
            </button>
            <button type="button" onClick={onDelete} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-300/20 px-3 text-xs font-medium text-red-100 hover:bg-red-400/10">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        </article>
      ) : (
        <div className="rounded-xl border border-dashed border-white/15 p-4">
          <label className="block text-xs font-medium text-white/75" htmlFor="horoscope-language">Horoscope language (optional)</label>
          <input
            id="horoscope-language"
            value={language}
            maxLength={80}
            onChange={(event) => setLanguage(event.target.value)}
            placeholder="For example, Kannada"
            className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/15 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#f4d98f]/50"
          />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#f4d98f] px-4 text-sm font-semibold text-[light-dark(#17151c,var(--app-dark-ink))] hover:bg-[light-dark(#fff0b7,var(--app-dark-warning-surface))] disabled:opacity-50">
            <Upload className={`h-4 w-4 ${uploading ? "animate-pulse" : ""}`} />
            {uploading ? "Checking attachment..." : "Attach horoscope"}
          </button>
          <p className="mt-2 text-xs leading-5 text-white/50">Scanned JPG, PNG, WebP, or HEIC · up to 20MB</p>
        </div>
      )}
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function RelationshipLifecycle({
  interests,
  grants,
  events,
  disclosedCategories,
  onDecision,
  onGrantChange,
}: {
  interests: DashboardInterest[];
  grants: AccessGrant[];
  events: AccessAuditEvent[];
  disclosedCategories: string[];
  onDecision: (id: string, status: "approved" | "rejected" | "pending_review") => void;
  onGrantChange: (grantId: string, action: "renew" | "revoke", expiresAt?: string) => void;
}) {
  const waitingCount = interests.filter((interest) => interest.status === "new" || interest.status === "pending_review").length;

  return (
    <section className="dashboard-glass dashboard-relationship-lifecycle" aria-labelledby="relationship-lifecycle-heading">
      <div className="dashboard-section-heading">
        <div>
          <h2 id="relationship-lifecycle-heading">Introductions and access</h2>
          <p>Follow each relationship from introduction review through time-limited Complete Portfolio access.</p>
        </div>
        <span>{waitingCount} waiting</span>
      </div>
      <InterestInbox
        interests={interests}
        disclosedCategories={disclosedCategories}
        onDecision={onDecision}
      />
      <AccessControls grants={grants} events={events} onGrantChange={onGrantChange} />
    </section>
  );
}

function InterestInbox({
  interests,
  disclosedCategories,
  onDecision,
}: {
  interests: DashboardInterest[];
  disclosedCategories: string[];
  onDecision: (id: string, status: "approved" | "rejected" | "pending_review") => void;
}) {
  const newInterests = interests.filter((interest) => interest.status === "new" || interest.status === "pending_review");
  const rejectedInterests = interests.filter((interest) => interest.status === "rejected");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approvalCandidate, setApprovalCandidate] = useState<DashboardInterest | null>(null);
  const approvalTitleId = useId();
  const approvalConfirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!approvalCandidate) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    approvalConfirmRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && workingId === null) {
        setApprovalCandidate(null);
        return;
      }
      trapDialogFocus(event, approvalConfirmRef.current?.closest<HTMLElement>("[role='dialog']") || null);
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [approvalCandidate, workingId]);

  async function decide(interest: DashboardInterest, decision: "approved" | "rejected" | "reopened") {
    setWorkingId(interest.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/interest/${interest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setActionError(result.error || "This interest could not be updated.");
        return false;
      }
      onDecision(interest.id, decision === "reopened" ? "pending_review" : decision);
      return true;
    } catch {
      setActionError("This interest could not be updated. Please try again.");
      return false;
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="dashboard-relationship-stage dashboard-interest-inbox">
      <div className="dashboard-relationship-stage-heading">
        <div>
          <h3>Awaiting review</h3>
          <p>Review each person&apos;s verified contact, source, and context before sharing the Complete Portfolio.</p>
        </div>
        <span>{newInterests.length}</span>
      </div>
      {newInterests.length === 0 ? (
        <p className="dashboard-empty-state">New interests will appear here after viewers introduce themselves.</p>
      ) : (
        <div>
          {actionError && <p className="dashboard-action-error" role="alert">{actionError}</p>}
          {newInterests.map((interest) => {
            const profileFor = typeof interest.metadata?.profile_for === "string" ? interest.metadata.profile_for : "self";
            const location = formatInterestLocation(interest.metadata);
            const requesterPortfolioPath = interest.requester_portfolio_token
              ? `/p/${encodeURIComponent(interest.requester_portfolio_token)}`
              : null;
            const sourceLabel = interest.source_type === "broker"
              ? `Via ${interest.broker_name || "broker network"}`
              : "Direct introduction";
            return (
              <details key={interest.id} className="dashboard-interest-row">
                <summary>
                  <span>
                    <strong>{interest.viewer_name || "Unnamed viewer"}</strong>
                    <small>{sourceLabel} · For {formatProfileFor(profileFor)} {location ? `· ${location}` : ""} · {formatInterestDate(interest.created_at)}</small>
                  </span>
                  <span className="dashboard-interest-status">Awaiting review</span>
                </summary>
                <div className="dashboard-interest-details">
                  <div className="dashboard-interest-facts">
                    <p><strong>Introduced by</strong>{sourceLabel}</p>
                    {interest.broker_representative_name && <p><strong>Representative</strong>{interest.broker_representative_name}</p>}
                    <p><strong>Email</strong>{interest.viewer_email || "Not provided"} {interest.email_verified && <span className="dashboard-verified-label"><ShieldCheck aria-hidden="true" /> Verified</span>}</p>
                    {interest.viewer_phone && <p><strong>Phone</strong>{interest.viewer_phone}</p>}
                  </div>
                  {interest.viewer_family_context && <p><strong>Family introduction</strong>{interest.viewer_family_context}</p>}
                  {interest.message && <p><strong>Message</strong>{interest.message}</p>}
                  <div className="dashboard-interest-actions">
                    {interest.viewer_phone && <a href={`tel:${interest.viewer_phone}`} className="dashboard-secondary-action">Call</a>}
                    {interest.viewer_email && <a href={`mailto:${interest.viewer_email}`} className="dashboard-secondary-action">Email</a>}
                    {requesterPortfolioPath && <Link href={requesterPortfolioPath} target="_blank" rel="noreferrer" className="dashboard-secondary-action">View their Nakshatra portfolio</Link>}
                    <button type="button" className="dashboard-secondary-action" disabled={workingId === interest.id} onClick={() => void decide(interest, "rejected")}>Not right now</button>
                    {interest.requester_user_id ? (
                      <button type="button" className="dashboard-primary-action" disabled={workingId === interest.id} onClick={() => setApprovalCandidate(interest)}>Review Complete Portfolio access</button>
                    ) : (
                      <span className="dashboard-action-note">Ask the viewer to verify their email before approving access.</span>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
      {rejectedInterests.length > 0 && (
        <div className="dashboard-past-interests">
          <h3>Requests set aside</h3>
          {rejectedInterests.map((interest) => (
            <div key={interest.id} className="dashboard-access-row">
              <span>
                <strong>{interest.viewer_name || "Unnamed viewer"}</strong>
                <small>Set aside {formatInterestDate(interest.created_at)}</small>
              </span>
              <button
                type="button"
                className="dashboard-secondary-action"
                disabled={workingId === interest.id}
                onClick={() => void decide(interest, "reopened")}
              >
                {workingId === interest.id ? "Reopening..." : "Reopen request"}
              </button>
            </div>
          ))}
        </div>
      )}
      {approvalCandidate && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[#102027]/65 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={approvalTitleId}
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[light-dark(#e2e8f0,var(--app-dark-border))] bg-[light-dark(#fffdf8,var(--app-dark-surface))] p-5 text-[light-dark(#18272e,var(--app-dark-ink))] shadow-2xl sm:p-7"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[light-dark(#477b77,var(--app-dark-accent))]">Confirm controlled disclosure</p>
            <h3 id={approvalTitleId} className="mt-2 text-2xl font-semibold">Grant Complete Portfolio access to {approvalCandidate.viewer_name || "this viewer"}?</h3>
            <p className="mt-2 text-sm leading-6 text-[light-dark(#475569,var(--app-dark-muted))]">
              Recipient: {approvalCandidate.viewer_email || "verified viewer"}. Access expires 15 days after approval.
            </p>
            <div className="mt-5 rounded-xl border border-[light-dark(#e2e8f0,var(--app-dark-border))] bg-[light-dark(#f8fafc,var(--app-dark-surface))] p-4">
              <p className="text-sm font-semibold">The Complete Portfolio will disclose:</p>
              {disclosedCategories.length > 0 ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-5 text-[light-dark(#334155,var(--app-dark-ink))]">
                  {disclosedCategories.map((category) => <li key={category}>{category}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-[light-dark(#475569,var(--app-dark-muted))]">No additional protected information has been added yet.</p>
              )}
            </div>
            <p className="mt-4 text-sm leading-6 text-[light-dark(#475569,var(--app-dark-muted))]">
              You can end this person&apos;s access at any time. Ending access prevents future openings but cannot recall information they already viewed or saved.
            </p>
            {actionError && <p className="dashboard-action-error mt-4" role="alert">{actionError}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="dashboard-secondary-action" disabled={workingId !== null} onClick={() => setApprovalCandidate(null)}>Cancel</button>
              <button
                ref={approvalConfirmRef}
                type="button"
                className="dashboard-primary-action"
                disabled={workingId !== null}
                onClick={() => void decide(approvalCandidate, "approved").then((approved) => {
                  if (approved) setApprovalCandidate(null);
                })}
              >
                {workingId === approvalCandidate.id ? "Granting access..." : "Confirm Complete Portfolio for 15 days"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function AccessControls({
  grants,
  events,
  onGrantChange,
}: {
  grants: AccessGrant[];
  events: AccessAuditEvent[];
  onGrantChange: (grantId: string, action: "renew" | "revoke", expiresAt?: string) => void;
}) {
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function manage(grant: AccessGrant, action: "renew" | "revoke") {
    const prompt = action === "revoke"
      ? `End access for ${grant.viewerName || "this viewer"}? They will no longer be able to open the Complete Portfolio.`
      : `Renew Complete Portfolio access for ${grant.viewerName || "this viewer"} for 15 days?`;
    if (!confirm(prompt)) return;
    setWorkingId(grant.id);
    setError(null);
    try {
      const { manageAccessGrantRequest } = await import(
        "@/features/access/client/access-dashboard.api"
      );
      const result = await manageAccessGrantRequest(grant.id, action);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onGrantChange(grant.id, action, result.expiresAt);
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="dashboard-relationship-stage dashboard-access-controls">
      <div className="dashboard-relationship-stage-heading">
        <div>
          <h3>Complete Portfolio access</h3>
          <p>See who can open protected details, when access ends, and whether they have used it.</p>
        </div>
        <UserRoundCheck className="h-5 w-5" aria-hidden="true" />
      </div>
      {error && <p className="dashboard-action-error" role="alert">{error}</p>}
      {grants.length === 0 ? (
        <p className="dashboard-empty-state">Nobody has Complete Portfolio access yet. Approve a verified introduction above to grant 15-day access.</p>
      ) : (
        <div className="dashboard-access-list">
          {grants.map((grant) => (
            <div key={grant.id} className="dashboard-access-row">
              <span>
                <strong>{grant.viewerName || "Verified viewer"}</strong>
                <small>{grant.sourceType === "broker" ? `Introduced via ${grant.brokerName || "broker network"}` : "Direct introduction"}{grant.viewerEmail ? ` · ${grant.viewerEmail}` : ""}</small>
                <small>
                  {grant.status === "active"
                    ? `Active until ${formatAccessDate(grant.expiresAt)}`
                    : grant.status === "expired"
                      ? `Expired ${formatAccessDate(grant.expiresAt)}`
                      : "Access ended"}
                </small>
                <small>{grant.lastAccessedAt ? `Last opened ${formatAccessDate(grant.lastAccessedAt)}` : "Not opened yet"}</small>
              </span>
              {grant.status !== "revoked" && (
                <div className="dashboard-interest-actions">
                  <button
                    type="button"
                    className="dashboard-secondary-action"
                    disabled={workingId === grant.id}
                    onClick={() => void manage(grant, "renew")}
                  >
                    Renew 15 days
                  </button>
                  <button
                    type="button"
                    className="dashboard-danger-action"
                    disabled={workingId === grant.id}
                    onClick={() => void manage(grant, "revoke")}
                  >
                    End access
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {events.length > 0 && (
        <details className="dashboard-access-history">
          <summary><History className="h-4 w-4" aria-hidden="true" /> Access history</summary>
          <ol>
            {events.slice(0, 12).map((event) => (
              <li key={event.id}>
                <span>{accessEventLabel(event.eventType, event.viewerName)}</span>
                <time dateTime={event.createdAt}>{formatAccessDate(event.createdAt)}</time>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function formatAccessDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function accessEventLabel(type: AccessAuditEvent["eventType"], viewerName?: string | null) {
  const viewer = viewerName || "A viewer";
  const labels: Record<AccessAuditEvent["eventType"], string> = {
    request_submitted: `${viewer} submitted a request`,
    request_reopened: `${viewer}'s request was reopened`,
    request_rejected: `${viewer}'s request was set aside`,
    grant_created: `Complete Portfolio access granted to ${viewer}`,
    grant_renewed: `Complete Portfolio access renewed for ${viewer}`,
    grant_accessed: `${viewer} opened the Complete Portfolio`,
    grant_revoked: `Access ended for ${viewer}`,
    grant_expired: `Complete Portfolio access expired for ${viewer}`,
    portfolio_rotated: "Portfolio link rotated",
    portfolio_unpublished: "Portfolio unpublished",
  };
  return labels[type];
}

function formatInterestDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function formatInterestLocation(metadata: Record<string, unknown> | null) {
  if (!metadata) return "";
  const parts = [metadata.city, metadata.state, metadata.country]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (parts.length) return parts.join(", ");
  return typeof metadata.location === "string" ? metadata.location : "";
}

function formatProfileFor(value: string) {
  const labels: Record<string, string> = {
    self: "themselves",
    son: "their son",
    daughter: "their daughter",
    sibling: "their sibling",
    relative: "a relative",
  };
  return labels[value] || "themselves";
}

function trapDialogFocus(event: KeyboardEvent, dialog: HTMLElement | null) {
  if (event.key !== "Tab" || !dialog) return;
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], iframe, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function fullViewDisclosureCategories(
  data: PortfolioData,
  media: PortfolioMedia[],
  horoscope: PortfolioHoroscope | null
) {
  const categories: string[] = [];
  if (containsDisclosure({
    name: data.personal.name,
    gender: data.personal.gender,
    location: data.personal.current_location,
    maritalStatus: data.personal.marital_status,
    citizenship: data.personal.citizenship,
    story: data.personal.profile_summary || data.personal.short_bio,
    height: data.vitals?.height,
  })) {
    categories.push("Personal profile, location, and story details provided");
  }
  if (data.personal.dob?.trim()) categories.push("Exact date of birth");
  const birthDetails = [
    data.astrology?.time_of_birth?.trim() ? "time" : "",
    data.personal.place_of_birth?.trim() ? "place" : "",
  ].filter(Boolean);
  if (birthDetails.length) categories.push(`Exact ${birthDetails.join(" and ")} of birth`);
  if (containsDisclosure(data.education) || containsDisclosure(data.career)) {
    categories.push("Education, employer, career, and income details provided");
  }
  if (containsDisclosure(data.family)) {
    categories.push("Family members, origins, and family background provided");
  }
  if (containsDisclosure(data.lifestyle)) {
    categories.push("Lifestyle, languages, interests, and values provided");
  }
  if (containsDisclosure(data.astrology) || Boolean(data.vitals?.gotra)) {
    categories.push("Astrology and gotra details provided");
  }
  if (containsDisclosure(data.preferences)) {
    categories.push("Partner preferences and future plans provided");
  }
  const contacts = data.contact?.contacts?.filter(
    (contact) => contact.name?.trim() && (contact.phone?.trim() || contact.email?.trim())
  ) || [];
  if (
    contacts.length > 0
    || Boolean(data.contact?.contact_person?.trim() && (data.contact.phone?.trim() || data.contact.email?.trim()))
  ) {
    categories.push("Protected contact details");
  }
  if (media.length > 0) {
    const protectedPhotoCount = media.filter((item) => item.visibility !== "public").length;
    const protectedCopy = protectedPhotoCount > 0
      ? `, including ${protectedPhotoCount} protected ${protectedPhotoCount === 1 ? "photo" : "photos"}`
      : "";
    categories.push(`${media.length} portfolio ${media.length === 1 ? "photo" : "photos"}${protectedCopy}`);
  }
  if (horoscope) categories.push("Original horoscope attachment");
  return categories;
}

function containsDisclosure(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some(containsDisclosure);
  if (value && typeof value === "object") return Object.values(value).some(containsDisclosure);
  return false;
}

const EMPTY_DATA: PortfolioData = {
  privacy_mode: "balanced",
  personal: { name: "", first_name: "", middle_name: "", last_name: "", dob: "", gender: undefined },
  vitals: {},
  astrology: {},
  education: {},
  career: {},
  family: {},
  lifestyle: {},
  contact: {},
  style: {
    appearance: "light",
    template_name: "Nakshatra Portfolio",
    theme_color: "#f7f5ef",
  },
  preferences: {},
  access: {
    journey: "public",
    personal: "approved",
    career: "public",
    family: "approved",
    lifestyle: "public",
    preferences: "approved",
    future_plans: "approved",
    astrology: "approved",
    contact: "approved",
  },
  visibility: {
    family: "restricted",
    astrology_details: "restricted",
    gallery: "restricted",
    contact: "restricted",
  },
};

function normalizePortfolioData(
  data: Portfolio["draft_data"] | undefined,
  privacyMode?: Portfolio["privacy_mode"]
): PortfolioData {
  return {
    ...EMPTY_DATA,
    ...(data || {}),
    privacy_mode: normalizePortfolioPrivacyMode(data?.privacy_mode || privacyMode),
    personal: normalizePortfolioName({ ...EMPTY_DATA.personal, ...(data?.personal || {}) }),
    vitals: { ...(data?.vitals || {}) },
    astrology: { ...(data?.astrology || {}) },
    education: { ...(data?.education || {}) },
    career: { ...(data?.career || {}) },
    family: { ...(data?.family || {}) },
    lifestyle: { ...(data?.lifestyle || {}) },
    contact: { ...(data?.contact || {}) },
    style: { ...EMPTY_DATA.style, ...(data?.style || {}) },
    preferences: { ...(data?.preferences || {}) },
    access: { ...EMPTY_DATA.access, ...(data?.access || {}) },
    visibility: { ...EMPTY_DATA.visibility, ...(data?.visibility || {}) },
  };
}

function PhotoManager({
  media,
  urls,
  uploading,
  inputRef,
  onUpload,
  onUpdate,
  onDelete,
}: {
  media: PortfolioMedia[];
  urls: Record<string, string>;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (files: FileList | null) => void;
  onUpdate: (
    id: string,
    changes: Partial<Pick<PortfolioMedia, "visibility" | "media_type" | "alt_text">>
  ) => void;
  onDelete: (id: string) => void;
}) {
  const visibilityLabels: { value: PortfolioMediaVisibility; label: string }[] = [
    { value: "interest_required", label: "Blurred until approval" },
    { value: "public", label: "Visible to all" },
  ];

  return (
    <section className="mb-7 border-b border-white/10 pb-7">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Images className="h-4 w-4 text-[#f4d98f]" />
            Profile photos
          </h3>
          <p className="mt-1 text-xs leading-5 text-white/55">
            Add up to eight photos. Your originals remain in the private photos bucket.
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium text-[#f4d98f]">{media.length}/{MAX_PORTFOLIO_PHOTOS}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => onUpload(event.target.files)}
      />

      <div className="flex flex-wrap gap-3">
        {media.map((item) => (
          <article
            key={item.id}
            aria-label={item.media_type === "hero" ? "Primary photo" : "Profile photo"}
            className="w-36 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/15 sm:w-40"
          >
            <div className="relative h-36 bg-white/5 sm:h-40">
              {urls[item.id] ? (
                // Signed URLs are created client-side for the portfolio owner only.
                // eslint-disable-next-line @next/next/no-img-element -- Signed Supabase URLs cannot use Next's static optimizer.
                <img src={urls[item.id]} alt={item.alt_text || "Profile photo"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-white/35">Loading...</div>
              )}
              {item.media_type === "hero" && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-[#f4d98f] px-2 py-1 text-xs font-semibold text-[light-dark(#17151c,var(--app-dark-ink))]">
                  <Crown className="h-3 w-3" /> Hero
                </span>
              )}
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/65 text-white transition-colors hover:bg-red-500"
                aria-label="Delete photo"
                title="Delete photo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2 p-2">
              <select
                value={visibilityLabels.some((option) => option.value === item.visibility) ? item.visibility : ""}
                onChange={(event) =>
                  onUpdate(item.id, { visibility: event.target.value as PortfolioMediaVisibility })
                }
                className="h-10 w-full rounded-md border border-white/10 bg-[light-dark(#ffffff,var(--app-dark-surface))]/[0.06] px-2 text-xs text-white outline-none"
                aria-label="Photo visibility"
              >
                {!visibilityLabels.some((option) => option.value === item.visibility) && (
                  <option value="" disabled>Choose visibility</option>
                )}
                {visibilityLabels.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#1a1b27]">
                    {option.label}
                  </option>
                ))}
              </select>
              {!visibilityLabels.some((option) => option.value === item.visibility) && (
                <p className="text-xs leading-4 text-[color:var(--workspace-ink-muted)]">
                  Choose how this photo should be shared. Its existing privacy remains unchanged until then.
                </p>
              )}
              {item.media_type !== "hero" && (
                <button
                  type="button"
                  onClick={() => onUpdate(item.id, { media_type: "hero" })}
                  className="min-h-10 w-full rounded-md border border-white/10 px-2 py-2 text-xs font-medium text-white/75 transition-colors hover:bg-white/10"
                >
                  Make primary photo
                </button>
              )}
            </div>
          </article>
        ))}
        {media.length < MAX_PORTFOLIO_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-36 w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#f4d98f]/35 bg-[#f4d98f]/5 px-3 text-center text-xs font-medium text-[#f4d98f] transition-colors hover:bg-[#f4d98f]/10 disabled:opacity-50 sm:h-40 sm:w-40"
          >
            {uploading ? <Upload className="h-5 w-5 animate-pulse" /> : <ImagePlus className="h-5 w-5" />}
            {uploading ? "Uploading" : "Add photos"}
          </button>
        )}
      </div>
    </section>
  );
}
