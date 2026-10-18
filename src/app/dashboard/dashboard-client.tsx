"use client";

import { CustomerAppHeader } from "@/components/navigation/CustomerAppHeader";
import { CreatorOnboardingFeedback } from "@/components/feedback/CreatorOnboardingFeedback";
import { PortfolioImage } from "@/components/loading/PortfolioImage";
import { LoadingStatus } from "@/components/loading/LoadingStatus";
import { PortfolioLoadingStatus } from "@/components/loading/PortfolioLoadingStatus";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { usePortfolioFieldError } from "@/components/portfolio/PortfolioFieldValidation";
import { InterestDetailsPanel } from "@/components/portfolio/InterestDetailsPanel";
import { InterestHistoryPanel } from "@/components/portfolio/InterestHistoryPanel";

import { useCallback, useEffect, useId, useRef, useState, useTransition, useSyncExternalStore } from "react";
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
  PortfolioMobileSectionNav,
  PORTFOLIO_EDITOR_SECTIONS,
  navigableSection,
  type PortfolioEditorSection,
} from "@/components/portfolio/BlueprintForm";
import { IdentityVerificationDashboard } from "@/features/identity-verification/client/identity-verification-dashboard";
import {
  Eye,
  Clock,
  Edit3,
  Share2,
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
  CheckCircle2,
  Circle,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { normalizePortfolioName } from "@/features/portfolio/name";
import { portfolioEditorDraftSchema } from "@/features/portfolio/form-contract";
import { editorFieldIssues, editorFieldLabel, editorFieldTarget, portfolioFieldAnchor, type EditorFieldIssue } from "@/features/portfolio/editor-validation";
import { buildWhatsAppShareMessage } from "@/features/portfolio/whatsapp-share";
import { interestStatusLabel } from "@/features/interest/presentation";
import type { PilotAccessState } from "@/features/pilot-access/server/pilot-access.contract";
import type { DashboardInterest } from "@/features/interest/server/interest-dashboard.contract";
import type { OwnerBrokerIntroductionResponse, ReceivedBrokerIntroduction } from "@/features/broker-introductions/server/broker-introduction.contract";
import { calculatePortfolioCompletion, editorSectionForPath, isProfileFullyComplete } from "@/features/portfolio/readiness";
import {
  PORTFOLIO_VIEW_LABELS,
} from "@/features/portfolio/template";
import {
  canPublishWithVerificationStatus,
  EMPTY_PUBLICATION_READINESS,
  type PublicationReadiness,
} from "@/features/portfolio/server/publication-readiness.contract";

interface Props {
  renderedAt?: number;
  portfolio: Portfolio | null;
  canCreatePortfolio: boolean;
  pilotAccessState?: PilotAccessState | null;
  viewCount: number;
  userEmail: string;
  shareUrl: string | null;
  whatsappMessage?: string | null;
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
  receivedBrokerIntroductions?: ReceivedBrokerIntroduction[];
}

const EMPTY_ACCESS_SUMMARY: PortfolioAccessSummary = { grants: [], events: [] };
type RelationshipStage = "awaiting" | "set-aside" | "access";

export default function DashboardClient({
  renderedAt = 0,
  portfolio,
  canCreatePortfolio,
  pilotAccessState = null,
  viewCount,
  userEmail,
  shareUrl,
  whatsappMessage = null,
  isExpired,
  media,
  mediaUrls: initialMediaUrls = {},
  horoscope = null,
  initialEditorOpen = false,
  interests = [],
  accessSummary = EMPTY_ACCESS_SUMMARY,
  publicationReadiness = EMPTY_PUBLICATION_READINESS,
  brokerIntroductionResponses = [],
  receivedBrokerIntroductions = [],
}: Props) {
  const [copied, setCopied] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [formOpen, setFormOpen] = useState(initialEditorOpen && canCreatePortfolio);
  const [draftData, setDraftData] = useState<PortfolioData>(() =>
    normalizePortfolioData(portfolio?.draft_data, portfolio?.privacy_mode)
  );
  const savedDraftRef = useRef<PortfolioData>(normalizePortfolioData(portfolio?.draft_data, portfolio?.privacy_mode));
  const [preparingPreview, setPreparingPreview] = useState(false);
  const [mediaMutations, setMediaMutations] = useState(0);
  const [removingHoroscope, setRemovingHoroscope] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<"saved" | "unsaved" | "saving">("saved");
  const [publishing, setPublishing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPreviewsOpened, setReviewPreviewsOpened] = useState({
    public: publicationReadiness.publicPreviewReviewed ?? false,
    complete: publicationReadiness.completePreviewReviewed ?? false,
  });
  const [reviewPreviewSaving, setReviewPreviewSaving] = useState(false);
  const [openingReview, setOpeningReview] = useState(false);
  const openingReviewRef = useRef(false);
  const reviewNeedsReloadRef = useRef(false);
  const pendingPreviewRequests = useRef(0);
  const [sensitiveDisclosureAccepted, setSensitiveDisclosureAccepted] = useState(false);
  const [rotatingLink, setRotatingLink] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [portfolioMedia, setPortfolioMedia] = useState(media);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>(initialMediaUrls);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [portfolioHoroscope, setPortfolioHoroscope] = useState(horoscope);
  const [uploadingHoroscope, setUploadingHoroscope] = useState(false);
  const [activePortfolioId, setActivePortfolioId] = useState(portfolio?.id ?? null);
  const [savedCandidateId, setSavedCandidateId] = useState<string | null>(null);
  const [interestItems, setInterestItems] = useState(interests);
  const [accessGrants, setAccessGrants] = useState(accessSummary.grants);
  const [expandedRelationshipStages, setExpandedRelationshipStages] = useState<Record<RelationshipStage, boolean>>({
    awaiting: false,
    "set-aside": false,
    access: false,
  });
  const [journeyReadiness, setReadinessState] = useState(publicationReadiness);
  const savedReadinessRef = useRef(publicationReadiness);
  // Refresh the authoritative server projection, retaining local editor progress.
  // A browser/provider return is never itself publication authorization.
  const readinessState = { ...journeyReadiness, verificationStatus: publicationReadiness.verificationStatus };
  const [editorSection, setEditorSection] = useState<PortfolioEditorSection>(() => navigableSection(
    (publicationReadiness.lastEditorSection || calculatePortfolioCompletion(
      normalizePortfolioData(portfolio?.draft_data, portfolio?.privacy_mode),
      media.some(isShareablePrimaryPhoto)
    ).nextEditorSection) as PortfolioEditorSection
  ));
  const [validationRequested, setValidationRequested] = useState(false);
  const [pendingFieldFocus, setPendingFieldFocus] = useState<{ path: string } | null>(null);
  const focusedFieldRequestRef = useRef(pendingFieldFocus);
  const [serverFieldIssues, setServerFieldIssues] = useState<EditorFieldIssue[]>([]);
  const validationIssues = validationRequested
    ? editorFieldIssues(draftData, portfolioMedia.some(isShareablePrimaryPhoto)) : [];

  useEffect(() => {
    if (!pendingFieldFocus || !formOpen || focusedFieldRequestRef.current === pendingFieldFocus) return;
    focusedFieldRequestRef.current = pendingFieldFocus;
    const target = document.getElementById(portfolioFieldAnchor(pendingFieldFocus.path));
    const focusTarget = target?.matches("input, select, textarea, button") ? target
      : target?.querySelector<HTMLElement>("[data-portfolio-error-focus='primary']:not(:disabled)")
        || target?.querySelector<HTMLElement>("[data-portfolio-error-focus='visibility']:not(:disabled)")
        || target?.querySelector<HTMLElement>("input:not([type=hidden]):not([type=file]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)") || target
        || document.getElementById("blueprint-stage");
    focusTarget?.focus();
    focusTarget?.scrollIntoView?.({ block: "center", behavior: "auto" });
  }, [pendingFieldFocus, editorSection, formOpen]);
  const accessEvents = accessSummary.events;
  const photoInputRef = useRef<HTMLInputElement>(null);
  const horoscopeInputRef = useRef<HTMLInputElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const draftRevisionRef = useRef(0);
  const savedReviewFingerprintRef = useRef<string | null | undefined>(undefined);
  // A versioned or deliberately unbound loader projection must not become a
  // legacy review merely because an older save/progress response omits its hash.
  const versionedReviewRequiredRef = useRef(publicationReadiness.reviewFingerprint !== undefined);
  const lastAutosaveAttemptRevisionRef = useRef(-1);
  const sectionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightDraftSaveRef = useRef<Promise<boolean> | null>(null);
  const progressWriteInFlightRef = useRef(false);
  const pendingEditorSectionRef = useRef<PortfolioEditorSection | null>(null);
  const persistedEditorSectionRef = useRef(publicationReadiness.lastEditorSection);
  const currentEditorSectionRef = useRef(editorSection);
  const editorMountedRef = useRef(true);
  const previewRequestQueue = useRef(Promise.resolve());
  const router = useRouter();
  const workspaceActiveRef = useRef(initialEditorOpen && canCreatePortfolio);
  const deferredRefreshRef = useRef(false);
  const refreshDashboard = useCallback(() => {
    // The server keys DashboardClient by saved revision. Refreshing mid-edit
    // would remount it, close the editor and discard newer unsaved keystrokes.
    // Mutation responses already update local draft/media state; reconcile the
    // server projection once the user leaves both editor and final review.
    if (workspaceActiveRef.current) {
      deferredRefreshRef.current = true;
      return;
    }
    startRefresh(() => router.refresh());
  }, [router]);

  useEffect(() => {
    workspaceActiveRef.current = formOpen || reviewOpen;
    if (!workspaceActiveRef.current && deferredRefreshRef.current) {
      deferredRefreshRef.current = false;
      startRefresh(() => router.refresh());
    }
  }, [formOpen, reviewOpen, router]);

  useEffect(() => { currentEditorSectionRef.current = editorSection; }, [editorSection]);

  const onVerificationStatusChange = useCallback(() => refreshDashboard(), [refreshDashboard]);
  const disclosedCategories = fullViewDisclosureCategories(
    draftData,
    portfolioMedia,
    portfolioHoroscope
  );
  const completion = calculatePortfolioCompletion(
    draftData,
    portfolioMedia.some(isShareablePrimaryPhoto)
  );
  const nextRequiredSection = navigableSection(completion.nextEditorSection as PortfolioEditorSection);
  const nextRequiredSectionLabel = PORTFOLIO_EDITOR_SECTIONS.find((section) => section.id === nextRequiredSection)?.label || "introduction details";
  const verificationComplete = canPublishWithVerificationStatus(readinessState.verificationStatus);
  const activeCandidateId = portfolio?.candidate_id || savedCandidateId;
  const readyForPublicationConsent = completion.readyToPublish
    && draftData.privacy_mode !== "private"
    && verificationComplete
    && readinessState.paymentActive;
  const selfCreatedPortfolio = portfolio?.published_data?.personal?.profile_for === "self";
  const publishedProfileComplete = isProfileFullyComplete(
    portfolio?.published_data, portfolioMedia.some(isShareablePrimaryPhoto)
  );
  const publishedProfileNeedsUpdate = Boolean(portfolio?.is_published && !publishedProfileComplete);
  const publicShareReady = selfCreatedPortfolio
    && publishedProfileComplete
    && canPublishWithVerificationStatus(readinessState.verificationStatus);
  const viewerAccessAvailable = Boolean(portfolio?.is_published && shareUrl && publicShareReady && !isExpired);
  const pendingInterestCount = interestItems.filter(
    (item) => item.status === "new" || item.status === "pending_review"
  ).length;
  const activeAccessCount = accessGrants.filter((grant) => grant.status === "active").length;
  const showRelationshipDashboard = Boolean(
    portfolio?.published_at || interestItems.length || accessGrants.length || accessEvents.length || brokerIntroductionResponses.length
  );

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
    if (!formOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const heading = document.getElementById("portfolio-editor-heading");
    document.body.style.overflow = "hidden";
    heading?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [formOpen]);

  useEffect(() => {
    if (!formOpen) return;
    const heading = document.getElementById("portfolio-editor-heading");
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePortfolioEditor();
        return;
      }
      trapDialogFocus(event, heading?.closest<HTMLElement>("[role='dialog']") || null);
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  // Refresh the key handler with the latest save state without resetting editor focus.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen, draftSaveState, savingDraft]);

  useEffect(() => {
    if (!reviewOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    reviewHeadingRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !publishing) {
        setReviewOpen(false);
        return;
      }
      trapDialogFocus(event, reviewHeadingRef.current?.closest<HTMLElement>("[role='dialog']") || null);
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [reviewOpen, publishing]);

  useEffect(() => {
    if (draftSaveState !== "unsaved" || !canCreatePortfolio || savingDraft) return;
    // Intermediate dates/phones/names may be malformed while typing. Manual save
    // still returns actionable errors; autosave need not send a known rejection.
    if (!portfolioEditorDraftSchema.safeParse(draftData).success) return;
    const revision = draftRevisionRef.current;
    if (lastAutosaveAttemptRevisionRef.current === revision) return;
    const timer = window.setTimeout(() => {
      lastAutosaveAttemptRevisionRef.current = revision;
      void persistDashboardDraft({ refresh: false, silent: true });
    }, 2000);
    return () => window.clearTimeout(timer);
    // The save operation intentionally uses the latest render's draft snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftData, draftSaveState, canCreatePortfolio, savingDraft]);

  useEffect(() => {
    editorMountedRef.current = true;
    return () => {
      editorMountedRef.current = false;
      pendingEditorSectionRef.current = null;
      if (sectionSaveTimerRef.current) clearTimeout(sectionSaveTimerRef.current);
    };
  }, []);

  function leaveEditorRoute() {
    const url = new URL(window.location.href);
    if (url.pathname === "/dashboard" && url.searchParams.has("edit")) {
      url.searchParams.delete("edit");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function closePortfolioEditor() {
    if (savingDraft) {
      setDraftError("Please wait for the current save to finish before leaving the form.");
      return;
    }
    if (draftSaveState === "unsaved") {
      if (!confirm("Your latest changes have not been saved. Discard them and return to the dashboard?")) return;
      draftRevisionRef.current += 1;
      setDraftData(savedDraftRef.current);
      setReadinessState(savedReadinessRef.current);
      setReviewPreviewsOpened({
        public: savedReadinessRef.current.publicPreviewReviewed ?? false,
        complete: savedReadinessRef.current.completePreviewReviewed ?? false,
      });
      setDraftSaveState("saved");
      setDraftError(null);
    }
    // A direct /dashboard?edit=1 entry must not reopen the editor when the
    // deferred server refresh completes after this explicit exit.
    leaveEditorRoute();
    setFormOpen(false);
  }

  function openEditorAtRequiredStep() {
    setEditorSection(nextRequiredSection);
    setFormOpen(true);
  }

  function focusLivenessCheck() {
    const section = document.getElementById("liveness-check");
    if (section && typeof section.scrollIntoView === "function") {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      section.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
    }
    section?.querySelector<HTMLElement>("h2")?.focus();
  }

  function goToLivenessCheck() {
    setReviewOpen(false);
    window.setTimeout(focusLivenessCheck, 0);
  }

  async function copyLink() {
    if (!shareUrl || !viewerAccessAvailable) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setDraftError("Copying was unavailable. Select the Introduction link and copy it manually.");
    }
  }

  async function shareWhatsApp() {
    if (!shareUrl || !viewerAccessAvailable) return;
    const text = encodeURIComponent(whatsappMessage || buildWhatsAppShareMessage(shareUrl));
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
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

    if (failure.error.code === "PORTFOLIO_REVIEW_CHANGED") {
      reviewNeedsReloadRef.current = true;
      setReviewPreviewsOpened({ public: false, complete: false });
      setSensitiveDisclosureAccepted(false);
      setReviewOpen(false);
      // A stale saved revision is an explicit recovery path, not a routine
      // autosave refresh. Do not defer its fail-closed authoritative reload.
      deferredRefreshRef.current = false;
      startRefresh(() => router.refresh());
    }
    if (failure.error.fieldErrors) {
      const issueMap = new Map<string, EditorFieldIssue>();
      for (const [sourcePath, messages] of Object.entries(failure.error.fieldErrors)) {
        const path = editorFieldTarget(sourcePath);
        if (!issueMap.has(path)) issueMap.set(path, { path, label: editorFieldLabel(path),
          section: editorSectionForPath(path), message: messages[0] || "Check this answer." });
      }
      const issues = [...issueMap.values()];
      setServerFieldIssues(issues);
      if (issues[0]) showFieldIssue(issues[0]);
    }
    setDraftError(failure.error.message);
    return false;
  }

  async function renewLink() {
    if (!portfolio) return;
    if (!confirm("Reactivate this link until you unpublish it?")) return;
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
      refreshDashboard();
    } finally {
      setRenewing(false);
    }
  }

  /** Confirms the reviewed disclosure when needed, then atomically refreshes the public snapshot from the draft. */
  async function publishPortfolio() {
    if (!sensitiveDisclosureAccepted) return;
    if (!validateEditor()) return;
    setPublishing(true);
    setDraftError(null);
    try {
      if (!readinessState.disclosureConfirmed) {
        const { updatePublicationProgressRequest } = await import(
          "@/features/portfolio/client/portfolio-dashboard.api"
        );
        const disclosureResult = await updatePublicationProgressRequest({
          action: "confirm_disclosure",
          value: "publication-disclosure-v2",
        });
        if (!disclosureResult.ok) return void handlePortfolioApiFailure(disclosureResult);
        savedReadinessRef.current = disclosureResult.data.readiness;
        setReadinessState(disclosureResult.data.readiness);
      }

      const { publishPortfolioRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await publishPortfolioRequest(draftData);
      if (!result.ok) return void handlePortfolioApiFailure(result);
      setFormOpen(false);
      setReviewOpen(false);
      refreshDashboard();
    } catch {
      setDraftError("We could not publish your introduction. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  /** Replaces the active public URL after the owner confirms that the previous link should stop working. */
  async function rotateLink() {
    if (!confirm("Rotate this link? The existing introduction URL will stop working immediately. Existing private-detail sharing will also stop.")) return;
    setRotatingLink(true);
    setDraftError(null);
    try {
      const { rotatePortfolioLinkRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await rotatePortfolioLinkRequest();
      if (!result.ok) return void handlePortfolioApiFailure(result);
      refreshDashboard();
    } finally {
      setRotatingLink(false);
    }
  }

  /** Removes public access without deleting the owner draft, media, or dashboard configuration. */
  async function unpublishPortfolio() {
    if (!confirm("Unpublish this introduction? Anyone using the current link will no longer be able to view it.")) return;
    setUnpublishing(true);
    setDraftError(null);
    try {
      const { unpublishPortfolioRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await unpublishPortfolioRequest();
      if (!result.ok) return void handlePortfolioApiFailure(result);
      refreshDashboard();
    } finally {
      setUnpublishing(false);
    }
  }

  function updateSection<K extends keyof PortfolioData>(
    key: K,
    value: PortfolioData[K]
  ) {
    if (JSON.stringify(draftData[key]) === JSON.stringify(value)) return;
    setServerFieldIssues([]);
    setDraftData((current) => ({ ...current, [key]: value }));
    setDraftSaveState("unsaved");
    invalidatePreviewReview();
  }

  function invalidatePreviewReview(persistedMediaChange = false) {
    draftRevisionRef.current += 1;
    setReviewPreviewsOpened({ public: false, complete: false });
    setSensitiveDisclosureAccepted(false);
    if (persistedMediaChange) {
      savedReadinessRef.current = { ...savedReadinessRef.current, disclosureConfirmed: false,
        publicPreviewReviewed: false, completePreviewReviewed: false, reviewFingerprint: null };
    }
    setReadinessState((current) => ({ ...current, disclosureConfirmed: false,
      publicPreviewReviewed: false, completePreviewReviewed: false, reviewFingerprint: null }));
  }

  function persistDashboardDraft(options: { refresh?: boolean; silent?: boolean } = {}): Promise<boolean> {
    // A synchronous guard covers manual/autosave races before React renders the
    // disabled button. Never race two full relational-sync transactions.
    if (inFlightDraftSaveRef.current) return inFlightDraftSaveRef.current;
    if (draftSaveState === "saved" && activePortfolioId) return Promise.resolve(true);
    const operation = performDashboardDraftSave(options);
    inFlightDraftSaveRef.current = operation;
    return operation.finally(() => {
      if (inFlightDraftSaveRef.current === operation) inFlightDraftSaveRef.current = null;
    });
  }

  async function performDashboardDraftSave({
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
      savedDraftRef.current = result.data.draftData ?? draftData;
      if (result.data.readiness) {
        savedReadinessRef.current = draftRevisionRef.current === savingRevision
          ? result.data.readiness
          : { ...savedReadinessRef.current, disclosureConfirmed: false,
            publicPreviewReviewed: false, completePreviewReviewed: false, reviewFingerprint: null };
      }
      setActivePortfolioId(result.data.portfolioId);
      if (result.data.candidateId) setSavedCandidateId(result.data.candidateId);
      if (result.data.draftData && draftRevisionRef.current === savingRevision) {
        setDraftData({ ...result.data.draftData, personal: {
          ...result.data.draftData.personal,
          // A server-normalized save is canonical for storage, not an instruction
          // to remove the space the person is currently typing after a name part.
          first_name: draftData.personal.first_name,
          middle_name: draftData.personal.middle_name,
          last_name: draftData.personal.last_name,
        } });
      }
      if (result.data.readiness && draftRevisionRef.current === savingRevision) {
        setReadinessState(result.data.readiness);
        setReviewPreviewsOpened({ public: result.data.readiness.publicPreviewReviewed ?? false,
          complete: result.data.readiness.completePreviewReviewed ?? false });
      }
      if (draftRevisionRef.current === savingRevision) savedReviewFingerprintRef.current = result.data.readiness?.reviewFingerprint;
      setDraftSaveState(draftRevisionRef.current === savingRevision ? "saved" : "unsaved");
      if (refresh) refreshDashboard();
      return draftRevisionRef.current === savingRevision;
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
    if (!validateEditor()) return;
    if (draftData.privacy_mode === "private") {
      setDraftError("Update the saved sharing setup in Appearance & contact, then review the public introduction before publishing.");
      return;
    }
    const needsSave = draftSaveState !== "saved" || !activePortfolioId;
    if (needsSave && !await persistDashboardDraft({ refresh: false })) return;
    await openFinalReview(needsSave);
  }

  /** Refresh the saved revision before allowing review; never overwrite another tab's answers. */
  async function openFinalReview(justSaved = false) {
    if (openingReviewRef.current) return;
    if (reviewNeedsReloadRef.current) {
      startRefresh(() => router.refresh());
      return;
    }
    openingReviewRef.current = true;
    setOpeningReview(true);
    setSensitiveDisclosureAccepted(false);
    setDraftError(null);
    const revision = draftRevisionRef.current;
    try {
      await previewRequestQueue.current;
      const readiness = await markPreviewed(justSaved);
      if (!readiness || revision !== draftRevisionRef.current) return;
      if (readiness.reviewFingerprint !== undefined) {
        setReviewPreviewsOpened({ public: readiness.publicPreviewReviewed ?? false,
          complete: readiness.completePreviewReviewed ?? false });
      }
      leaveEditorRoute();
      setFormOpen(false);
      setReviewOpen(true);
    } catch {
      setDraftError("We could not load your saved review. Check your connection and try again.");
    } finally {
      openingReviewRef.current = false;
      setOpeningReview(false);
    }
  }

  function recordReviewPreview(view: "public" | "complete", readiness = readinessState) {
    const fingerprint = readiness.reviewFingerprint;
    if (fingerprint) {
      const revision = draftRevisionRef.current;
      pendingPreviewRequests.current += 1;
      setReviewPreviewSaving(true);
      previewRequestQueue.current = previewRequestQueue.current.then(async () => {
        const { updatePublicationProgressRequest } = await import("@/features/portfolio/client/portfolio-dashboard.api");
        const result = await updatePublicationProgressRequest({ action: view === "public" ? "public_preview" : "complete_preview", value: fingerprint });
        if (!result.ok) return void handlePortfolioApiFailure(result);
        if (revision !== draftRevisionRef.current) return;
        savedReadinessRef.current = result.data.readiness;
        setReadinessState(result.data.readiness);
        setReviewPreviewsOpened({ public: result.data.readiness.publicPreviewReviewed ?? false,
          complete: result.data.readiness.completePreviewReviewed ?? false });
      }).catch(() => setDraftError("Your preview progress could not be saved. Reopen the preview to try again."))
        .finally(() => {
          pendingPreviewRequests.current -= 1;
          setReviewPreviewSaving(pendingPreviewRequests.current > 0);
        });
      return;
    }
    // Only an older database projection may use the legacy marker. A cleared modern
    // fingerprint means edits need a fresh saved revision, not permission to skip it.
    if (fingerprint === null) {
      setDraftError("Reopen Review and publish to load the latest saved previews.");
      return;
    }
    const next = { ...reviewPreviewsOpened, [view]: true };
    setReviewPreviewsOpened(next);
    if (next.public && next.complete && !(reviewPreviewsOpened.public && reviewPreviewsOpened.complete)) {
      void markPreviewed();
    }
  }

  async function recordOverviewPreview(view: "public" | "complete") {
    const revision = draftRevisionRef.current;
    try {
      const readiness = await markPreviewed();
      if (readiness && revision === draftRevisionRef.current) recordReviewPreview(view, readiness);
    } catch {
      setDraftError("Your preview progress could not be saved. Reopen the preview to try again.");
    }
  }

  async function markPreviewed(allowRevisionChange = false) {
    pendingPreviewRequests.current += 1;
    setReviewPreviewSaving(true);
    try {
      const revision = draftRevisionRef.current;
      const { updatePublicationProgressRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await updatePublicationProgressRequest({ action: "previewed" });
      if (!result.ok) {
        handlePortfolioApiFailure(result);
        return null;
      }
      if (revision !== draftRevisionRef.current) return null;
      const fresh = result.data.readiness;
      // A media mutation clears the review hash, not the local answers. A progress
      // response cannot prove those answers still match another tab's saved draft.
      // Reload the authoritative page before adopting an unknown saved revision.
      const expectedFingerprint = allowRevisionChange ? savedReviewFingerprintRef.current : readinessState.reviewFingerprint;
      if ((versionedReviewRequiredRef.current && (!expectedFingerprint || fresh.reviewFingerprint !== expectedFingerprint))
        || (!allowRevisionChange && expectedFingerprint === null)
        || (fresh.reviewFingerprint && expectedFingerprint !== fresh.reviewFingerprint)) {
        handlePortfolioApiFailure({ ok: false, error: { code: "PORTFOLIO_REVIEW_CHANGED", status: 409,
          message: "We could not confirm your latest saved introduction. Loading the latest details; reopen Review and publish when they appear." } });
        return null;
      }
      savedReadinessRef.current = result.data.readiness;
      setReadinessState(result.data.readiness);
      return result.data.readiness;
    } catch {
      setDraftError("Your preview progress could not be saved. Reopen the preview to try again.");
      return null;
    } finally {
      pendingPreviewRequests.current -= 1;
      setReviewPreviewSaving(pendingPreviewRequests.current > 0);
    }
  }

  async function openEarlyPreview() {
    if (preparingPreview) return;
    setPreparingPreview(true);
    try {
      const needsSave = draftSaveState !== "saved" || !activePortfolioId;
      if (needsSave && !await persistDashboardDraft({ refresh: false })) return;
      const readiness = await markPreviewed(needsSave);
      if (!readiness) return;
      recordReviewPreview("public", readiness);
      window.open("/preview", "_blank", "noopener,noreferrer");
    } catch {
      setDraftError("We could not prepare your preview. Please try again.");
    } finally {
      setPreparingPreview(false);
    }
  }

  function rememberEditorSection(section: PortfolioEditorSection) {
    section = navigableSection(section);
    if (section === editorSection) return;
    const destination = PORTFOLIO_EDITOR_SECTIONS.findIndex(item => item.id === navigableSection(section));
    const current = PORTFOLIO_EDITOR_SECTIONS.findIndex(item => item.id === editorSection);
    if (destination > current && !validateEditor(destination)) return;
    setEditorSection(navigableSection(section));
    currentEditorSectionRef.current = section;
    const editorScroll = document.querySelector<HTMLElement>(".dashboard-editor-scroll");
    if (editorScroll) editorScroll.scrollTop = 0;
    setReadinessState((current) => ({ ...current, lastEditorSection: section }));
    if (sectionSaveTimerRef.current) clearTimeout(sectionSaveTimerRef.current);
    pendingEditorSectionRef.current = section;
    sectionSaveTimerRef.current = setTimeout(() => { void persistEditorSection(); }, 800);
  }

  async function persistEditorSection() {
    if (progressWriteInFlightRef.current || !editorMountedRef.current) return;
    const section = pendingEditorSectionRef.current;
    pendingEditorSectionRef.current = null;
    if (!section || section === persistedEditorSectionRef.current) return;
    progressWriteInFlightRef.current = true;
    try {
      const { updatePublicationProgressRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await updatePublicationProgressRequest({
        action: "editor_section",
        value: section,
      });
      if (result.ok) {
        persistedEditorSectionRef.current = section;
        savedReadinessRef.current = {
          ...savedReadinessRef.current,
          lastEditorSection: section,
        };
        if (editorMountedRef.current && currentEditorSectionRef.current === section) setReadinessState((current) => ({
          ...current,
          lastEditorSection: section,
        }));
      }
    } catch {
      // Resume-position persistence is best effort. Keep navigation usable and
      // do not retry the same failed write in the background indefinitely.
    } finally {
      progressWriteInFlightRef.current = false;
      if (editorMountedRef.current && pendingEditorSectionRef.current) {
        if (sectionSaveTimerRef.current) clearTimeout(sectionSaveTimerRef.current);
        sectionSaveTimerRef.current = setTimeout(() => { void persistEditorSection(); }, 800);
      }
    }
  }

  function showFieldIssue(issue: EditorFieldIssue) {
    setReviewOpen(false);
    setFormOpen(true);
    setEditorSection(navigableSection(issue.section as PortfolioEditorSection));
    setPendingFieldFocus({ path: issue.path });
  }

  function validateEditor(beforeSection = PORTFOLIO_EDITOR_SECTIONS.length) {
    const issues = editorFieldIssues(draftData, portfolioMedia.some(isShareablePrimaryPhoto)).filter(issue =>
      PORTFOLIO_EDITOR_SECTIONS.findIndex(item => item.id === issue.section) < beforeSection);
    setValidationRequested(true);
    if (!issues.length) return true;
    showFieldIssue(issues[0]);
    return false;
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
      invalidatePreviewReview(true);
      refreshDashboard();
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
    setMediaMutations((count) => count + 1);
    setDraftError(null);
    try {
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
      invalidatePreviewReview(true);
    } catch {
      setDraftError("We could not update your photos. Please try again.");
    } finally {
      setMediaMutations((count) => count - 1);
    }
  }

  async function deletePhoto(mediaId: string) {
    if (!confirm("Permanently delete this photo? It will be removed from your portfolio and cannot be restored.")) return;
    setMediaMutations((count) => count + 1);
    setDraftError(null);
    try {
      const { deletePortfolioPhotoRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await deletePortfolioPhotoRequest(mediaId);
      if (!result.ok) return void handlePortfolioApiFailure(result);
      setPortfolioMedia((current) => current.filter((item) => item.id !== mediaId));
      setMediaUrls((current) => Object.fromEntries(
        Object.entries(current).filter(([id]) => id !== mediaId)
      ));
      invalidatePreviewReview(true);
    } catch {
      setDraftError("We could not update your photos. Please try again.");
    } finally {
      setMediaMutations((count) => count - 1);
    }
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
      invalidatePreviewReview(true);
      refreshDashboard();
    } catch {
      setDraftError("We could not upload the attachment. Please try again.");
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
    if (!portfolioHoroscope || !confirm("Remove this horoscope attachment? People you’ve shared with will lose access immediately.")) return;
    setRemovingHoroscope(true);
    setDraftError(null);
    try {
      const { deleteHoroscopeRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await deleteHoroscopeRequest(portfolioHoroscope.id);
      if (!result.ok) return void handlePortfolioApiFailure(result);
      setPortfolioHoroscope(null);
      invalidatePreviewReview(true);
      refreshDashboard();
    } catch {
      setDraftError("We could not remove the attachment. Please try again.");
    } finally {
      setRemovingHoroscope(false);
    }
  }

  return (
    <div className="dashboard-shell flex flex-1 flex-col">
      <div className="contents" inert={formOpen || reviewOpen} aria-hidden={formOpen || reviewOpen}>
      <CustomerAppHeader currentPage="dashboard" userEmail={userEmail} />

      <main id="main-content" tabIndex={-1} className="relative flex-1 px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-5xl">
          {pilotAccessState?.isPilotAdministrator ? <section className="mb-6 flex flex-col gap-4 rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-surface)] p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Pilot administration">
            <div><p className="font-semibold">Creator insights</p><p className="mt-2 text-sm text-[var(--workspace-muted)]">Review private onboarding feedback from introduction creators.</p></div>
            <Link href="/admin/onboarding-feedback" className="dashboard-primary-action min-h-11 justify-center">View feedback</Link>
          </section> : null}
          {!formOpen && !reviewOpen && (refreshing || openingReview || preparingPreview || renewing || rotatingLink || unpublishing || savingDraft || reviewPreviewSaving) && <LoadingStatus compact className="mb-4" title={renewing ? "Reactivating your Introduction link" : rotatingLink ? "Replacing your Introduction link" : unpublishing ? "Unpublishing your introduction" : openingReview ? "Preparing your saved review" : preparingPreview ? "Preparing your introduction preview" : savingDraft ? "Saving your private draft" : reviewPreviewSaving ? "Saving preview progress" : "Refreshing your dashboard"} />}
          <div className="flex flex-col gap-6">
          {!canCreatePortfolio && !portfolio ? (
            <section className="dashboard-glass dashboard-onboarding flex flex-col items-center gap-6 px-6 py-12 text-center sm:px-12">
              <div className="rounded-full bg-[var(--ui-success-surface)] p-4">
                <LockKeyhole className="h-7 w-7 text-[var(--workspace-ink)]" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--workspace-ink)]">
                  Account setup
                </p>
                <h1 className="mt-2 text-3xl font-medium text-[var(--workspace-ink)]">
                  Your introduction is not ready to start yet.
                </h1>
                <p className="mx-auto mt-4 max-w-xl text-[var(--workspace-muted)]">
                  Please refresh this page. If this continues, contact VivIntro support. Your existing account and shared-link access remain available.
                </p>
              </div>
              <button type="button" className="dashboard-primary-action" onClick={() => refreshDashboard()}>Refresh account status</button>
            </section>
          ) : !portfolio?.is_published ? (
            <section className="dashboard-glass flex flex-col items-start gap-4 p-6 sm:p-6" aria-label="Your introduction">
              <div className="rounded-full bg-[var(--ui-success-surface)] p-4">
                <Edit3 className="h-7 w-7 text-[var(--workspace-ink)]" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--workspace-ink)]">
                  {portfolio ? "Continue your saved draft" : "Start your introduction"}
                </p>
                <h1 className="mt-2 text-3xl font-medium text-[var(--workspace-ink)]">
                  {portfolio ? "Your introduction is saved privately." : "Let’s build one clear introduction."}
                </h1>
                <p className="mx-auto mt-4 max-w-lg text-[var(--workspace-muted)]">
                  {portfolio
                    ? completion.readyToPublish
                      ? "Your required answers are complete. You can edit at any time; follow the publishing checklist below when you are ready to share."
                      : `${completion.completedCount} of ${completion.totalCount} required details complete. Next: ${completion.missing[0]?.label || completion.invalidAnswers[0]?.label || nextRequiredSectionLabel} in ${nextRequiredSectionLabel}. Your saved answers are waiting for you.`
                    : "Begin with the main details. Add photos, family information, and your horoscope when you are ready."}
                </p>
              </div>
              {canCreatePortfolio ? (
                <div className="flex w-full flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="dashboard-secondary-action"
                >
                  <PanelRightOpen className="h-4 w-4" />
                  {portfolio
                      ? "Edit details"
                      : "Start with the basics"}
                </button>
                {portfolio && completion.readyToPublish && <button type="button" onClick={() => { void openFinalReview(); }} disabled={openingReview} className="dashboard-primary-action"><Send className="h-4 w-4" aria-hidden="true" />{openingReview ? "Preparing review…" : "Review and publish"}</button>}
                </div>
              ) : (
                <p className="rounded-xl border border-[var(--workspace-border)] bg-[var(--ui-success-surface)] px-4 py-4 text-sm text-[var(--workspace-ink)]">
                  Creator access is paused for this account. Your saved introduction and history remain available.
                </p>
              )}
              <p className="text-sm text-[var(--workspace-muted)]">Save your work and continue later. Nothing is published until you complete the final review.</p>
            </section>
          ) : (
              <section className="dashboard-welcome">
                <div>
                  {publicShareReady && isExpired && <span className="dashboard-status is-expired">Introduction link expired</span>}
                  <h1>{publishedProfileNeedsUpdate ? "Update your profile to resume sharing." : publicShareReady ? isExpired ? "Your Introduction link has expired." : "Your Introduction is ready to share." : "Your Introduction is not shareable yet."}</h1>
                  {(!publicShareReady || isExpired) && <p>{publishedProfileNeedsUpdate ? "Update the required details, confirm consent, and publish to resume sharing." : isExpired ? "Reactivate the link before sharing again. Your introduction and previous activity remain available." : "Complete the required steps to share your Introduction. Your saved details remain private."}</p>}
                  {readinessState.verificationStatus === "test_exempt" && <p className="dashboard-test-exemption-note">Test publishing access is active for this account. This is not Didit identity verification.</p>}
                </div>
                {!viewerAccessAvailable && <div className="dashboard-welcome-actions">
                  {canCreatePortfolio && (
                    <button type="button" onClick={() => setFormOpen(true)} className="dashboard-edit-action dashboard-secondary-action">
                      <Edit3 className="h-4 w-4" aria-hidden="true" /> <span>Edit details</span>
                    </button>
                  )}
                  {!publicShareReady ? null : isExpired
                    ? canCreatePortfolio && (
                      <button type="button" onClick={renewLink} disabled={renewing} className="dashboard-primary-action">
                        <RefreshCw className={`h-4 w-4 ${renewing ? "animate-spin" : ""}`} />
                        {renewing ? "Reactivating link..." : "Reactivate public link"}
                      </button>
                    )
                    : <button type="button" onClick={shareWhatsApp} className="dashboard-primary-action"><Share2 className="h-4 w-4" aria-hidden="true" /> Share on WhatsApp</button>}
                </div>}
              </section>
          )}

          {draftError && !formOpen && !reviewOpen && <p role="alert" className="dashboard-action-error">{draftError}</p>}
          {(canCreatePortfolio || portfolio) && <>
          {canCreatePortfolio && portfolio && !(readinessState.published && completion.readyToPublish) && (
            <CreatorReadinessTracker completion={completion} readiness={readinessState} introductionLive={viewerAccessAvailable}
              draftSaveState={draftSaveState} onContinue={openEditorAtRequiredStep}
              openingReview={openingReview} onVerification={focusLivenessCheck} />
          )}
          {canCreatePortfolio && activeCandidateId ? <div id="liveness-check" className="dashboard-liveness-slot scroll-mt-28" tabIndex={-1}>
            <IdentityVerificationDashboard candidateId={activeCandidateId} onStatusChange={onVerificationStatusChange} hideWhenVerified initiallyVerified={readinessState.verificationStatus === "verified"} />
          </div> : null}
          {portfolio && <section className="dashboard-overview" aria-label="Introduction overview">
            {viewerAccessAvailable ? (
              <section className="dashboard-glass dashboard-sharing-card" aria-label="Introduction link">
                <h3 className="text-base font-semibold">Introduction link</h3>
                <p className="dashboard-sharing-description">Share this link for your public introduction. You choose who sees your private details.</p>
                <div className="dashboard-share-link-row">
                  <code className="dashboard-share-url flex-1 overflow-x-auto rounded-lg bg-[var(--workspace-canvas)] px-4 py-2 text-sm text-[var(--workspace-muted)]">
                    {shareUrl}
                  </code>
                  <button
                    onClick={copyLink}
                    className="dashboard-secondary-action"
                  >
                    {copied ? "Link copied" : "Copy link"}
                  </button>
                  <span role="status" className="sr-only">{copied ? "Introduction link copied." : ""}</span>
                </div>
                <div className="dashboard-sharing-actions">
                  {canCreatePortfolio && <button type="button" onClick={() => setFormOpen(true)} className="dashboard-secondary-action"><Edit3 className="h-4 w-4" aria-hidden="true" />Edit details</button>}
                  <button type="button" onClick={shareWhatsApp} className="dashboard-primary-action"><Share2 className="h-4 w-4" aria-hidden="true" />Share on WhatsApp</button>
                </div>
                <section className="dashboard-link-settings" aria-label="Manage link">
                  <h3 className="text-sm font-semibold">Manage link</h3>
                  <p>Rotating replaces the URL. Unpublishing turns off viewer access.</p>
                  <div className="dashboard-link-controls" role="group" aria-label="Manage introduction link">
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
                </section>
              </section>
            ) : portfolio ? (
              <div className="dashboard-glass p-4">
                <p className="text-sm font-semibold text-[var(--workspace-ink)]">{publishedProfileNeedsUpdate ? "Update required before sharing" : "Public sharing is off"}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                  {publishedProfileNeedsUpdate ? "Your published profile no longer meets the required details. Update your saved details, confirm consent, and publish before sharing again."
                    : isExpired ? "This Introduction link has expired. Reactivate it above before copying or sharing it. Your saved introduction and activity remain available."
                    : readinessState.verificationStatus === "test_exempt"
                    ? "Review and publish your self-created introduction to activate its link. Test publishing access does not confirm identity."
                    : "Your saved introduction, interests, sharing history, and view totals remain available here. Public sharing requires your own introduction and current verification."}
                </p>
                {publishedProfileNeedsUpdate && canCreatePortfolio && <button type="button" className="dashboard-primary-action mt-4" onClick={() => {
                  if (completion.readyToPublish) void openFinalReview();
                  else openEditorAtRequiredStep();
                }}>Update Profile to Resume Sharing</button>}
                {portfolio?.is_published && (
                  <button onClick={unpublishPortfolio} disabled={unpublishing} className="dashboard-danger-action mt-4">
                    <LockKeyhole className="h-4 w-4" /> {unpublishing ? "Unpublishing..." : "Unpublish"}
                  </button>
                )}
              </div>
            ) : null}

            {portfolio && <div className="dashboard-overview-actions flex flex-wrap gap-4">
              <a
                href="/preview"
                target="_blank" rel="noopener noreferrer"
                onClick={() => { void recordOverviewPreview("public"); }}
                className="dashboard-secondary-action"
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview public introduction
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <a
                href="/approved-preview"
                target="_blank" rel="noopener noreferrer"
                onClick={() => { void recordOverviewPreview("complete"); }}
                className="dashboard-secondary-action"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Preview private details
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>}
            {portfolio?.published_at && <div className="dashboard-stats-grid" aria-label="Introduction activity at a glance">
              <div className="dashboard-glass dashboard-stat-card" data-stat-state="neutral">
                <div className="dashboard-stat-label"><Inbox aria-hidden="true" /><span>Latest interests</span></div>
                <p className="dashboard-stat-value">{interestItems.length === 50 ? "50+" : interestItems.length}</p>
                <span className="dashboard-stat-caption">{interestItems.length === 50 ? "Showing the latest 50 interests" : "Interests received"}</span>
              </div>
              <div className="dashboard-glass dashboard-stat-card" data-stat-state={pendingInterestCount > 0 ? "action" : "neutral"}>
                <div className="dashboard-stat-label"><Clock aria-hidden="true" /><span>Needs review</span></div>
                <p className="dashboard-stat-value">{pendingInterestCount}</p>
                {pendingInterestCount > 0
                  ? <a className="dashboard-stat-detail" href="#introductions-and-access" onClick={() => setExpandedRelationshipStages((current) => ({ ...current, awaiting: true }))}>Review interests</a>
                  : <span className="dashboard-stat-caption">{interestItems.length === 50 ? "None in latest 50" : "All caught up"}</span>}
              </div>
              <div className="dashboard-glass dashboard-stat-card" data-stat-state="neutral">
                <div className="dashboard-stat-label"><ShieldCheck aria-hidden="true" /><span>Currently sharing with</span></div>
                <p className="dashboard-stat-value">{activeAccessCount}</p>
                {activeAccessCount > 0
                  ? viewerAccessAvailable
                    ? <a className="dashboard-stat-detail" href="#introductions-and-access" onClick={() => setExpandedRelationshipStages((current) => ({ ...current, access: true }))}>Manage access</a>
                    : <a className="dashboard-stat-detail" href="#introductions-and-access" onClick={() => setExpandedRelationshipStages((current) => ({ ...current, access: true }))}>Viewing unavailable · Manage</a>
                  : <span className="dashboard-stat-caption">No current grants</span>}
              </div>
              <div className="dashboard-glass dashboard-stat-card" data-stat-state="neutral">
                <div className="dashboard-stat-label"><Eye aria-hidden="true" /><span>Introduction views</span></div>
                <p className="dashboard-stat-value">{viewCount}</p>
                <span className="dashboard-stat-caption">All recorded opens</span>
              </div>
            </div>}
          </section>}

          <ReceivedBrokerIntroductions introductions={receivedBrokerIntroductions} />
          {showRelationshipDashboard && <RelationshipLifecycle
            renderedAt={renderedAt}
            expandedStages={expandedRelationshipStages}
            onToggleStage={(stage) => setExpandedRelationshipStages((current) => ({ ...current, [stage]: !current[stage] }))}
            interests={interestItems}
            grants={accessGrants}
            viewerAccessAvailable={viewerAccessAvailable}
            events={accessEvents}
            brokerResponses={brokerIntroductionResponses}
            disclosedCategories={disclosedCategories}
            onDecision={(id, status) => {
              setInterestItems((current) =>
                current.map((interest) =>
                  interest.id === id ? { ...interest, status } : interest
                )
              );
              refreshDashboard();
            }}
            onGrantChange={(grantId, action, expiresAt) => {
              setAccessGrants((current) => current.map((grant) =>
                grant.id === grantId
                  ? action === "revoke"
                    ? { ...grant, status: "revoked", revokedAt: new Date().toISOString() }
                    : { ...grant, status: "active", expiresAt: expiresAt || grant.expiresAt }
                  : grant
              ));
              refreshDashboard();
            }}
          />}
          </>}
          </div>
          {portfolio && completion.readyToPublish && draftSaveState === "saved" && <CreatorOnboardingFeedback />}
        </div>
      </main>
      </div>

      {canCreatePortfolio && reviewOpen && (
        <div className="dashboard-review-overlay fixed inset-0 z-[60] bg-[color:var(--ui-scrim)]/70 p-4 backdrop-blur-sm sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="portfolio-review-heading"
            className="dashboard-review-dialog mx-auto flex h-full w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl bg-[var(--workspace-canvas)] text-[var(--workspace-ink)] dashboard-dialog-elevation"
          >
            <header className="dashboard-review-header flex flex-none flex-col gap-4 border-b border-[var(--workspace-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="dashboard-review-eyebrow text-xs font-semibold uppercase tracking-[0.16em] text-[var(--workspace-gold)]">Review before publishing</p>
                <h2 ref={reviewHeadingRef} tabIndex={-1} id="portfolio-review-heading" className="mt-2 text-xl font-semibold">Review and publish</h2>
                <p className="dashboard-review-guidance mt-2 text-sm text-[var(--workspace-muted)]">
                  {publishing
                    ? "Your reviewed introduction is being published. This page will update when the result is ready."
                    : "Confirm what you want to share, then publish. You can open either preview if you’d like to check the details."}
                </p>
              </div>
              <div className="app-header-actions">
                <ThemeSwitch />
                <button type="button" className="dashboard-secondary-action dashboard-review-edit" aria-label="Back to editing" disabled={publishing} onClick={() => { setReviewOpen(false); setFormOpen(true); }}><Edit3 aria-hidden="true" className="h-4 w-4" /><span>Back to editing</span></button>
              </div>
            </header>

            <div className="dashboard-review-content min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {publishing ? (
                <PortfolioLoadingStatus
                  title={portfolio?.is_published ? "Publishing your changes" : "Publishing your introduction"}
                  detail="We are preparing your Introduction link. Keep this page open until the result appears."
                  state="weaving"
                  className="mx-auto min-h-full justify-center py-12"
                />
              ) : (
                <>
                  <section aria-labelledby="publish-readiness-heading" className="mt-4 rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-surface)] p-4 sm:p-6">
                    <h3 id="publish-readiness-heading" className="font-semibold">Publishing checklist</h3>
                     <p className="mt-2 text-sm text-[var(--workspace-muted)]">Follow the next incomplete step below. Publishing activates your public introduction link; you still choose who sees your private details.</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <ReviewRequirement complete={completion.readyToPublish} label="Required details complete" pendingLabel={completion.missing.length ? `${completion.missing.length} required item${completion.missing.length === 1 ? "" : "s"} missing` : completion.invalidAnswers[0]?.label || "Review your answers"} />
                      <ReviewRequirement complete={canPublishWithVerificationStatus(readinessState.verificationStatus)} label={readinessState.verificationStatus === "test_exempt" ? "Test publishing access active (not Didit verified)" : "Liveness checks complete"} pendingLabel="Complete the liveness checks" />
                      <ReviewRequirement complete={readinessState.paymentActive} label="Creator account active" pendingLabel="Creator account required" />
                      <ReviewRequirement complete={readinessState.disclosureConfirmed || sensitiveDisclosureAccepted} label="Publication consent given" pendingLabel="Give consent when all other steps are complete" />
                    </div>
                  </section>
                  {readyForPublicationConsent ? <label className="mt-4 flex items-start gap-4 rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-canvas)] p-4 text-sm leading-6">
                    <input type="checkbox" className="mt-2 h-5 w-5 shrink-0" checked={sensitiveDisclosureAccepted} onChange={(event) => setSensitiveDisclosureAccepted(event.target.checked)} />
                    <span>I consent to publish my saved introduction. My full name and marital status will be visible to anyone with my active link. Contact information, exact birth details, and other private details are shared only when I choose. <a href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2">Privacy Policy</a></span>
                  </label> : <p className="mt-4 rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-surface-muted)] p-4 text-sm leading-6 text-[var(--workspace-muted)]">Complete the required details, liveness check and account setup to give publication consent here. Consent for the liveness check is requested separately.</p>}
                  <h3 className="mt-6 font-semibold">Optional previews</h3>
                  <div id="review-preview-links" className="mt-4 grid gap-4 lg:grid-cols-2">
                    <article className="flex flex-col rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-surface)] p-4 sm:p-6">
                      <div className="border-b border-[var(--workspace-border)] pb-4">
                        <h3 className="font-semibold">Public introduction</h3>
                        <p className="mt-2 text-xs text-[var(--workspace-muted)]">Visible to anyone with your active link.</p>
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-4 pt-4">
                        <p className="text-sm leading-6 text-[var(--workspace-muted)]">Check your primary photo and the details people can see without showing interest.</p>
                        <a id="review-public-preview" href="/preview" target="_blank" rel="noreferrer" onClick={() => recordReviewPreview("public")} className="dashboard-secondary-action w-full justify-center sm:w-fit">
                          <ExternalLink className="h-4 w-4" />
                          Review public introduction
                        </a>
                      </div>
                    </article>
                    <article className="flex flex-col rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-surface)] p-4 sm:p-6">
                      <div className="border-b border-[var(--workspace-border)] pb-4">
                        <h3 className="font-semibold">{PORTFOLIO_VIEW_LABELS.complete} · People you choose to share with</h3>
                        <p className="mt-2 text-xs text-[var(--workspace-muted)]">Visible only to someone whose email is verified and you choose to share with.</p>
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-4 pt-4">
                        <p className="text-sm leading-6 text-[var(--workspace-muted)]">Check the additional details and photos you are willing to share when you choose to share.</p>
                        <a id="review-complete-preview" href="/approved-preview" target="_blank" rel="noreferrer" onClick={() => recordReviewPreview("complete")} className="dashboard-secondary-action w-full justify-center sm:w-fit">
                          <ExternalLink className="h-4 w-4" />
                          Review private details
                        </a>
                      </div>
                    </article>
                  </div>
                </>
              )}
            </div>

            <footer className="dashboard-review-footer flex-none border-t border-[var(--workspace-border)] bg-[var(--workspace-surface)] px-4 py-4 sm:px-6">
              <div>
                <p className="text-sm font-semibold">{readyForPublicationConsent ? "Ready to confirm publication." : "Your saved changes are not public yet."}</p>
                <p className="dashboard-review-footer-note mt-2 text-xs text-[var(--workspace-muted)]">Private details stay hidden until you choose to share them with someone whose email is verified.</p>
                {draftError && <p className="dashboard-action-error mt-2" role="alert">{draftError}</p>}
                {reviewPreviewSaving && !publishing && <LoadingStatus compact title="Saving your preview progress" />}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button type="button" className="dashboard-secondary-action" disabled={publishing} onClick={() => setReviewOpen(false)}>Back to dashboard</button>
                {!completion.readyToPublish || draftData.privacy_mode === "private" ? <button type="button" className="dashboard-primary-action" onClick={() => { setReviewOpen(false); openEditorAtRequiredStep(); }}>
                  <Edit3 className="h-4 w-4" /> Complete {nextRequiredSectionLabel}
                </button> : !verificationComplete && !activeCandidateId ? <button type="button" className="dashboard-primary-action" onClick={() => { setReviewOpen(false); refreshDashboard(); }}>
                  <RefreshCw className="h-4 w-4" /> Refresh verification setup
                </button> : !verificationComplete ? <button type="button" className="dashboard-primary-action" onClick={goToLivenessCheck}>
                  <ShieldCheck className="h-4 w-4" /> Go to liveness check
                </button> : !readinessState.paymentActive ? <button type="button" className="dashboard-primary-action" onClick={() => { setReviewOpen(false); refreshDashboard(); }}>
                  <RefreshCw className="h-4 w-4" /> Refresh account status
                </button> : <button
                  type="button"
                  className="dashboard-primary-action"
                  disabled={
                    publishing || reviewPreviewSaving
                    || !sensitiveDisclosureAccepted
                    || !readyForPublicationConsent
                  }
                  onClick={publishPortfolio}
                >
                  <Send className={`h-4 w-4 ${publishing ? "animate-pulse" : ""}`} />
                  {publishing
                    ? "Publishing..."
                    : "Save and publish"}
                </button>
                }
              </div>
            </footer>
          </section>
        </div>
      )}

      {canCreatePortfolio && formOpen && (
        <div className="dashboard-editor fixed inset-0 z-50 bg-[color:var(--ui-scrim)]/45 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="portfolio-editor-heading" className="dashboard-editor-surface absolute inset-0 flex h-full w-full flex-col overflow-hidden dashboard-dialog-elevation">
            <div className="dashboard-editor-header flex-none border-b border-[var(--workspace-border)] px-4 py-4 sm:px-6 lg:px-8">
              <div className="dashboard-editor-header-layout mx-auto flex w-full max-w-[90rem] items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-4">
                    <h2 id="portfolio-editor-heading" tabIndex={-1} className="text-lg font-semibold">Introduction details</h2>
                    <span className={`dashboard-save-state is-${draftSaveState}`} aria-live="polite">
                      {draftSaveState === "saving"
                        ? "Saving..."
                        : draftSaveState === "saved"
                          ? portfolio?.is_published ? "Draft saved" : "Saved"
                          : "Changes not saved"}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--workspace-muted)]">
                    Complete what you know. Save your work and continue later.
                  </p>
                </div>
                <div className="app-header-actions"><ThemeSwitch /><button
                  type="button"
                  aria-label="Back to dashboard"
                  onClick={closePortfolioEditor}
                  className="dashboard-secondary-action flex-none"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to dashboard</span>
                  <span className="sm:hidden">Dashboard</span>
                </button></div>
              </div>
            </div>

            <div className="dashboard-editor-mobile-step flex-none px-4 py-2 lg:hidden">
              <PortfolioMobileSectionNav activeSection={editorSection} completedCount={completion.completedCount} totalCount={completion.totalCount} onSectionChange={rememberEditorSection} />
            </div>
            <div className="dashboard-editor-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 [scrollbar-gutter:stable] sm:px-6 lg:px-8">
              <div className="mx-auto w-full max-w-[90rem]">
                <BlueprintForm
                  data={draftData}
                  onUpdate={updateSection}
                  activeSection={editorSection}
                  onSectionChange={rememberEditorSection}
                  validationIssues={[...validationIssues, ...serverFieldIssues.filter(issue => !validationIssues.some(local => local.path === issue.path))]}
                  onErrorSelect={showFieldIssue}
                  hasShareablePrimaryPhoto={portfolioMedia.some(isShareablePrimaryPhoto)}
                  photoManager={
                    <>
                    {(uploadingMedia || mediaMutations > 0) && <LoadingStatus compact className="mb-4" title={uploadingMedia ? "Uploading your photos" : "Updating your photos"} />}
                    <PhotoManager
                      media={portfolioMedia}
                      urls={mediaUrls}
                      uploading={uploadingMedia}
                      inputRef={photoInputRef}
                      onUpload={uploadPhotos}
                      onUpdate={updatePhoto}
                      onDelete={deletePhoto}
                    />
                    </>
                  }
                  horoscopeManager={
                    <>
                    {(uploadingHoroscope || removingHoroscope) && <LoadingStatus compact className="mb-4" title={removingHoroscope ? "Removing your horoscope attachment" : "Uploading your horoscope attachment"} />}
                    <HoroscopeManager
                      horoscope={portfolioHoroscope}
                      uploading={uploadingHoroscope}
                      inputRef={horoscopeInputRef}
                      onUpload={uploadHoroscopeFile}
                      onReview={reviewHoroscope}
                      onDelete={removeHoroscope}
                    />
                    </>
                  }
                />
                <p className="dashboard-editor-mobile-legal mt-6 text-xs leading-5 text-[var(--workspace-muted)]">You are responsible for the accuracy and permission to share what you enter. <a href="/terms" target="_blank" rel="noreferrer" className="underline underline-offset-2">Terms &amp; Conditions</a> · <a href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2">Privacy and corrections</a></p>
              </div>
            </div>

            <div className="dashboard-editor-footer flex-none border-t border-[var(--workspace-border)] bg-[var(--workspace-surface-muted)] px-4 py-6 sm:px-6 sm:py-6 lg:px-8">
              <div className="mx-auto w-full max-w-[90rem]">
                {(savingDraft || openingReview || preparingPreview || refreshing) && <LoadingStatus compact className="mb-4" title={savingDraft ? "Saving your private draft" : openingReview ? "Preparing your saved review" : preparingPreview ? "Preparing your introduction preview" : "Refreshing your introduction"} />}
                {draftError && (
                  <div role="alert" className="mb-4 rounded-lg border border-[var(--workspace-border)] bg-[var(--workspace-canvas)] px-4 py-4 text-sm text-[var(--ui-danger)]">
                    <p className="font-semibold">We couldn&apos;t complete that action.</p>
                    <p className="mt-2 leading-5">{draftError}</p>
                    <p className="mt-2 leading-5">Your answers are still on this screen.</p>
                    {draftSaveState === "unsaved" && (
                      <button type="button" onClick={saveDashboardDraft} disabled={savingDraft} className="mt-2 min-h-10 rounded-lg border border-[var(--workspace-border)] bg-[var(--workspace-surface)] px-4 font-semibold text-[var(--ui-danger)] hover:bg-[var(--workspace-surface)]">
                        Try saving again
                      </button>
                    )}
                  </div>
                )}
                <div className="dashboard-editor-footer-layout">
                  <div className="dashboard-editor-footer-notes"><p className="dashboard-editor-footer-copy text-sm leading-6 text-[var(--workspace-muted)]">
                    {editorSection === "privacy"
                      ? "Save your answers, then confirm consent in Review and publish. Previews are optional."
                      : portfolio?.is_published
                      ? "Changes autosave as a draft. Review and publish to update what people see."
                      : "Changes autosave as a draft. Publishing creates the introduction people can view."}
                  </p>
                  <p className="text-xs leading-5 text-[var(--workspace-muted)]">You are responsible for the accuracy and permission to share what you enter. <a href="/terms" target="_blank" rel="noreferrer" className="underline underline-offset-2">Terms &amp; Conditions</a> · <a href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2">Privacy and corrections</a></p>
                  </div><div className="dashboard-editor-actions">
                    <button
                      type="button"
                      onClick={openEarlyPreview}
                      disabled={savingDraft || preparingPreview || !completion.basicsComplete}
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
                      disabled={publishing || savingDraft || openingReview}
                      aria-label={savingDraft
                        ? "Saving..."
                        : portfolio?.is_published
                          ? "Review saved changes"
                          : "Review and publish"}
                      className="dashboard-editor-review-action dashboard-primary-action flex-1 sm:flex-none"
                    >
                      <Send className={`h-4 w-4 ${publishing ? "animate-pulse" : ""}`} />
                      <span>{savingDraft
                          ? "Saving..."
                          : portfolio?.is_published
                            ? "Review saved changes"
                            : "Review and publish"}</span>
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
    <div className="dashboard-review-requirement" data-complete={complete}>
      {complete
        ? <CheckCircle2 aria-hidden="true" />
        : <Circle aria-hidden="true" />}
      <div>
        <p className="text-sm font-semibold">{complete ? label : pendingLabel}</p>
        <span className="sr-only">{complete ? "Complete" : "Incomplete"}</span>
        {!complete && <p className="mt-2 text-xs text-[var(--workspace-muted)]">{label}</p>}
      </div>
    </div>
  );
}

function CreatorReadinessTracker({
  completion,
  readiness,
  introductionLive,
  draftSaveState,
  onContinue,
  onVerification,
  openingReview,
}: {
  completion: ReturnType<typeof calculatePortfolioCompletion>;
  readiness: PublicationReadiness;
  introductionLive: boolean;
  draftSaveState: "saved" | "unsaved" | "saving";
  onContinue: () => void;
  onVerification: () => void;
  openingReview: boolean;
}) {
  const steps = [
    { label: "Basics", complete: completion.basicsComplete },
    { label: "Required details", complete: completion.readyToPublish },
    { label: readiness.verificationStatus === "test_exempt" ? "Test publishing access" : "Liveness check", complete: canPublishWithVerificationStatus(readiness.verificationStatus) },
    { label: "Creator account", complete: readiness.paymentActive },
    { label: "Final publication consent", complete: readiness.disclosureConfirmed },
    { label: "Published", complete: readiness.published },
  ];
  const nextStep = steps.find((step) => !step.complete);
  const nextAction = !completion.readyToPublish
    ? { label: "Continue required details", onClick: onContinue }
    : !canPublishWithVerificationStatus(readiness.verificationStatus)
        ? { label: "Go to liveness check", onClick: onVerification }
        : !readiness.paymentActive
          ? null
          : null;

  return (
    <section className="dashboard-glass p-4 sm:p-6" aria-labelledby="creator-readiness-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--workspace-ink)]">{readiness.published ? "Saved draft readiness" : "Your publishing journey"}</p>
          <h2 id="creator-readiness-heading" className="mt-2 text-xl font-semibold text-[var(--workspace-ink)]">
            {completion.percentage}% of required draft answers complete
          </h2>
          <p className="mt-2 text-sm text-[var(--workspace-muted)]">
            {readiness.published ? introductionLive
              ? "Your published Introduction stays live. This checklist applies to your saved draft before publishing an update."
              : "This checklist applies to your saved draft. Your published snapshot is unchanged; see its sharing status above."
              : completion.readyToPublish && !canPublishWithVerificationStatus(readiness.verificationStatus)
              ? "Next: Liveness check. Your answers are complete, but publishing is not finished."
              : nextStep ? `Next: ${nextStep.label}` : "Your introduction is published."}
            {draftSaveState === "saving" ? " · Saving changes…" : ""}
          </p>
          {!completion.readyToPublish && <p className="mt-2 text-sm text-[var(--workspace-muted)]">Resume your saved draft at {completion.missing[0]?.label || completion.invalidAnswers[0]?.label || "the next required answer"}.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {nextAction && <button type="button" onClick={nextAction.onClick} disabled={openingReview} className="dashboard-primary-action">{openingReview ? "Loading saved review…" : nextAction.label}</button>}
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--workspace-surface-muted)]" aria-hidden="true">
        <div className="h-full rounded-full bg-[color:var(--workspace-ink)] transition-[width]" style={{ width: `${completion.percentage}%` }} />
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Publication steps">
        {steps.map((step) => (
          <li key={step.label} className={`flex min-h-12 items-center gap-2 rounded-lg border px-4 py-2 text-xs ${step.complete ? "border-[var(--workspace-border)] bg-[var(--workspace-surface-muted)] text-[var(--workspace-ink)]" : "border-[var(--workspace-border)] bg-[var(--workspace-surface)] text-[var(--workspace-muted)]"}`}>
            {step.complete
              ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              : <Circle className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span>
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      {!completion.readyToPublish && completion.missing.length > 0 ? (
        <p className="mt-4 text-xs leading-5 text-[var(--workspace-muted)]">
          Still needed: {completion.missing.slice(0, 4).map((item) => item.label).join(", ")}
          {completion.missing.length > 4 ? ` and ${completion.missing.length - 4} more` : ""}.
        </p>
      ) : null}
      {completion.invalidAnswers.length > 0 ? (
        <p className="mt-2 text-xs leading-5 text-[var(--ui-danger)]">
          Review entered answer: {completion.invalidAnswers[0].label}
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
    <section className="mb-8 border-b border-[var(--workspace-border)] pb-8">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--workspace-ink)]">
          <FileText className="h-4 w-4 text-[var(--workspace-teal)]" />
          Horoscope attachment
        </h3>
        <p className="mt-2 text-xs leading-5 text-[var(--workspace-ink-muted)]">
          One private scanned image. It appears only to signed-in people you choose to share with and opens separately from the introduction.
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
        <article className="rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-teal-soft)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--workspace-border)] bg-[var(--workspace-surface-muted)] text-[var(--workspace-teal)]">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-[var(--workspace-ink)]">Original horoscope</p>
                <p className="mt-2 text-xs text-[var(--workspace-ink-muted)]">
                  {[format, horoscope.language_label, formatBytes(horoscope.byte_size)].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-2 text-xs text-[var(--workspace-teal)]">
                  {horoscope.file_extension !== "webp"
                    ? "Legacy document — replace it with a scanned image before sharing"
                    : horoscope.published_at
                      ? "Published for people you’ve shared with"
                      : "Ready — publish or update the introduction to share it"}
                </p>
              </div>
            </div>
            <LockKeyhole className="h-4 w-4 shrink-0 text-[var(--workspace-ink-muted)]" aria-label="People you choose to share with" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onReview} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--workspace-border)] px-4 text-xs font-medium text-[var(--workspace-ink)] hover:bg-[var(--workspace-surface-muted)]">
              <ExternalLink className="h-3.5 w-3.5" /> Review
            </button>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--workspace-border)] px-4 text-xs font-medium text-[var(--workspace-ink)] hover:bg-[var(--workspace-surface-muted)] disabled:opacity-50">
              <Upload className={`h-3.5 w-3.5 ${uploading ? "animate-pulse" : ""}`} /> Replace
            </button>
            <button type="button" onClick={onDelete} className="dashboard-danger-action focus-visible:ring-2 focus-visible:ring-[var(--workspace-teal)]">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        </article>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--workspace-border)] p-4">
          <label className="block text-xs font-medium text-[var(--workspace-ink-muted)]" htmlFor="horoscope-language">Horoscope language (optional)</label>
          <input
            id="horoscope-language"
            value={language}
            maxLength={80}
            onChange={(event) => setLanguage(event.target.value)}
            placeholder="For example, Kannada"
            className="mt-2 h-10 w-full rounded-lg border border-[var(--workspace-border)] bg-[var(--workspace-surface-muted)] px-4 text-sm text-[var(--workspace-ink)] outline-none placeholder:text-[var(--workspace-ink-muted)] focus:border-[var(--workspace-border)]"
          />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--workspace-teal-soft)] px-4 text-sm font-semibold text-[var(--workspace-ink)] hover:bg-[var(--ui-warning-surface)] disabled:opacity-50">
            <Upload className={`h-4 w-4 ${uploading ? "animate-pulse" : ""}`} />
            {uploading ? "Checking attachment..." : "Attach horoscope"}
          </button>
          <p className="mt-2 text-xs leading-5 text-[var(--workspace-ink-muted)]">Scanned JPG, PNG, WebP, or HEIC · up to 20MB</p>
        </div>
      )}
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function subscribeToMobileDashboard(change: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const query = window.matchMedia("(max-width: 640px)");
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

function useMobileDashboard() {
  return useSyncExternalStore(
    subscribeToMobileDashboard,
    () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(max-width: 640px)").matches),
    () => false
  );
}

function ReceivedBrokerIntroductions({ introductions }: { introductions: ReceivedBrokerIntroduction[] }) {
  if (introductions.length === 0) return null;
  return <section className="dashboard-glass p-6 sm:p-6" aria-labelledby="broker-introductions-heading">
    <div className="flex items-start gap-4">
      <Inbox className="mt-2 h-5 w-5 text-[var(--workspace-ink)]" />
      <div>
        <h2 id="broker-introductions-heading" className="text-lg font-semibold text-[var(--workspace-ink)]">Broker introductions</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">Profiles selected for you by your broker. Only you and the other customer can open each introduction.</p>
      </div>
    </div>
    <div className="mt-4 grid gap-4">
      {introductions.map((introduction) => <article key={introduction.introductionRef} className="flex flex-col gap-4 rounded-xl border border-[var(--workspace-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <strong className="text-sm text-[var(--workspace-ink)]">{introduction.sourceName}</strong>
          <p className="mt-2 text-xs text-[var(--workspace-muted)]">From {introduction.brokerName} · {introduction.response ? `Response: ${introduction.response}` : "Your response is waiting"} · {introduction.disclosureLevel === "complete" ? "Complete access" : "respond by"} {formatAccessDate(introduction.expiresAt)}</p>
        </div>
        <Link className="dashboard-secondary-action" href={`/introductions/${introduction.introductionRef}`}>
          View introduction
        </Link>
      </article>)}
    </div>
  </section>;
}

function RelationshipLifecycle({
  renderedAt,
  expandedStages,
  onToggleStage,
  interests,
  grants,
  viewerAccessAvailable,
  events,
  brokerResponses,
  disclosedCategories,
  onDecision,
  onGrantChange,
}: {
  expandedStages: Record<RelationshipStage, boolean>;
  renderedAt: number;
  onToggleStage: (stage: RelationshipStage) => void;
  interests: DashboardInterest[];
  grants: AccessGrant[];
  viewerAccessAvailable: boolean;
  events: AccessAuditEvent[];
  brokerResponses: OwnerBrokerIntroductionResponse[];
  disclosedCategories: string[];
  onDecision: (id: string, status: "approved" | "rejected" | "pending_review") => void;
  onGrantChange: (grantId: string, action: "renew" | "revoke", expiresAt?: string) => void;
}) {
  type ListModal = RelationshipStage | "history" | null;
  type RecordDetail =
    | { kind: "interest"; item: DashboardInterest }
    | { kind: "grant"; item: AccessGrant }
    | { kind: "broker-response"; item: OwnerBrokerIntroductionResponse }
    | null;

  const waitingInterests = sortByNewest(interests.filter((interest) => interest.status === "new" || interest.status === "pending_review"), (interest) => interest.created_at);
  const setAsideInterests = sortByNewest(interests.filter((interest) => interest.status === "rejected"), (interest) => interest.created_at);
  const activeGrants = sortByNewest(grants.filter((grant) => grant.status === "active"), (grant) => grant.renewedAt || grant.expiresAt);
  const historicalGrants = sortByNewest(grants.filter((grant) => grant.status !== "active"), (grant) => grant.revokedAt || grant.expiresAt);
  const archivedInterests = sortByNewest(interests.filter((interest) => !["new", "pending_review", "rejected"].includes(interest.status)), (interest) => interest.created_at);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approvalCandidate, setApprovalCandidate] = useState<DashboardInterest | null>(null);
  const [listModal, setListModal] = useState<ListModal>(null);
  const [recordDetail, setRecordDetail] = useState<RecordDetail>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [recordFilter, setRecordFilter] = useState("all");
  const [page, setPage] = useState(1);
  const isMobileDashboard = useMobileDashboard();
  const approvalTitleId = useId();
  const approvalConfirmRef = useRef<HTMLButtonElement>(null);
  const listTitleId = useId();
  const detailTitleId = useId();
  const closeListRef = useRef<HTMLButtonElement>(null);
  const closeDetailRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!listModal && !recordDetail) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTarget = recordDetail ? closeDetailRef.current : closeListRef.current;
    focusTarget?.focus();
    const handleKey = (event: KeyboardEvent) => {
      // The disclosure confirmation owns Escape while it is open. Closing it
      // must return the owner to this request, not dismiss both dialogs.
      if (approvalCandidate) return;
      const dialog = (recordDetail ? closeDetailRef.current : closeListRef.current)?.closest<HTMLElement>("[role='dialog']") || null;
      if (event.key === "Escape" && workingId === null) {
        if (recordDetail) setRecordDetail(null);
        else setListModal(null);
        return;
      }
      trapDialogFocus(event, dialog);
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [listModal, recordDetail, workingId, approvalCandidate]);

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
      setRecordDetail(null);
      return true;
    } catch {
      setActionError("This interest could not be updated. Please try again.");
      return false;
    } finally {
      setWorkingId(null);
    }
  }

  async function manage(grant: AccessGrant, action: "renew" | "revoke") {
    const prompt = action === "revoke"
      ? `Stop sharing with ${grant.viewerName || "this person"}? They will no longer be able to open the private details.`
      : `Share private details with ${grant.viewerName || "this person"} for another 15 days?`;
    if (!confirm(prompt)) return;
    setWorkingId(grant.id);
    setActionError(null);
    try {
      const { manageAccessGrantRequest } = await import("@/features/access/client/access-dashboard.api");
      const result = await manageAccessGrantRequest(grant.id, action);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      onGrantChange(grant.id, action, result.expiresAt);
      setRecordDetail(null);
    } finally {
      setWorkingId(null);
    }
  }

  function openList(mode: Exclude<ListModal, null>) {
    setSearchQuery("");
    setRecordFilter("all");
    setPage(1);
    setListModal(mode);
  }

  const listRecords = listModal === "awaiting"
    ? waitingInterests.map((item) => ({ kind: "interest" as const, item }))
    : listModal === "set-aside"
      ? setAsideInterests.map((item) => ({ kind: "interest" as const, item }))
      : listModal === "access"
        ? activeGrants.map((item) => ({ kind: "grant" as const, item }))
        : [
            ...historicalGrants.map((item) => ({ kind: "grant" as const, item })),
            ...archivedInterests.map((item) => ({ kind: "interest" as const, item })),
            ...brokerResponses.map((item) => ({ kind: "broker-response" as const, item })),
          ];
  const filteredRecords = listRecords.filter((record) => {
    const name = record.kind === "interest" ? record.item.viewer_name : record.kind === "grant" ? record.item.viewerName : record.item.recipientLabel;
    const email = record.kind === "interest" ? record.item.viewer_email : record.kind === "grant" ? record.item.viewerEmail : null;
    const source = record.kind === "interest" ? record.item.source_type : record.kind === "grant" ? record.item.sourceType || "direct" : "broker";
    const matchesSearch = `${name || ""} ${email || ""}`.toLowerCase().includes(searchQuery.trim().toLowerCase());
    if (!matchesSearch) return false;
    if (recordFilter === "direct" || recordFilter === "broker") return source === recordFilter;
    if (recordFilter === "verified") return record.kind === "interest" && record.item.email_verified;
    if (recordFilter === "pending") return record.kind === "interest" && ["new", "pending_review"].includes(record.item.status);
    if (recordFilter === "active") return record.kind === "grant" && record.item.status === "active";
    if (recordFilter === "ended") return record.kind === "grant" && record.item.status !== "active";
    return true;
  });
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const listTitle = listModal === "awaiting"
    ? "Awaiting review"
    : listModal === "set-aside"
      ? "Interests set aside"
      : listModal === "access"
        ? "People you’re sharing with"
        : "Relationship history";

  return (
    <section id="introductions-and-access" className="dashboard-glass dashboard-relationship-lifecycle" aria-labelledby="relationship-lifecycle-heading">
      <div className="dashboard-section-heading">
        <div>
          <h2 id="relationship-lifecycle-heading">Introductions and access</h2>
          <p>Your latest actionable relationships. Open a queue for complete details and history.</p>
        </div>
        <span>{waitingInterests.length} waiting</span>
      </div>
      {workingId && !recordDetail && !approvalCandidate && <LoadingStatus compact className="my-4" title="Updating this interest" />}
      {actionError && <p className="dashboard-action-error" role="alert">{actionError}</p>}

      <CompactRelationshipStage
        stage="awaiting"
        title="Awaiting review"
        description="New interests ready for your decision. Check each person's verification status before sharing more."
        count={waitingInterests.length}
        expanded={!isMobileDashboard || expandedStages.awaiting}
        onToggle={() => onToggleStage("awaiting")}
        onViewAll={() => openList("awaiting")}
        empty="New interests will appear here after viewers introduce themselves."
      >
        {waitingInterests.slice(0, 3).map((interest) => (
          <InterestSummaryCard key={interest.id} interest={interest} statusLabel="Awaiting review" primaryLabel="Review" onPrimary={() => setRecordDetail({ kind: "interest", item: interest })} />
        ))}
      </CompactRelationshipStage>

      <CompactRelationshipStage
        stage="set-aside"
        title="Interests set aside"
        description="Interests you can revisit when you are ready."
        count={setAsideInterests.length}
        expanded={!isMobileDashboard || expandedStages["set-aside"]}
        onToggle={() => onToggleStage("set-aside")}
        onViewAll={() => openList("set-aside")}
        empty="No interests are currently set aside."
      >
        {setAsideInterests.slice(0, 3).map((interest) => (
          <InterestSummaryCard key={interest.id} interest={interest} statusLabel="Set aside" primaryLabel={workingId === interest.id ? "Reopening…" : "Reopen"} disabled={workingId === interest.id} onPrimary={() => void decide(interest, "reopened")} />
        ))}
      </CompactRelationshipStage>

      <CompactRelationshipStage
        stage="access"
        title="People you’re sharing with"
        description={viewerAccessAvailable ? "People you’ve shared with can open private details until their sharing period ends." : "Sharing choices remain on record, but private details cannot be opened while your introduction is unavailable."}
        count={activeGrants.length}
        expanded={!isMobileDashboard || expandedStages.access}
        onToggle={() => onToggleStage("access")}
        onViewAll={() => openList("access")}
        empty="You’re not sharing private details with anyone yet."
      >
        {activeGrants.slice(0, 3).map((grant) => (
          <GrantSummaryCard key={grant.id} grant={grant} renderedAt={renderedAt} viewerAccessAvailable={viewerAccessAvailable} onPrimary={() => setRecordDetail({ kind: "grant", item: grant })} />
        ))}
      </CompactRelationshipStage>

      <button type="button" className="dashboard-history-action" onClick={() => openList("history")}>
        <History className="h-4 w-4" aria-hidden="true" />
        Sharing history
      </button>
      <InterestHistoryPanel />

      {listModal && !recordDetail && (
        <DashboardModal titleId={listTitleId} title={listTitle} closeLabel="Close and return to dashboard" closeRef={closeListRef} onClose={() => setListModal(null)}>
          <div className="dashboard-modal-tools">
            <label>
              <span className="sr-only">Search {listTitle.toLowerCase()}</span>
              <Search aria-hidden="true" />
              <input name="relationship-search" autoComplete="off" spellCheck={false} value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }} placeholder="Search by name or email…" />
            </label>
            <label>
              <span className="sr-only">Filter records</span>
              <select name="relationship-filter" value={recordFilter} onChange={(event) => { setRecordFilter(event.target.value); setPage(1); }}>
                <option value="all">All records</option>
                <option value="direct">Direct introductions</option>
                <option value="broker">Broker introductions</option>
                <option value="verified">Verified email</option>
                <option value="pending">Pending review</option>
                <option value="active">Currently sharing with</option>
                <option value="ended">Ended access</option>
              </select>
            </label>
          </div>
          <div className="dashboard-modal-list">
            {visibleRecords.length === 0 ? <p className="dashboard-empty-state">No records match this search and filter.</p> : visibleRecords.map((record) => record.kind === "interest" ? (
              <InterestSummaryCard key={`interest-${record.item.id}`} interest={record.item} statusLabel={interestStatusLabel(record.item.status)} primaryLabel="Open details" onPrimary={() => setRecordDetail(record)} />
            ) : record.kind === "grant" ? (
              <GrantSummaryCard key={`grant-${record.item.id}`} grant={record.item} renderedAt={renderedAt} viewerAccessAvailable={viewerAccessAvailable} onPrimary={() => setRecordDetail(record)} />
            ) : (
              <BrokerResponseSummaryCard key={record.item.introductionRef} response={record.item} onPrimary={() => setRecordDetail(record)} />
            ))}
          </div>
          {listModal === "history" && events.length > 0 && (
            <div className="dashboard-history-timeline">
              <h3>Activity log</h3>
              <ol>{events.slice(0, 20).map((event) => <li key={event.id}><span>{accessEventLabel(event.eventType, event.viewerName)}</span><time dateTime={event.createdAt}>{formatAccessDate(event.createdAt)}</time></li>)}</ol>
            </div>
          )}
          {pageCount > 1 && (
            <nav className="dashboard-modal-pagination" aria-label={`${listTitle} pages`}>
              <button type="button" className="dashboard-secondary-action" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft aria-hidden="true" /> Previous</button>
              <span>Page {currentPage} of {pageCount}</span>
              <button type="button" className="dashboard-secondary-action" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next <ChevronRight aria-hidden="true" /></button>
            </nav>
          )}
        </DashboardModal>
      )}

      {recordDetail && (
        <DashboardModal titleId={detailTitleId} title={recordDetail.kind === "interest" ? recordDetail.item.viewer_name || "Introduction details" : recordDetail.kind === "grant" ? recordDetail.item.viewerName || "Sharing details" : recordDetail.item.recipientLabel} closeLabel="Close details" closeRef={closeDetailRef} onClose={() => setRecordDetail(null)} detail inactive={Boolean(approvalCandidate)}>
          {recordDetail.kind === "interest" ? (
            <InterestDetail interest={recordDetail.item} />
          ) : recordDetail.kind === "grant" ? (
            <GrantDetail grant={recordDetail.item} viewerAccessAvailable={viewerAccessAvailable} />
          ) : (
            <BrokerResponseDetail response={recordDetail.item} />
          )}
          {recordDetail.kind !== "broker-response" && <InterestDetailsPanel requestId={recordDetail.kind === "interest" ? recordDetail.item.id : recordDetail.item.interestRequestId} />}
          <div className="dashboard-modal-sticky-actions">
            {workingId && !approvalCandidate && <LoadingStatus compact title="Updating sharing" />}
            {recordDetail.kind === "interest" ? (
              <InterestActions
                interest={recordDetail.item}
                working={workingId === recordDetail.item.id}
                onSetAside={() => void decide(recordDetail.item, "rejected")}
                onReopen={() => void decide(recordDetail.item, "reopened")}
                onGrant={() => setApprovalCandidate(recordDetail.item)}
              />
            ) : recordDetail.kind === "grant" && recordDetail.item.status !== "revoked" ? (
              <>
                <button type="button" className="dashboard-secondary-action" disabled={workingId === recordDetail.item.id} onClick={() => void manage(recordDetail.item, "renew")}>Share for another 15 days</button>
                {recordDetail.item.status === "active" && <button type="button" className="dashboard-danger-action" disabled={workingId === recordDetail.item.id} onClick={() => void manage(recordDetail.item, "revoke")}>Stop sharing</button>}
              </>
            ) : null}
          </div>
        </DashboardModal>
      )}

      {approvalCandidate && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[color:var(--ui-scrim)]/65 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={approvalTitleId}
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--workspace-border)] bg-[var(--workspace-surface)] text-[var(--workspace-ink)] dashboard-dialog-elevation"
          >
            <div className="min-h-0 overflow-y-auto overscroll-contain p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--workspace-ink)]">Confirm controlled disclosure</p>
              <h3 id={approvalTitleId} className="mt-2 text-2xl font-semibold">Share details with {approvalCandidate.viewer_name || "this person"}?</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                Recipient: {approvalCandidate.viewer_email || "verified viewer"}. Details are shared for 15 days.
              </p>
              <div className="mt-6 rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-surface)] p-4">
                <p className="text-sm font-semibold">You will share:</p>
                {disclosedCategories.length > 0 ? (
                  <ul className="mt-4 list-disc space-y-2 pl-6 text-sm leading-5 text-[var(--workspace-ink)]">
                    {disclosedCategories.map((category) => <li key={category}>{category}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[var(--workspace-muted)]">No additional private information has been added yet.</p>
                )}
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--workspace-muted)]">
                You can end this person&apos;s access at any time. Ending access prevents future openings but cannot recall information they already viewed or saved.
              </p>
              {actionError && <p className="dashboard-action-error mt-4" role="alert">{actionError}</p>}
              {workingId && <LoadingStatus compact className="mt-4" title="Sharing private details" />}
            </div>
            <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--workspace-border)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:flex-row sm:justify-end sm:p-6">
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
                {workingId === approvalCandidate.id ? "Sharing details…" : "Share details for 15 days"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function CompactRelationshipStage({
  stage,
  title,
  description,
  count,
  expanded,
  onToggle,
  onViewAll,
  empty,
  children,
}: {
  stage: string;
  title: string;
  description: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onViewAll: () => void;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dashboard-relationship-stage dashboard-compact-stage" data-stage={stage}>
      <button type="button" className="dashboard-stage-toggle" aria-expanded={expanded} onClick={onToggle}>
        <div>
          <span className="dashboard-stage-title">{title}</span>
          <span className="dashboard-stage-description">{description}</span>
        </div>
        <span className="dashboard-stage-count">{count}</span>
        <ChevronDown className="dashboard-stage-chevron" aria-hidden="true" />
      </button>
      {expanded && (
        <div className="dashboard-stage-content">
          {count === 0 ? <p className="dashboard-empty-state">{empty}</p> : <div className="dashboard-summary-list">{children}</div>}
          {count > 0 && <button type="button" className="dashboard-view-all" onClick={onViewAll}>View all <span>({count})</span></button>}
        </div>
      )}
    </section>
  );
}

function InterestSummaryCard({ interest, statusLabel, primaryLabel, onPrimary, disabled = false }: { interest: DashboardInterest; statusLabel: string; primaryLabel: string; onPrimary: () => void; disabled?: boolean }) {
  const source = interest.source_type === "broker" ? "Broker introduction" : "Direct introduction";
  return (
    <article className="dashboard-summary-item" data-record-state={interest.status}>
      <div className="dashboard-summary-main">
        <div className="dashboard-summary-heading"><strong>{interest.viewer_name || "Unnamed viewer"}</strong><span className={`dashboard-source-tag is-${interest.source_type}`}>{source}</span></div>
        <p>{formatInterestDate(interest.created_at)} · {interest.email_verified ? "Verified email" : "Verification pending"}</p>
        <p className="dashboard-message-preview">{interest.message || interest.viewer_family_context || "No message provided."}</p>
      </div>
      <div className="dashboard-summary-actions"><span className="dashboard-interest-status">{statusLabel}</span><button type="button" className="dashboard-primary-action" disabled={disabled} onClick={onPrimary}>{primaryLabel}</button></div>
    </article>
  );
}

function GrantSummaryCard({ grant, renderedAt, viewerAccessAvailable, onPrimary }: { grant: AccessGrant; renderedAt: number; viewerAccessAvailable: boolean; onPrimary: () => void }) {
  const urgent = grant.status === "active" && daysUntil(grant.expiresAt, renderedAt) <= 3;
  const sourceType = grant.sourceType || "direct";
  return (
    <article className="dashboard-summary-item" data-record-state={urgent ? "expiring" : grant.status}>
      <div className="dashboard-summary-main">
        <div className="dashboard-summary-heading"><strong>{grant.viewerName || "Verified viewer"}</strong><span className={`dashboard-source-tag is-${sourceType}`}>{sourceType === "broker" ? "Broker introduction" : "Direct introduction"}</span></div>
        <p>{grant.viewerEmail || "Verified viewer"}</p>
        <p className="dashboard-message-preview">{grant.status === "active" ? viewerAccessAvailable ? `${urgent ? "Expires soon" : "Active"} until ${formatAccessDate(grant.expiresAt)}` : `Viewing paused · Sharing ends ${formatAccessDate(grant.expiresAt)}` : grant.status === "expired" ? `Expired ${formatAccessDate(grant.expiresAt)}` : "Sharing ended"}</p>
      </div>
      <div className="dashboard-summary-actions"><span className="dashboard-interest-status">{grant.status === "active" && !viewerAccessAvailable ? "Viewing unavailable" : urgent ? "Expiring soon" : grant.status === "active" ? "Active" : grant.status === "expired" ? "Expired" : "Ended"}</span><button type="button" className="dashboard-primary-action" onClick={onPrimary}>Manage</button></div>
    </article>
  );
}

function BrokerResponseSummaryCard({ response, onPrimary }: { response: OwnerBrokerIntroductionResponse; onPrimary: () => void }) {
  return (
    <article className="dashboard-summary-item" data-record-state={response.response === "accepted" ? "active" : "revoked"}>
      <div className="dashboard-summary-main">
        <div className="dashboard-summary-heading"><strong>{response.recipientLabel}</strong><span className="dashboard-source-tag is-broker">Broker introduction</span></div>
        <p>{response.brokerName} · {formatInterestDate(response.respondedAt)}</p>
        <p className="dashboard-message-preview">{response.comment || `Recipient ${response.response} the introduction.`}</p>
      </div>
      <div className="dashboard-summary-actions"><span className="dashboard-interest-status">{response.response === "accepted" ? "Accepted" : "Declined"}</span><button type="button" className="dashboard-primary-action" onClick={onPrimary}>Open details</button></div>
    </article>
  );
}

function DashboardModal({ titleId, title, closeLabel, closeRef, onClose, detail = false, inactive = false, children }: { titleId: string; title: string; closeLabel: string; closeRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void; detail?: boolean; inactive?: boolean; children: React.ReactNode }) {
  return (
    <div className="dashboard-modal-backdrop" role="presentation" inert={inactive} aria-hidden={inactive || undefined}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className={`dashboard-records-modal${detail ? " is-detail" : ""}`}>
        <header><div><p className="portfolio-eyebrow">Introductions and access</p><h2 id={titleId}>{title}</h2></div><button ref={closeRef} type="button" className="dashboard-modal-close" aria-label={closeLabel} onClick={onClose}><X aria-hidden="true" /></button></header>
        <div className="dashboard-modal-body">{children}</div>
      </section>
    </div>
  );
}

function InterestDetail({ interest }: { interest: DashboardInterest }) {
  const profileFor = typeof interest.metadata?.profile_for === "string" ? interest.metadata.profile_for : "self";
  const sourceLabel = interest.source_type === "broker" ? `Broker introduction via ${interest.broker_name || "broker network"}` : "Direct introduction";
  return (
    <div className="dashboard-record-detail">
      <div className="dashboard-detail-status-row"><span className={`dashboard-source-tag is-${interest.source_type}`}>{sourceLabel}</span><span className="dashboard-interest-status">{interestStatusLabel(interest.status)}</span></div>
      <dl className="dashboard-detail-grid">
        <div><dt>Email</dt><dd>{interest.viewer_email || "Not provided"}{interest.email_verified && <span className="dashboard-verified-label"><ShieldCheck aria-hidden="true" /> Verified</span>}</dd></div>
        <div><dt>Phone</dt><dd>{interest.viewer_phone || "Not provided"}</dd></div>
        <div><dt>Contacting for</dt><dd>{formatProfileFor(profileFor)}</dd></div>
        <div><dt>Received</dt><dd>{formatAccessDate(interest.created_at)}</dd></div>
        {interest.broker_representative_name && <div><dt>Broker representative</dt><dd>{interest.broker_representative_name}</dd></div>}
        {formatInterestLocation(interest.metadata) && <div><dt>Location</dt><dd>{formatInterestLocation(interest.metadata)}</dd></div>}
      </dl>
      <section><h3>Family context</h3><p>{interest.viewer_family_context || "No family context was provided."}</p></section>
      <section><h3>Message</h3><p>{interest.message || "No message was provided."}</p></section>
    </div>
  );
}

function InterestActions({ interest, working, onSetAside, onReopen, onGrant }: { interest: DashboardInterest; working: boolean; onSetAside: () => void; onReopen: () => void; onGrant: () => void }) {
  const requesterPortfolioPath = interest.requester_portfolio_token ? `/p/${encodeURIComponent(interest.requester_portfolio_token)}` : null;
  return (
    <>
      {interest.viewer_phone && <a href={`tel:${interest.viewer_phone}`} className="dashboard-secondary-action">Call</a>}
      {interest.viewer_email && <a href={`mailto:${interest.viewer_email}`} className="dashboard-secondary-action">Email</a>}
      {requesterPortfolioPath && <Link href={requesterPortfolioPath} target="_blank" rel="noreferrer" className="dashboard-secondary-action">View their VivIntro introduction</Link>}
      {interest.status === "rejected" ? <button type="button" className="dashboard-primary-action" disabled={working} onClick={onReopen}>Revisit interest</button> : ["new", "pending_review"].includes(interest.status) ? <><button type="button" className="dashboard-secondary-action" disabled={working} onClick={onSetAside}>Set aside</button>{interest.email_verified && interest.requester_user_id ? <button type="button" className="dashboard-primary-action" disabled={working} onClick={onGrant}>Share details</button> : <span className="dashboard-action-note">A verified VivIntro account is required before private details can be shared.</span>}</> : null}
    </>
  );
}

function GrantDetail({ grant, viewerAccessAvailable }: { grant: AccessGrant; viewerAccessAvailable: boolean }) {
  return (
    <div className="dashboard-record-detail">
      <div className="dashboard-detail-status-row"><span className={`dashboard-source-tag is-${grant.sourceType || "direct"}`}>{grant.sourceType === "broker" ? `Broker introduction via ${grant.brokerName || "broker network"}` : "Direct introduction"}</span><span className="dashboard-interest-status">{grant.status === "revoked" ? "Ended" : grant.status}</span></div>
      {grant.status === "active" && !viewerAccessAvailable && <p>Your sharing choice remains on record, but this person cannot open private details while your introduction is unavailable.</p>}
      <dl className="dashboard-detail-grid">
        <div><dt>Email</dt><dd>{grant.viewerEmail || "Verified viewer"}</dd></div>
        <div><dt>Sharing ends</dt><dd>{formatAccessDate(grant.expiresAt)}</dd></div>
        <div><dt>Last opened</dt><dd>{grant.lastAccessedAt ? formatAccessDate(grant.lastAccessedAt) : "Not opened yet"}</dd></div>
        <div><dt>Last renewed</dt><dd>{grant.renewedAt ? formatAccessDate(grant.renewedAt) : "Not renewed"}</dd></div>
      </dl>
      <p>Open interest details below for this viewer’s submitted information and sharing history.</p>
    </div>
  );
}

function BrokerResponseDetail({ response }: { response: OwnerBrokerIntroductionResponse }) {
  return (
    <div className="dashboard-record-detail">
      <div className="dashboard-detail-status-row"><span className="dashboard-source-tag is-broker">Broker introduction via {response.brokerName}</span><span className="dashboard-interest-status">{response.response === "accepted" ? "Accepted" : "Declined"}</span></div>
      <dl className="dashboard-detail-grid">
        <div><dt>Recipient</dt><dd>{response.recipientLabel}</dd></div>
        <div><dt>Broker</dt><dd>{response.brokerName}</dd></div>
        <div><dt>Responded</dt><dd>{formatAccessDate(response.respondedAt)}</dd></div>
        <div><dt>Response</dt><dd className="capitalize">{response.response}</dd></div>
      </dl>
      <section><h3>Response message</h3><p>{response.comment || "No response message was provided."}</p></section>
    </div>
  );
}

function sortByNewest<T>(items: T[], dateFor: (item: T) => string | null | undefined) {
  return [...items].sort((left, right) => new Date(dateFor(right) || 0).getTime() - new Date(dateFor(left) || 0).getTime());
}

function daysUntil(value: string, referenceTime: number) {
  const difference = new Date(value).getTime() - referenceTime;
  return Number.isFinite(difference) ? Math.ceil(difference / 86_400_000) : Number.POSITIVE_INFINITY;
}

function formatAccessDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function accessEventLabel(type: AccessAuditEvent["eventType"], viewerName?: string | null) {
  const viewer = viewerName || "A viewer";
  const labels: Record<AccessAuditEvent["eventType"], string> = {
    request_submitted: `${viewer} showed interest`,
    request_reopened: `${viewer}'s interest was revisited`,
    request_rejected: `${viewer}'s interest was set aside`,
    grant_created: `Private details shared with ${viewer}`,
    grant_renewed: `Private details access renewed for ${viewer}`,
    grant_accessed: `${viewer} opened the private details`,
    grant_revoked: `Sharing ended for ${viewer}`,
    grant_expired: `Private details access expired for ${viewer}`,
    portfolio_rotated: "Introduction link rotated",
    portfolio_unpublished: "Introduction unpublished",
  };
  return labels[type];
}

function formatInterestDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", { timeZone: "UTC", month: "short", day: "numeric" }).format(date);
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
  if (!focusable.includes(document.activeElement as HTMLElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
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
    categories.push("Private contact details");
  }
  if (media.length > 0) {
    const protectedPhotoCount = media.filter((item) => item.visibility !== "public").length;
    const protectedCopy = protectedPhotoCount > 0
      ? `, including ${protectedPhotoCount} private ${protectedPhotoCount === 1 ? "photo" : "photos"}`
      : "";
    categories.push(`${media.length} introduction ${media.length === 1 ? "photo" : "photos"}${protectedCopy}`);
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
  personal: { name: "", first_name: "", middle_name: "", last_name: "", dob: "", gender: undefined, profile_for: "self" },
  vitals: {},
  astrology: {},
  education: {},
  career: {},
  family: {},
  lifestyle: {},
  contact: {},
  style: {
    appearance: "light",
    template_name: "Nakshatra Introduction",
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
  const photoError = usePortfolioFieldError("media.primary_photo");
  const photoErrorId = photoError ? `${portfolioFieldAnchor("media.primary_photo")}-error` : undefined;
  const visibilityLabels: { value: PortfolioMediaVisibility; label: string }[] = [
    { value: "interest_required", label: "Blurred until shared" },
    { value: "public", label: "Visible to all" },
  ];

  return (
    <section className="mb-8 border-b border-[var(--workspace-border)] pb-8">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--workspace-ink)]">
            <Images className="h-4 w-4 text-[var(--workspace-teal)]" />
            Profile photos
          </h3>
          <p className="mt-2 text-xs leading-5 text-[var(--workspace-ink-muted)]">
            Add up to eight photos. Your originals remain in the private photos bucket.
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium text-[var(--workspace-teal)]">{media.length}/{MAX_PORTFOLIO_PHOTOS}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => onUpload(event.target.files)}
      />

      <div className="flex flex-wrap gap-4">
        {media.map((item) => (
          <article
            key={item.id}
            aria-label={item.media_type === "hero" ? "Primary photo" : "Profile photo"}
            className="w-36 shrink-0 overflow-hidden rounded-lg border border-[var(--workspace-border)] bg-[var(--workspace-surface-muted)] sm:w-40"
          >
            <div className="relative h-36 bg-[var(--workspace-surface-muted)] sm:h-40">
              {urls[item.id] ? (
                // Signed URLs are created client-side for the portfolio owner only.
                <PortfolioImage key={urls[item.id]} src={urls[item.id]} alt={item.alt_text || "Profile photo"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[var(--workspace-ink-muted)]">Preview unavailable</div>
              )}
              {item.media_type === "hero" && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-2 rounded-md bg-[var(--workspace-teal-soft)] px-2 py-2 text-xs font-semibold text-[var(--workspace-ink)]">
                  <Crown className="h-3 w-3" /> Hero
                </span>
              )}
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--workspace-border)] bg-[var(--workspace-surface)] text-[var(--ui-danger)] transition-[transform,box-shadow,filter] hover:bg-[var(--ui-danger-surface)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                className="h-10 w-full rounded-md border border-[var(--workspace-border)] bg-[var(--workspace-surface)] px-2 text-xs text-[var(--workspace-ink)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Photo visibility"
                data-portfolio-error-focus="visibility"
                aria-describedby={photoErrorId}
              >
                {!visibilityLabels.some((option) => option.value === item.visibility) && (
                  <option value="" disabled>Choose visibility</option>
                )}
                {visibilityLabels.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[var(--workspace-surface)]">
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
                  data-portfolio-error-focus="primary"
                  aria-describedby={photoErrorId}
                  className="min-h-10 w-full rounded-md border border-[var(--workspace-border)] px-2 py-2 text-xs font-medium text-[var(--workspace-ink-muted)] transition-[transform,box-shadow,filter] hover:bg-[var(--workspace-surface-muted)]"
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
            aria-describedby={photoErrorId}
            disabled={uploading}
            className="flex h-36 w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--workspace-border)] bg-[var(--workspace-teal-soft)] px-4 text-center text-xs font-medium text-[var(--workspace-teal)] transition-[transform,box-shadow,filter] hover:bg-[var(--workspace-teal-soft)] disabled:opacity-50 sm:h-40 sm:w-40"
          >
            {uploading ? <Upload className="h-5 w-5 animate-pulse" /> : <ImagePlus className="h-5 w-5" />}
            {uploading ? "Uploading" : "Add photos"}
          </button>
        )}
      </div>
    </section>
  );
}
