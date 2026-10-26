"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Inbox, History, ChevronDown, ChevronLeft, ChevronRight, Search, X, ShieldCheck } from "lucide-react";
import { LoadingStatus } from "@/components/loading/LoadingStatus";
import { useModalFocus } from "@/components/useModalFocus";
import { InterestDetailsPanel } from "@/components/portfolio/InterestDetailsPanel";
import { InterestHistoryPanel } from "@/components/portfolio/InterestHistoryPanel";
import { useRelationshipQueue } from "@/features/access/client/useRelationshipQueue";
import type { AccessAuditEvent, AccessGrant, PortfolioAccessSummary } from "@/features/access/server/access.contract";
import type { DashboardInterest } from "@/features/interest/server/interest-dashboard.contract";
import type { OwnerBrokerIntroductionResponse, ReceivedBrokerIntroduction } from "@/features/broker-introductions/server/broker-introduction.contract";
import { interestStatusLabel } from "@/features/interest/presentation";

export type RelationshipStage = "awaiting" | "set-aside" | "access";

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

export function ReceivedBrokerIntroductions({ introductions }: { introductions: ReceivedBrokerIntroduction[] }) {
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

export function RelationshipLifecycle({
  renderedAt,
  expandedStages,
  onToggleStage,
  interests,
  grants,
  counts,
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
  counts?: PortfolioAccessSummary["counts"];
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
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approvalCandidate, setApprovalCandidate] = useState<DashboardInterest | null>(null);
  const [listModal, setListModal] = useState<ListModal>(null);
  const [recordDetail, setRecordDetail] = useState<RecordDetail>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [recordFilter, setRecordFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [brokerPage, setBrokerPage] = useState(1);
  const [queueRevision, setQueueRevision] = useState(0);
  const queue = useRelationshipQueue(listModal, page, searchQuery, recordFilter, queueRevision);
  const isMobileDashboard = useMobileDashboard();
  const approvalTitleId = useId();
  const approvalDialogRef = useRef<HTMLElement>(null);
  const listTitleId = useId();
  const detailTitleId = useId();


  useModalFocus(Boolean(approvalCandidate), approvalDialogRef, () => {
    if (workingId === null) setApprovalCandidate(null);
  });

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
      setQueueRevision(value => value + 1);
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
      setQueueRevision(value => value + 1);
      setRecordDetail(null);
    } finally {
      setWorkingId(null);
    }
  }

  function openList(mode: Exclude<ListModal, null>) {
    setSearchQuery("");
    setRecordFilter("all");
    setPage(1);
    setBrokerPage(1);
    setListModal(mode);
  }

  const pageCount = Math.max(1, Math.ceil((queue.data?.total ?? 0) / 8));
  const currentPage = page;
  const visibleRecords = queue.data?.records ?? [];
  const matchingBrokerResponses = brokerResponses.filter(item =>
    (recordFilter === "all" || recordFilter === "broker")
    && item.recipientLabel.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const brokerPageCount = Math.max(1, Math.ceil(matchingBrokerResponses.length / 8));
  const currentBrokerPage = Math.min(brokerPage, brokerPageCount);
  const visibleBrokerResponses = listModal === "history" && currentPage === 1
    ? matchingBrokerResponses.slice((currentBrokerPage - 1) * 8, currentBrokerPage * 8) : [];
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
        <span>{counts?.awaiting ?? waitingInterests.length} waiting</span>
      </div>
      {workingId && !recordDetail && !approvalCandidate && <LoadingStatus compact className="my-4" title="Updating this interest" />}
      {actionError && <p className="dashboard-action-error" role="alert">{actionError}</p>}

      <CompactRelationshipStage
        stage="awaiting"
        title="Awaiting review"
        description="New interests ready for your decision. Check each person's verification status before sharing more."
        count={counts?.awaiting ?? waitingInterests.length}
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
        count={counts?.["set-aside"] ?? setAsideInterests.length}
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
        count={counts?.access ?? activeGrants.length}
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
        <DashboardModal busy={workingId !== null} titleId={listTitleId} title={listTitle} closeLabel="Close and return to dashboard" onClose={() => setListModal(null)}>
          <div className="dashboard-modal-tools">
            <label>
              <span className="sr-only">Search {listTitle.toLowerCase()}</span>
              <Search aria-hidden="true" />
              <input name="relationship-search" autoComplete="off" spellCheck={false} maxLength={100} value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1); setBrokerPage(1); }} placeholder="Search by name or email…" />
            </label>
            <label>
              <span className="sr-only">Filter records</span>
              <select name="relationship-filter" value={recordFilter} onChange={(event) => { setRecordFilter(event.target.value); setPage(1); setBrokerPage(1); }}>
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
            {queue.loading ? <LoadingStatus compact title="Loading relationships" /> : queue.error ? <p role="alert">{queue.error} <button type="button" onClick={queue.retry}>Retry queue</button></p> : visibleRecords.length === 0 ? (visibleBrokerResponses.length ? null : <p className="dashboard-empty-state">No records match this search and filter.</p>) : visibleRecords.map((record) => record.kind === "interest" ? (
              <InterestSummaryCard key={`interest-${record.item.id}`} interest={record.item} statusLabel={interestStatusLabel(record.item.status)} primaryLabel="Open details" onPrimary={() => setRecordDetail(record)} />
            ) : (
              <GrantSummaryCard key={`grant-${record.item.id}`} grant={record.item} renderedAt={renderedAt} viewerAccessAvailable={viewerAccessAvailable} onPrimary={() => setRecordDetail(record)} />
            ))}
          </div>
          {visibleBrokerResponses.length > 0 && <section aria-label="Broker introduction responses" className="dashboard-history-timeline">
            <h3>Broker introduction responses</h3>
            {visibleBrokerResponses.map(item => <BrokerResponseSummaryCard key={item.introductionRef} response={item} onPrimary={() => setRecordDetail({ kind: "broker-response", item })} />)}
            {brokerPageCount > 1 && <nav aria-label="Broker response pages" className="dashboard-modal-pagination">
              <button type="button" className="dashboard-secondary-action" disabled={currentBrokerPage === 1} onClick={() => setBrokerPage(value => value - 1)}>Previous broker responses</button>
              <span>Broker responses · Page {currentBrokerPage} of {brokerPageCount}</span>
              <button type="button" className="dashboard-secondary-action" disabled={currentBrokerPage === brokerPageCount} onClick={() => setBrokerPage(value => value + 1)}>Next broker responses</button>
            </nav>}
          </section>}
          {listModal === "history" && events.length > 0 && (
            <div className="dashboard-history-timeline">
              <h3>Activity log</h3>
              <ol>{events.slice(0, 20).map((event) => <li key={event.id}><span>{accessEventLabel(event.eventType, event.viewerName)}</span><time dateTime={event.createdAt}>{formatAccessDate(event.createdAt)}</time></li>)}</ol>
            </div>
          )}
          {(pageCount > 1 || currentPage > 1 || queue.loading) && (
            <nav className="dashboard-modal-pagination" aria-label={`${listTitle} pages`}>
              <button type="button" className="dashboard-secondary-action" disabled={currentPage === 1 || queue.loading} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft aria-hidden="true" /> Previous</button>
              <span>{queue.loading ? `Loading page ${currentPage}…` : currentPage > pageCount ? `Page ${currentPage} · No more records` : `Page ${currentPage} of ${pageCount}`}</span>
              <button type="button" className="dashboard-secondary-action" disabled={queue.loading || Boolean(queue.error) || currentPage >= pageCount || currentPage * 8 > 100000} onClick={() => setPage(value => value + 1)}>Next <ChevronRight aria-hidden="true" /></button>
            </nav>
          )}
        </DashboardModal>
      )}

      {recordDetail && (
        <DashboardModal busy={workingId !== null} titleId={detailTitleId} title={recordDetail.kind === "interest" ? recordDetail.item.viewer_name || "Introduction details" : recordDetail.kind === "grant" ? recordDetail.item.viewerName || "Sharing details" : recordDetail.item.recipientLabel} closeLabel="Close details" onClose={() => setRecordDetail(null)} detail inactive={Boolean(approvalCandidate)}>
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
            ref={approvalDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={approvalTitleId}
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--workspace-border)] bg-[var(--workspace-surface)] text-[var(--workspace-ink)] dashboard-dialog-elevation"
          >
            <div className="min-h-0 overflow-y-auto overscroll-contain p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--workspace-ink)]">Confirm controlled disclosure</p>
              <h3 tabIndex={-1} id={approvalTitleId} className="mt-2 text-2xl font-semibold">Share details with {approvalCandidate.viewer_name || "this person"}?</h3>
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

function DashboardModal({ titleId, title, closeLabel, onClose, detail = false, inactive = false, busy = false, children }: { titleId: string; title: string; closeLabel: string; onClose: () => void; detail?: boolean; inactive?: boolean; busy?: boolean; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLElement>(null);
  useModalFocus(true, dialogRef, () => { if (!busy) onClose(); });
  return (
    <div className="dashboard-modal-backdrop" role="presentation" inert={inactive} aria-hidden={inactive || undefined}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`dashboard-records-modal${detail ? " is-detail" : ""}`}>
        <header><div><p className="portfolio-eyebrow">Introductions and access</p><h2 id={titleId}>{title}</h2></div><button disabled={busy} type="button" className="dashboard-modal-close" aria-label={closeLabel} onClick={onClose}><X aria-hidden="true" /></button></header>
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
