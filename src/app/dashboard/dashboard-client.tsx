"use client";

import { RelationshipLifecycle, ReceivedBrokerIntroductions, type RelationshipStage } from "@/components/dashboard/RelationshipLifecycle";
import { PhotoManager, HoroscopeManager } from "@/components/dashboard/MediaManagers";
import { usePortfolioMediaState, usePortfolioMediaActions } from "@/features/media/client/usePortfolioMedia";
import { portfolioEditorPublishSchema } from "@/features/portfolio/form-contract";
import { CreatorOnboardingFeedback } from "@/components/feedback/CreatorOnboardingFeedback";
import { LoadingStatus } from "@/components/loading/LoadingStatus";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { useModalFocus } from "@/components/useModalFocus";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { authoringChoiceErrors } from "@/features/portfolio/authoring-choices";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  type Portfolio,
  type PortfolioData,
  type PortfolioHoroscope,
  type PortfolioMedia,
  normalizePortfolioPrivacyMode,
} from "@/types/portfolio";
import type { CandidateRecovery } from "@/features/identity-verification/candidate-recovery.types";
import type { PortfolioApiFailure } from "@/features/portfolio/client/portfolio-dashboard.api";
import type {
  PortfolioAccessSummary,
} from "@/features/access/server/access.contract";
import {
  isShareablePrimaryPhoto,
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
  ArrowRight,
  Clock,
  Edit3,
  Share2,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  LockKeyhole,
  PanelRightOpen,
  ExternalLink,
  ShieldCheck,
  Inbox,
  CheckCircle2,
  Circle,
  ArrowLeft,
} from "lucide-react";
import { normalizePortfolioName } from "@/features/portfolio/name";
import { portfolioEditorDraftSchema } from "@/features/portfolio/form-contract";
import { editorFieldIssues, editorFieldLabel, editorFieldTarget, portfolioFieldAnchor, type EditorFieldIssue } from "@/features/portfolio/editor-validation";
import { buildWhatsAppShareMessage } from "@/features/portfolio/whatsapp-share";
import type { PilotAccessState } from "@/features/pilot-access/server/pilot-access.contract";
import type { DashboardInterest } from "@/features/interest/server/interest-dashboard.contract";
import { type RelationshipPage } from "@/features/access/relationship-dashboard.contract";
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
  relationshipOverview?: RelationshipPage | null;
  relationshipsError?: boolean;
}

const EMPTY_ACCESS_SUMMARY: PortfolioAccessSummary = { grants: [], events: [] };

export default function DashboardClient({
  renderedAt = 0,
  portfolio,
  canCreatePortfolio,
  pilotAccessState = null,
  viewCount,
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
  relationshipOverview = null,
  relationshipsError = false,
}: Props) {
  const hydrated = useHydrated();
  const [copied, setCopied] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [formOpen, setFormOpen] = useState(initialEditorOpen && canCreatePortfolio);
  const [draftData, setDraftData] = useState<PortfolioData>(() =>
    normalizePortfolioData(portfolio?.draft_data, portfolio?.privacy_mode)
  );
  const [savedAuthoringBaseline, setSavedAuthoringBaseline] = useState<PortfolioData>(() => normalizePortfolioData(portfolio?.draft_data, portfolio?.privacy_mode));
  const savedDraftRef = useRef(savedAuthoringBaseline);
  const mediaState = usePortfolioMediaState({ initialMedia: media, initialMediaUrls, initialHoroscope: horoscope });
  const { portfolioMedia, mediaUrls, portfolioHoroscope, mediaMutations, removingHoroscope, uploadingMedia, uploadingHoroscope, photoInputRef, horoscopeInputRef } = mediaState;
  const [preparingPreview, setPreparingPreview] = useState(false);
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
  const [activePortfolioId, setActivePortfolioId] = useState(portfolio?.id ?? null);
  const [savedCandidateId, setSavedCandidateId] = useState<string | null>(null);
  const [interestItems, setInterestItems] = useState(interests);
  const [accessGrants, setAccessGrants] = useState(accessSummary.grants);
  const [relationshipCounts, setRelationshipCounts] = useState(relationshipOverview?.counts);
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
  const hasShareablePrimaryPhoto = portfolioMedia.some(isShareablePrimaryPhoto);
  const publishValidation = useMemo(() => portfolioEditorPublishSchema.safeParse(draftData), [draftData]);
  const completion = useMemo(() => calculatePortfolioCompletion(draftData, hasShareablePrimaryPhoto, publishValidation), [draftData, hasShareablePrimaryPhoto, publishValidation]);
  const [editorSection, setEditorSection] = useState<PortfolioEditorSection>(() => navigableSection(
    (publicationReadiness.lastEditorSection || completion.nextEditorSection) as PortfolioEditorSection
  ));
  const [validationRequested, setValidationRequested] = useState(false);
  const [pendingFieldFocus, setPendingFieldFocus] = useState<{ path: string } | null>(null);
  const focusedFieldRequestRef = useRef(pendingFieldFocus);
  const [serverFieldIssues, setServerFieldIssues] = useState<EditorFieldIssue[]>([]);
  const validationIssues = useMemo(() => validationRequested
    ? editorFieldIssues(draftData, hasShareablePrimaryPhoto, savedAuthoringBaseline, { completion, parsed: publishValidation }) : [],
    [validationRequested, draftData, hasShareablePrimaryPhoto, savedAuthoringBaseline, completion, publishValidation]);

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
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const reviewDialogRef = useRef<HTMLElement>(null);
  const editorDialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(canCreatePortfolio && formOpen && !reviewOpen, editorDialogRef, closePortfolioEditor);
  useModalFocus(canCreatePortfolio && reviewOpen, reviewDialogRef, () => {
    if (!publishing) setReviewOpen(false);
  });
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
  const sectionFocusRequestedRef = useRef(false);
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
  useEffect(() => {
    if (!sectionFocusRequestedRef.current || !formOpen) return;
    sectionFocusRequestedRef.current = false;
    editorDialogRef.current?.querySelector<HTMLElement>(".biodata-section-heading h3")?.focus({ preventScroll: true });
  }, [editorSection, formOpen]);

  const onVerificationStatusChange = useCallback((state: CandidateRecovery["state"]) => {
    // Transient status refreshes can race the external Didit navigation in Safari.
    // Reload server-owned publication readiness only when its proof state differs.
    if ((state === "verified") !== (readinessState.verificationStatus === "verified")) refreshDashboard();
  }, [readinessState.verificationStatus, refreshDashboard]);

  const editorSectionIndex = PORTFOLIO_EDITOR_SECTIONS.findIndex(section => section.id === editorSection);
  const previousEditorSection = PORTFOLIO_EDITOR_SECTIONS[editorSectionIndex - 1];
  const nextEditorSection = PORTFOLIO_EDITOR_SECTIONS[editorSectionIndex + 1];
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
  const pendingInterestCount = relationshipCounts?.awaiting ?? interestItems.filter(
    (item) => item.status === "new" || item.status === "pending_review"
  ).length;
  const activeAccessCount = relationshipCounts?.active ?? accessGrants.filter((grant) => grant.status === "active").length;
  const showRelationshipDashboard = Boolean(
    relationshipsError || portfolio?.published_at || interestItems.length || accessGrants.length || accessEvents.length || brokerIntroductionResponses.length
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
    if (draftSaveState !== "unsaved" || !canCreatePortfolio || savingDraft) return;
    // Intermediate dates/phones/names may be malformed while typing. Manual save
    // still returns actionable errors; autosave need not send a known rejection.
    if (!portfolioEditorDraftSchema.safeParse(draftData).success) return;
    if (Object.keys(authoringChoiceErrors(draftData, savedDraftRef.current)).length) return;
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
      setSavedAuthoringBaseline(savedDraftRef.current);
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

  async function saveAndReviewPortfolio() {
    const needsSave = draftSaveState !== "saved" || !activePortfolioId;
    // The editor's explicit Save action preserves incomplete private work too.
    // Its refresh remains deferred until the owner leaves both editor and review.
    if (needsSave && !await persistDashboardDraft()) return;
    if (!validateEditor()) return;
    if (draftData.privacy_mode === "private") {
      setDraftError("Update the saved sharing setup in Appearance & contact, then review the public introduction before publishing.");
      return;
    }
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
    sectionFocusRequestedRef.current = true;
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
    const issues = editorFieldIssues(draftData, portfolioMedia.some(isShareablePrimaryPhoto), savedDraftRef.current).filter(issue =>
      PORTFOLIO_EDITOR_SECTIONS.findIndex(item => item.id === issue.section) < beforeSection);
    setValidationRequested(true);
    if (!issues.length) return true;
    showFieldIssue(issues[0]);
    return false;
  }

  const { uploadPhotos, updatePhoto, deletePhoto, uploadHoroscopeFile, reviewHoroscope, removeHoroscope } = usePortfolioMediaActions({
    state: mediaState, activePortfolioId, setDraftError, handlePortfolioApiFailure,
    onPersistedChange: () => invalidatePreviewReview(true), onRefresh: refreshDashboard,
  });

  return (
    <div className="contents">
      <div className="contents" inert={formOpen || reviewOpen} aria-hidden={formOpen || reviewOpen}>

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
                  disabled={!hydrated}
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
                    <button type="button" onClick={() => setFormOpen(true)} disabled={!hydrated} className="dashboard-edit-action dashboard-secondary-action">
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
                    : <button type="button" onClick={shareWhatsApp} disabled={!hydrated} className="dashboard-primary-action"><Share2 className="h-4 w-4" aria-hidden="true" /> Share on WhatsApp</button>}
                </div>}
                {viewerAccessAvailable && <div className="dashboard-welcome-actions"><a href="#introduction-link" className="dashboard-primary-action"><Share2 className="h-4 w-4" aria-hidden="true" />Share introduction</a></div>}
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
          {showRelationshipDashboard && <RelationshipLifecycle
            renderedAt={renderedAt}
            expandedStages={expandedRelationshipStages}
            onToggleStage={(stage) => setExpandedRelationshipStages((current) => ({ ...current, [stage]: !current[stage] }))}
            interests={interestItems}
            grants={accessGrants}
            viewerAccessAvailable={viewerAccessAvailable}
            events={accessEvents}
            brokerResponses={brokerIntroductionResponses}
            overview={relationshipOverview && relationshipCounts ? { ...relationshipOverview, counts: relationshipCounts } : relationshipOverview}
            loadFailed={relationshipsError}
            onRetry={refreshDashboard}
            onDecision={(id, status, previous) => {
              setRelationshipCounts(current => current ? { ...current,
                awaiting: Math.max(0, current.awaiting + (status === "pending_review" ? 1 : 0) - (previous && ["new", "pending_review"].includes(previous) ? 1 : 0)),
                setAside: Math.max(0, current.setAside + (status === "rejected" ? 1 : 0) - (previous === "rejected" ? 1 : 0)),
                active: current.active + (status === "approved" ? 1 : 0),
              } : current);
              setInterestItems((current) =>
                current.map((interest) =>
                  interest.id === id ? { ...interest, status } : interest
                )
              );
              refreshDashboard();
            }}
            onGrantChange={(grantId, action, expiresAt, previous) => {
              const wasActive = previous === "active";
              setRelationshipCounts(current => current ? { ...current, active: Math.max(0, current.active + (action === "revoke" ? -1 : wasActive ? 0 : 1)) } : current);
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
          {portfolio && <section className="dashboard-overview" aria-label="Introduction overview">
            {viewerAccessAvailable ? (
              <section id="introduction-link" className="dashboard-glass dashboard-sharing-card scroll-mt-24" aria-label="Introduction link">
                <h3 className="text-base font-semibold">Introduction link</h3>
                <p className="dashboard-sharing-description">Anyone with this name-based link can see your public introduction. Private details need your approval.</p>
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
                  {canCreatePortfolio && <button type="button" onClick={() => setFormOpen(true)} disabled={!hydrated} className="dashboard-secondary-action"><Edit3 className="h-4 w-4" aria-hidden="true" />Edit details</button>}
                  <button type="button" onClick={shareWhatsApp} disabled={!hydrated} className="dashboard-primary-action"><Share2 className="h-4 w-4" aria-hidden="true" />Share on WhatsApp</button>
                </div>
                <details className="dashboard-link-settings" aria-label="Manage link">
                  <summary className="dashboard-manage-link-summary">Manage link</summary>
                  <p>Rotating creates a new name-based URL and permanently retires the old link. Duplicate names receive a number. Unpublishing turns off viewer access.</p>
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
                </details>
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
                {publishedProfileNeedsUpdate && canCreatePortfolio && <button type="button" disabled={!hydrated} className="dashboard-primary-action mt-4" onClick={() => {
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
                <div className="dashboard-stat-label"><Inbox aria-hidden="true" /><span>Interests received</span></div>
                <p className="dashboard-stat-value">{relationshipsError ? "—" : relationshipCounts?.interests ?? interestItems.length}</p>
                <span className="dashboard-stat-caption">{relationshipsError ? "Unavailable · retry sharing status" : "All submitted interests"}</span>
              </div>
              <div className="dashboard-glass dashboard-stat-card" data-stat-state={pendingInterestCount > 0 ? "action" : "neutral"}>
                <div className="dashboard-stat-label"><Clock aria-hidden="true" /><span>Needs review</span></div>
                <p className="dashboard-stat-value">{relationshipsError ? "—" : pendingInterestCount}</p>
                {relationshipsError ? <span className="dashboard-stat-caption">Unavailable</span> : pendingInterestCount > 0
                  ? <a className="dashboard-stat-detail" href="#introductions-and-access" onClick={() => setExpandedRelationshipStages((current) => ({ ...current, awaiting: true }))}>Review interests</a>
                  : <span className="dashboard-stat-caption">All caught up</span>}
              </div>
              <div className="dashboard-glass dashboard-stat-card" data-stat-state="neutral">
                <div className="dashboard-stat-label"><ShieldCheck aria-hidden="true" /><span>Currently sharing with</span></div>
                <p className="dashboard-stat-value">{relationshipsError ? "—" : activeAccessCount}</p>
                {relationshipsError ? <span className="dashboard-stat-caption">Unavailable</span> : activeAccessCount > 0
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
          </>}
          </div>
          {portfolio && completion.readyToPublish && draftSaveState === "saved" && <CreatorOnboardingFeedback />}
        </div>
      </main>
      </div>

      {canCreatePortfolio && reviewOpen && (
        <div className="dashboard-review-overlay fixed inset-0 z-[60] bg-[color:var(--ui-scrim)]/70 p-4 backdrop-blur-sm sm:p-6">
          <section
            ref={reviewDialogRef}
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
                <LoadingStatus
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
          <div ref={editorDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="portfolio-editor-heading" className="dashboard-editor-surface absolute inset-0 flex h-full w-full flex-col overflow-hidden dashboard-dialog-elevation">
            <fieldset disabled={!hydrated} className="contents">
            <div className="dashboard-editor-header flex-none border-b border-[var(--workspace-border)] px-4 py-4 sm:px-6 lg:px-8">
              <div className="dashboard-editor-header-layout mx-auto flex w-full max-w-[90rem] items-center justify-between gap-4">
                <div className="dashboard-editor-heading">
                    <h2 id="portfolio-editor-heading" tabIndex={-1} className="text-lg font-semibold">Introduction details</h2>
                    <span className={`dashboard-save-state is-${draftSaveState}`} aria-live="polite">
                      {draftSaveState === "saving"
                        ? "Saving..."
                        : draftSaveState === "saved"
                          ? "Draft saved"
                          : "Changes not saved"}
                    </span>
                </div>
                <div className="dashboard-editor-header-actions"><button type="button" aria-label="Preview" title="Preview introduction" onClick={openEarlyPreview} disabled={savingDraft || preparingPreview || !completion.basicsComplete} className="dashboard-secondary-action dashboard-editor-icon-action"><Eye className="h-4 w-4" aria-hidden="true" /></button><ThemeSwitch /><button
                  type="button"
                  aria-label="Back to dashboard"
                  title="Back to dashboard"
                  onClick={closePortfolioEditor}
                  className="dashboard-secondary-action dashboard-editor-icon-action"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span className="dashboard-editor-dashboard-label">Dashboard</span>
                </button></div>
              </div>
            </div>

            <div className="dashboard-editor-mobile-step flex-none px-4 py-2 lg:hidden">
              <PortfolioMobileSectionNav activeSection={editorSection} completedCount={completion.completedCount} totalCount={completion.totalCount} onSectionChange={rememberEditorSection} />
            </div>
            <div className="dashboard-editor-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 [scrollbar-gutter:stable] sm:px-6 lg:px-8">
              <div className="mx-auto w-full max-w-[90rem]">
                <BlueprintForm
                  completion={completion}
                  data={draftData}
                  onUpdate={updateSection}
                  activeSection={editorSection}
                  onSectionChange={rememberEditorSection}
                  showSectionNavigation={false}
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
                <p className="mt-4 text-xs leading-5 text-[var(--workspace-muted)]">Drafts stay private. Only publishing updates what people see.</p>
                <p className="dashboard-editor-mobile-legal mt-6 text-xs leading-5 text-[var(--workspace-muted)]">Share accurate details you have permission to use. <a href="/terms" target="_blank" rel="noreferrer" className="underline underline-offset-2">Terms &amp; Conditions</a> · <a href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2">Privacy and corrections</a></p>
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
                    Changes save privately. Review before publishing.
                  </p>
                  <p className="text-xs leading-5 text-[var(--workspace-muted)]">Share accurate details you have permission to use. <a href="/terms" target="_blank" rel="noreferrer" className="underline underline-offset-2">Terms &amp; Conditions</a> · <a href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2">Privacy and corrections</a></p>
                  </div><div className="dashboard-editor-actions">
                    <button type="button" aria-label="Back" title="Previous section" disabled={!previousEditorSection || savingDraft || openingReview} onClick={() => previousEditorSection && rememberEditorSection(previousEditorSection.id)} className="dashboard-secondary-action dashboard-editor-step-action">
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={saveAndReviewPortfolio}
                      disabled={publishing || savingDraft || openingReview}
                      aria-label="Save & review"
                      className={`dashboard-editor-review-action ${nextEditorSection ? "dashboard-secondary-action" : "dashboard-primary-action"}`}
                    >
                      <Save className="h-4 w-4" aria-hidden="true" />
                      <span>{savingDraft ? "Saving…" : openingReview ? "Opening review…" : "Save & review"}</span>
                    </button>
                    {nextEditorSection && <button type="button" aria-label={`Continue: ${nextEditorSection.label}`} title={`Continue: ${nextEditorSection.label}`} onClick={() => rememberEditorSection(nextEditorSection.id)} disabled={savingDraft || openingReview} className="dashboard-primary-action dashboard-editor-step-action">
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>}
                  </div>
                </div>
              </div>
            </div>
            </fieldset>
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
  const hydrated = useHydrated();
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
          {nextAction && <button type="button" onClick={nextAction.onClick} disabled={!hydrated || openingReview} className="dashboard-primary-action">{openingReview ? "Loading saved review…" : nextAction.label}</button>}
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
