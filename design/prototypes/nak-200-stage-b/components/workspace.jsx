"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  HeartHandshake,
  Sun,
  UsersRound,
  BookUser,
  Settings2,
  ShieldCheck,
  ChevronRight,
  SlidersHorizontal,
  Check,
  Copy,
  Send,
  LockKeyhole,
  Mail,
  ArrowRight,
  Clock3,
} from "lucide-react";
import {
  customers,
  sampleIntroductions,
  customerByRef,
  canCreate,
  isAssigned,
  pairAssessment,
} from "../lib/sample-data";
import { Badge, Button, Icon, Modal, Toast, control, Portrait } from "./ui";
import { screenLink } from "../lib/navigation";
import {
  Customers,
  Today,
  CustomerDetail,
  Introductions,
  IntroductionDetail,
  Team,
  Settings,
} from "./workspace-screens";
import { MatchWorkspace, PairReview } from "./matching";

const navigation = [
  { key: "today", label: "Today", icon: Sun },
  { key: "customers", label: "Customers", icon: BookUser },
  { key: "introductions", label: "Introductions", icon: HeartHandshake },
  { key: "team", label: "Team", icon: UsersRound },
  { key: "settings", label: "Settings", icon: Settings2 },
];
const allScreens = [
  "today",
  "customers",
  "customer",
  "matches",
  "review",
  "introductions",
  "introduction",
  "team",
  "settings",
];

export default function Workspace() {
  const params = useSearchParams();
  const router = useRouter();
  const screen = allScreens.includes(params.get("screen"))
    ? params.get("screen")
    : "customers";
  const [role, setRole] = useState("Admin");
  const [sampleState, setSampleState] = useState("normal");
  const [introductions, setIntroductions] = useState(sampleIntroductions);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [invited, setInvited] = useState(false);
  const [shareError, setShareError] = useState(false);
  const [consent, setConsent] = useState(false);
  const [pairReviewed, setPairReviewed] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [familyProposals, setFamilyProposals] = useState({});
  const [customerQuery, setCustomerQuery] = useState("");
  const [matchQuery, setMatchQuery] = useState("");
  const query = screen === "matches" ? matchQuery : customerQuery;
  const setQuery = screen === "matches" ? setMatchQuery : setCustomerQuery;
  const previousScreen = useRef(screen);
  const openerRef = useRef(null);
  const visibleCustomers = customers.filter((customer) =>
    isAssigned(customer, role),
  );
  const a = customerByRef(params.get("customer"));
  const b = customerByRef(params.get("candidate") || customers[1].ref);
  const intro =
    introductions.find((item) => item.ref === params.get("intro")) ||
    introductions[0];
  const visibleIntroductions = introductions.filter(
    (item) =>
      isAssigned(customerByRef(item.a), role) &&
      isAssigned(customerByRef(item.b), role),
  );
  const activeNav = ["customer", "matches", "review"].includes(screen)
    ? "customers"
    : screen === "introduction"
      ? "introductions"
      : screen;
  const dismissToast = useCallback(() => setToast(""), []);

  useEffect(() => {
    if (previousScreen.current !== screen) {
      document.getElementById("page-title")?.focus({ preventScroll: true });
      previousScreen.current = screen;
    }
  }, [screen]);

  function changeParam(key, value) {
    const next = new URLSearchParams(params.toString());
    if (value === "all" || value === "any" || !value) next.delete(key);
    else next.set(key, value);
    // Search terms stay local: a person's name is never inserted into a URL.
    window.history.replaceState(null, "", `/?${next}`);
  }

  function openModal(value, event) {
    openerRef.current = event?.currentTarget || document.activeElement;
    setConsent(false);
    setPairReviewed(false);
    setShareError(false);
    setInviteError("");
    setModal({ ...value, animate: Boolean(event?.detail) });
  }
  function updateIntro(change) {
    setIntroductions((items) =>
      items.map((item) =>
        item.ref === intro.ref ? { ...item, ...change } : item,
      ),
    );
  }

  function createIntroduction() {
    if (
      !pairReviewed ||
      !canCreate(role) ||
      !isAssigned(a, role) ||
      !isAssigned(b, role) ||
      a.ref === b.ref ||
      pairAssessment(a, b, introductions).state !== "ready"
    )
      return;
    const item = {
      ref: `bir_${crypto.randomUUID().replaceAll("-", "")}`,
      a: a.ref,
      b: b.ref,
      state: "created",
      responseOrder: [],
      responses: { a: "waiting", b: "waiting" },
      shareStates: {
        a: { state: "not-shared", at: null },
        b: { state: "not-shared", at: null },
      },
      familyUpdates: { a: null, b: null },
      frozenFamilyViewers: null,
      versions: { a: a.version, b: b.version },
      reviewed: true,
      responseOpen: true,
      deadline: "28 Oct 2026",
      completeUntil: null,
      created: "13 Oct",
      creator: "Maya",
    };
    setIntroductions((items) => [item, ...items]);
    setModal(null);
    setToast("Introduction created. Share with each family separately.");
    router.push(screenLink("introduction", { intro: item.ref }));
  }

  function recordShare(side, state) {
    if (!canCreate(role) || !["a", "b"].includes(side)) return;
    updateIntro({
      state: intro.state === "created" ? "shared" : intro.state,
      shareStates: {
        ...intro.shareStates,
        [side]: {
          state,
          at: state === "confirmed" ? "Just now · broker confirmed" : "Just now",
        },
      },
    });
    setModal(null);
    setToast(
      state === "confirmed"
        ? "Shared state confirmed for this side only."
        : "WhatsApp share initiated. Delivery is not claimed.",
    );
  }

  async function copyExample(side) {
    if (!canCreate(role) || !["a", "b"].includes(side)) return;
    try {
      await navigator.clipboard.writeText(
        `https://vivintro.example.invalid/introductions/${intro.ref}`,
      );
      setShareError(false);
      setToast(
        `Example link copied for ${customerByRef(intro[side]).name}. No message has been sent.`,
      );
    } catch {
      setShareError(true);
    }
  }

  function respond(side, response) {
    if (
      !["shared", "declined"].includes(intro.state) ||
      intro.responseOpen === false ||
      intro.responses[side] !== "waiting" ||
      (response === "interested" && !consent)
    )
      return;
    const responses = { ...intro.responses, [side]: response };
    const mutual = responses.a === "interested" && responses.b === "interested";
    const declined = responses.a === "declined" || responses.b === "declined";
    updateIntro({
      responses,
      responseOrder: [...(intro.responseOrder || ["a", "b"].filter((participant) => intro.responses[participant] !== "waiting")), side],
      reviewed: false,
      state: declined ? "declined" : mutual ? "mutual" : "shared",
      completeUntil: mutual ? "12 Nov 2026" : null,
      frozenFamilyViewers: mutual
        ? {
            a: customerByRef(intro.a).familyViewers.filter(
              (viewer) => viewer.status === "active",
            ).length,
            b: customerByRef(intro.b).familyViewers.filter(
              (viewer) => viewer.status === "active",
            ).length,
          }
        : intro.frozenFamilyViewers,
    });
    setModal(null);
    setToast(
      mutual
        ? "Both customers are interested. Their 30-day Complete access has begun."
        : "Customer response recorded in the preview.",
    );
  }

  const sharedProps = {
    role,
    sampleState,
    setSampleState,
    query,
    setQuery,
    changeParam,
    params,
    visibleCustomers,
    introductions: visibleIntroductions,
    openModal,
    familyProposals,
  };
  const sourceUnavailable =
    params.get("customer") &&
    !customers.some((customer) => customer.ref === params.get("customer"));
  const candidateUnavailable =
    params.get("candidate") &&
    !customers.some((customer) => customer.ref === params.get("candidate"));
  const introUnavailable =
    params.get("intro") &&
    !introductions.some((item) => item.ref === params.get("intro"));
  const unauthorized =
    (screen === "matches" && a.readiness !== "ready") ||
    (["customer", "matches", "review"].includes(screen) &&
      (sourceUnavailable || !isAssigned(a, role))) ||
    (screen === "review" &&
      (candidateUnavailable || !isAssigned(b, role) || a.ref === b.ref)) ||
    (screen === "introduction" &&
      (introUnavailable ||
        !visibleIntroductions.some((item) => item.ref === intro.ref)));
  return (
    <div className="min-h-dvh bg-app text-navy">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-70 -translate-y-32 rounded-lg bg-navy p-4 text-app focus:translate-y-0"
      >
        Skip to workspace
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col bg-navy text-app lg:flex">
        <Link
          href={screenLink("today")}
          className="flex min-h-24 items-center gap-2 px-6 font-display text-lg font-semibold focus-visible:outline-app"
        >
          <Icon as={HeartHandshake} className="text-sage" />
          <span translate="no">
            VivIntro<span className="font-normal text-app/80">Desk</span>
          </span>
        </Link>
        <div className="mx-4 mb-8 rounded-xl border border-app/20 px-4 py-4">
          <p className="font-medium">Saathi Matchmakers</p>
          <p className="mt-1 text-xs text-app/80">Your agency workspace</p>
        </div>
        <nav aria-label="Primary navigation" className="flex-1 space-y-2 px-4">
          {navigation.map(({ key, label, icon }) => (
            <Link
              key={key}
              href={screenLink(key)}
              aria-current={activeNav === key ? "page" : undefined}
              className={`flex min-h-12 items-center gap-4 rounded-lg px-4 py-2 font-medium focus-visible:outline-app ${activeNav === key ? "bg-app text-navy" : "text-app/85 hover:bg-app/10"}`}
            >
              <Icon as={icon} />
              {label}
              {key === "introductions" && (
                <span className="ml-auto text-xs">
                  {
                    visibleIntroductions.filter((item) =>
                      ["created", "shared"].includes(item.state),
                    ).length
                  }
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="m-4 rounded-xl border border-app/20 p-4">
          <Icon as={ShieldCheck} className="mb-2 text-sage" />
          <p className="text-sm">Your customers. Your agency.</p>
          <p className="mt-2 text-xs leading-relaxed text-app/80">
            Customer portfolios stay owned and controlled by each person.
          </p>
        </div>
        <div className="flex items-center gap-2 border-t border-app/20 p-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sage text-xs font-medium text-navy">
            MK
          </span>
          <div>
            <p className="text-sm font-medium">Maya Kapoor</p>
            <p className="text-xs text-app/80">{role} preview</p>
          </div>
        </div>
      </aside>
      <div className="lg:ml-56">
        <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-2 border-b border-structure bg-app/95 px-4 py-2 backdrop-blur-sm sm:px-8 lg:min-h-20">
          <div className="flex min-w-0 items-center gap-2">
            <Icon as={HeartHandshake} className="lg:hidden" />
            <span className="hidden text-muted sm:inline">
              Saathi Matchmakers
            </span>
            <Icon as={ChevronRight} className="hidden text-muted sm:block" />
            <span className="font-medium">
              {navigation.find((item) => item.key === activeNav)?.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-structure px-2 py-1 text-xs text-muted min-[360px]:inline">
              NAK-208 · Sample data
            </span>
            <Button
              onClick={(event) => openModal({ type: "controls" }, event)}
              className="min-h-12 px-2 sm:px-4"
              aria-label="Open prototype review controls"
            >
              <Icon as={SlidersHorizontal} />
              <span className="hidden sm:inline">Review controls</span>
            </Button>
          </div>
        </header>
        <main
          id="main-content"
          className={`mx-auto max-w-[1440px] px-4 pb-[calc(192px+env(safe-area-inset-bottom))] pt-8 sm:px-8 lg:pb-16 ${screen === "matches" || screen === "review" ? "lg:px-6" : ""}`}
        >
          {unauthorized ? (
            <div className="rounded-2xl border border-structure p-8">
              <h1
                id="page-title"
                tabIndex={-1}
                className="font-display text-2xl font-semibold"
              >
                This view is unavailable
              </h1>
              <p className="mt-2 text-muted">
                Return to your assigned customer book.
              </p>
              <Button href={screenLink("customers")} className="mt-4">
                Open customers
              </Button>
            </div>
          ) : (
            <>
              {screen === "today" && (
                <Today {...sharedProps} invited={invited} />
              )}
              {screen === "customers" && (
                <Customers {...sharedProps} invited={invited} />
              )}
              {screen === "customer" && (
                <CustomerDetail {...sharedProps} customer={a} />
              )}
              {screen === "matches" && (
                <MatchWorkspace {...sharedProps} a={a} />
              )}
              {screen === "review" && (
                <PairReview {...sharedProps} a={a} b={b} />
              )}
              {screen === "introductions" && <Introductions {...sharedProps} />}
              {screen === "introduction" && (
                <IntroductionDetail
                  {...sharedProps}
                  intro={intro}
                  markReviewed={() => {
                    updateIntro({ reviewed: true });
                    setToast("Response marked as reviewed.");
                  }}
                />
              )}
              {screen === "team" && <Team {...sharedProps} />}
              {screen === "settings" && <Settings {...sharedProps} />}
            </>
          )}
        </main>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-structure bg-app px-2 pb-[env(safe-area-inset-bottom)] shadow-float lg:hidden"
      >
        {navigation.map(({ key, label, icon }) => (
          <Link
            key={key}
            href={screenLink(key)}
            aria-label={label}
            aria-current={activeNav === key ? "page" : undefined}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium ${activeNav === key ? "text-navy" : "text-muted hover:bg-structure/50"}`}
          >
            <Icon as={icon} />
            <span>{key === "introductions" ? <><span className="min-[360px]:hidden">Pairs</span><span className="hidden min-[360px]:inline">Introductions</span></> : label}</span>
            {activeNav === key && (
              <span className="h-1 w-4 rounded-full bg-navy" />
            )}
          </Link>
        ))}
      </nav>
      <Toast message={toast} onDismiss={dismissToast} />
      <Modal
        open={Boolean(modal)}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
        returnFocusRef={openerRef}
        animate={modal?.animate}
        wide={modal?.type === "filters"}
        title={modalTitle(modal, a, b)}
        description={modalDescription(modal)}
      >
        {modal?.type === "controls" && (
          <div className="space-y-4">
            <p className="rounded-lg border border-structure p-4 text-sm leading-relaxed text-muted">
              This is a fictional workspace. Actions stay in this browser
              session. Matching checks are a policy proposal, and messages are
              never sent.
            </p>
            <label className="grid gap-2">
              <span className="font-medium">View workspace as</span>
              <select
                name="previewRole"
                className={control}
                value={role}
                onChange={(event) => {
                  setRole(event.target.value);
                  router.push(screenLink("customers"));
                }}
              >
                <option>Admin</option>
                <option>Advisor</option>
                <option>Coordinator</option>
                <option>Viewer</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="font-medium">Sample view state</span>
              <select
                name="previewState"
                className={control}
                value={sampleState}
                onChange={(event) => setSampleState(event.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="loading">Loading profiles</option>
                <option value="empty">Empty customer book</option>
                <option value="error">Loading error</option>
                <option value="long">Long customer name</option>
              </select>
            </label>
            <p className="text-xs leading-relaxed text-muted">
              Advisor, Coordinator and Viewer show Maya’s assigned customers.
              These controls demonstrate UX differences, not production
              authorization.
            </p>
            <Button
              onClick={() => setModal(null)}
              variant="primary"
              className="w-full"
            >
              View workspace
            </Button>
          </div>
        )}
        {modal?.type === "invite" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const email = new FormData(event.currentTarget).get("email");
              if (!String(email).includes("@")) {
                setInviteError("Enter the customer’s exact email address.");
                return;
              }
              setInvited(true);
              setModal(null);
              setToast("Sample invitation prepared. No email was sent.");
            }}
            className="space-y-4"
          >
            <label className="grid gap-2">
              <span className="font-medium">Customer’s exact email</span>
              <input
                className={control}
                name="email"
                type="email"
                required
                autoComplete="off"
                spellCheck={false}
                placeholder="customer@example.com"
                aria-describedby="invite-help invite-error"
              />
            </label>
            <p id="invite-help" className="text-sm leading-relaxed text-muted">
              The customer signs in with this email, accepts your agency
              relationship, and publishes their own VivIntro portfolio. The
              invitation expires in 7 days.
            </p>
            <p id="invite-error" role="alert" className="text-navy">
              {inviteError}
            </p>
            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2 font-medium text-app"
            >
              <Icon as={Mail} />
              Prepare invitation
            </button>
          </form>
        )}
        {modal?.type === "filters" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { key: "ageBand", label: "Age", values: ["26–29", "30–34"] },
              {
                key: "heightBand",
                label: "Height",
                values: ["Below 175 cm", "175 cm or taller"],
              },
              {
                key: "diet",
                label: "Diet",
                values: ["Vegetarian", "Non-vegetarian"],
              },
              {
                key: "manglik",
                label: "Manglik status",
                values: ["Manglik", "Not Manglik", "Not provided"],
              },
              {
                key: "region",
                label: "State / region",
                values: ["Maharashtra", "Karnataka", "Gujarat", "Texas"],
              },
              {
                key: "marital",
                label: "Marital status",
                values: ["Never married", "Previously married"],
              },
              {
                key: "community",
                label: "Community",
                values: ["Brahmin", "Jain"],
              },
              {
                key: "subCaste",
                label: "Sub-caste",
                values: ["Deshastha", "Konkanastha", "Not provided"],
              },
              {
                key: "visa",
                label: "Residence / relocation",
                values: [
                  "Lives in India",
                  "Open to relocating",
                  "US work visa",
                ],
              },
            ].map(({ key, label, values }) => (
              <label key={key} className="grid gap-2">
                <span className="font-medium">{label}</span>
                <select
                  name={key}
                  className={control}
                  value={params.get(key) || "any"}
                  onChange={(event) => changeParam(key, event.target.value)}
                >
                  <option value="any">Any</option>
                  {values.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            ))}
            <p className="text-sm leading-relaxed text-muted sm:col-span-2">
              Search filters narrow this view. They do not override consent,
              readiness, duplicate-pair or compatibility checks. Gotra is
              checked for the pair under the draft policy.
            </p>
            <Button
              variant="primary"
              onClick={() => setModal(null)}
              className="sm:col-span-2"
            >
              Show results
            </Button>
          </div>
        )}
        {modal?.type === "create" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[a, b].map((customer) => (
                <div
                  key={customer.ref}
                  className="rounded-xl border border-structure p-4"
                >
                  <Portrait customer={customer} compact />
                  <p className="mt-2 break-words font-medium">
                    {customer.name}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Published version {customer.version}
                  </p>
                </div>
              ))}
            </div>
            <ul className="space-y-2 text-sm leading-relaxed">
              <li className="flex gap-2">
                <Icon as={Check} />
                Both portfolios are saved as they are at creation.
              </li>
              <li className="flex gap-2">
                <Icon as={Clock3} />
                Each customer has 15 days to respond.
              </li>
              <li className="flex gap-2">
                <Icon as={LockKeyhole} />
                Each customer and their active, candidate-authorized Family
                Viewers can open the opposite Broker Standard Profile.
              </li>
            </ul>
            <div className="rounded-xl border border-structure p-4 text-sm leading-relaxed text-muted">
              If both confirm Interested, each receives the other’s Complete
              Portfolio, including Protected Contact, for 30 days. Eligible
              Family Viewers are frozen at that moment. Your broker view
              remains Broker Standard.
            </div>
            <label className="flex items-start gap-4 rounded-xl border border-structure p-4">
              <input
                type="checkbox"
                className="h-6 w-6 shrink-0 accent-navy"
                checked={pairReviewed}
                onChange={(event) => setPairReviewed(event.target.checked)}
              />
              <span className="text-sm leading-relaxed">
                I reviewed both customers’ preferences and any differences
                before introducing this pair.
              </span>
            </label>
            <Button
              variant="primary"
              disabled={!pairReviewed}
              onClick={createIntroduction}
              className="w-full"
            >
              Create Introduction
              <Icon as={HeartHandshake} />
            </Button>
          </div>
        )}
        {modal?.type === "share" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-structure p-4">
              <p className="mb-2 text-xs font-medium text-muted">
                Message preview
              </p>
              <p className="text-sm leading-relaxed">
                Saathi Matchmakers has a private VivIntro Introduction for {customerByRef(intro[modal.side]).name}.
                Sign in to review using the private link below.
              </p>
              <code className="mt-4 block break-all text-xs leading-relaxed text-muted">
                https://vivintro.example.invalid/introductions/{intro.ref}
              </code>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Forwarding the URL gives anyone else no access. Share this in the
              existing WhatsApp group for this customer and family.
            </p>
            <div className="rounded-xl bg-sand/30 p-4 text-sm">
              <p className="font-medium">
                {intro.shareStates?.[modal.side]?.state === "confirmed"
                  ? "Broker confirmed as shared"
                  : intro.shareStates?.[modal.side]?.state === "initiated"
                    ? "Share initiated"
                    : "Not shared with this side"}
              </p>
              <p className="mt-1 leading-relaxed text-muted">
                Opening a WhatsApp share sheet does not prove delivery or that
                the intended group was selected. No message is sent here.
              </p>
            </div>
            {shareError && (
              <p
                role="alert"
                className="rounded-lg border border-rose bg-rose/30 p-4"
              >
                Copy did not work. Select and copy the example URL above, or try
                again.
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="primary"
                onClick={() => recordShare(modal.side, "initiated")}
              >
                <Icon as={Send} />
                Share on WhatsApp
              </Button>
              <Button onClick={() => copyExample(modal.side)}>
                <Icon as={Copy} />
                Copy secure link
              </Button>
            </div>
            {intro.shareStates?.[modal.side]?.state === "initiated" && (
              <Button
                onClick={() => recordShare(modal.side, "confirmed")}
                className="w-full"
              >
                Mark shared after confirming
              </Button>
            )}
          </div>
        )}
        {modal?.type === "familyProposal" && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const customerRef = modal.customerRef;
              const proposal = {
                name: String(data.get("name") || "").trim(),
                relationship: String(data.get("relationship") || "").trim(),
                status: "proposed",
              };
              if (!proposal.name || !proposal.relationship) return;
              setFamilyProposals((current) => ({
                ...current,
                [customerRef]: [...(current[customerRef] || []), proposal],
              }));
              setModal(null);
              setToast("Family viewer proposed. Candidate approval is still required.");
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 sm:col-span-2">
                <span className="font-medium">Family member name</span>
                <input name="name" required maxLength={80} className={control} />
              </label>
              <label className="grid gap-2">
                <span className="font-medium">Relationship</span>
                <select name="relationship" required className={control}>
                  <option value="">Choose</option>
                  <option>Mother</option>
                  <option>Father</option>
                  <option>Sibling</option>
                  <option>Guardian</option>
                  <option>Other family member</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="font-medium">Google email</span>
                <input name="email" type="email" required className={control} />
              </label>
              <label className="grid gap-2 sm:col-span-2">
                <span className="font-medium">WhatsApp number (optional)</span>
                <input name="phone" type="tel" className={control} />
              </label>
            </div>
            <p className="rounded-xl bg-sage/20 p-4 text-sm leading-relaxed">
              This creates a proposal only. It grants no access. The candidate
              must approve it, and the family member must continue with the
              exact invited Google account.
            </p>
            <Button type="submit" variant="primary" className="w-full">
              Propose family viewer
            </Button>
          </form>
        )}
        {modal?.type === "familyUpdate" && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const update = {
                status: String(data.get("status")),
                source: String(data.get("source") || "Family"),
                channel: String(data.get("channel")),
                at: "Just now",
              };
              updateIntro({
                familyUpdates: {
                  ...intro.familyUpdates,
                  [modal.side]: update,
                },
              });
              setModal(null);
              setToast("Family update recorded separately from the candidate decision.");
            }}
          >
            <label className="grid gap-2">
              <span className="font-medium">What did the family report?</span>
              <select name="status" className={control} required>
                <option value="family-interested">Appears interested</option>
                <option value="family-declined">Declined verbally</option>
                <option value="needs-time">Needs more time</option>
                <option value="callback">Requested a callback</option>
                <option value="no-response">No response yet</option>
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="font-medium">Reported by</span>
                <input name="source" maxLength={40} className={control} placeholder="Mother" />
              </label>
              <label className="grid gap-2">
                <span className="font-medium">Conversation</span>
                <select name="channel" className={control} required>
                  <option>WhatsApp</option>
                  <option>Phone call</option>
                  <option>In person</option>
                </select>
              </label>
            </div>
            <label className="grid gap-2">
              <span className="font-medium">Private broker note (optional)</span>
              <textarea name="comment" maxLength={500} rows={3} className={control} />
            </label>
            <p className="rounded-xl border border-sand bg-sand/20 p-4 text-sm leading-relaxed">
              This does not submit Interested or Decline. Only the signed-in
              candidate can make the final decision.
            </p>
            <Button type="submit" variant="primary" className="w-full">
              Record family update
            </Button>
          </form>
        )}
        {modal?.type === "revoke" && (
          <div className="space-y-4">
            <p className="rounded-xl border border-rose bg-rose/20 p-4 text-sm leading-relaxed">
              This stops both customers’ access immediately. A revoked link
              cannot become active again. Existing responses remain in the
              history.
            </p>
            <Button
              variant="rose"
              className="w-full"
              onClick={() => {
                updateIntro({ state: "revoked", completeUntil: null });
                setModal(null);
                setToast("Introduction revoked in this preview.");
              }}
            >
              Revoke this Introduction
            </Button>
          </div>
        )}
        {modal?.type === "response" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-sand bg-sand/20 p-4 text-sm leading-relaxed">
              <p className="font-medium">Candidate-session simulation</p>
              <p className="mt-1 text-muted">
                This exists only to review the end-to-end wireframe. A broker
                cannot submit or change a candidate response in production.
              </p>
            </div>
            <Badge state="neutral">
              Simulating {customerByRef(intro[modal.side]).name}’s signed-in view
            </Badge>
            <p className="text-sm leading-relaxed">
              Saathi Matchmakers introduced you to{" "}
              {customerByRef(intro[modal.side === "a" ? "b" : "a"]).name}. You
              choose independently. Your response cannot be changed after
              submission.
            </p>
            <label className="flex items-start gap-4 rounded-xl border border-structure p-4">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1 h-6 w-6 shrink-0 accent-navy"
              />
              <span className="text-sm leading-relaxed">
                I understand that if we both choose Interested, we will each see
                the other’s Complete Portfolio, including Protected Contact, for
                30 days. The other candidate currently has {customerByRef(
                  intro[modal.side === "a" ? "b" : "a"],
                ).familyViewers.filter((viewer) => viewer.status === "active").length} authorized family viewer(s), with a maximum of three. Their eligible viewers are fixed when mutual interest begins. There is no later contact-approval step.
              </span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="rose"
                onClick={() => respond(modal.side, "declined")}
              >
                Simulate Decline
              </Button>
              <Button
                variant="primary"
                disabled={!consent}
                onClick={() => respond(modal.side, "interested")}
              >
                Simulate Interested
                <Icon as={ArrowRight} />
              </Button>
            </div>
          </div>
        )}
        {modal?.type === "info" && (
          <div className="space-y-4">
            <p className="rounded-xl border border-structure p-4 text-sm leading-relaxed">
              {modal.message}
            </p>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => setModal(null)}
            >
              Understood
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function modalTitle(modal, a, b) {
  if (!modal) return "Workspace dialog";
  return {
    controls: "Review the prototype",
    invite: "Invite a customer",
    filters: "Refine your view",
    create: `Introduce ${a.name.split(" ")[0]} and ${b.name.split(" ")[0]}`,
    share: modal.title || "Share with customer",
    familyProposal: "Propose a family viewer",
    familyUpdate: modal.title || "Record a family update",
    revoke: "Revoke access?",
    response: "Simulate a candidate response",
    info: modal.title || "About this action",
  }[modal.type];
}
function modalDescription(modal) {
  return (
    {
      controls: "Choose a role or an exception state to explore.",
      invite: "Connect one customer-owned portfolio with your agency.",
      filters: "Keep the facts that matter to this search close at hand.",
      create: "One pair. Two independent customer decisions.",
      share: "Record sharing for one customer side without claiming delivery.",
      familyProposal: "The candidate remains in control of who receives access.",
      familyUpdate: "A family conversation is not the candidate’s final response.",
      revoke: "This affects both participants immediately.",
      response: "Preview of the customer’s VivIntro response screen.",
      info: "A little context before your next step.",
    }[modal?.type] || ""
  );
}
