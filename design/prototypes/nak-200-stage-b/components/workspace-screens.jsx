"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  ArrowRight,
  Check,
  LockKeyhole,
  Clock3,
  HeartHandshake,
  FileText,
  UsersRound,
  MessageCircle,
  Mail,
  ShieldCheck,
  CircleHelp,
  Copy,
  Send,
  ChevronRight,
} from "lucide-react";
import { customers, customerByRef, canCreate, team } from "../lib/sample-data";
import {
  Badge,
  Button,
  Icon,
  Panel,
  Portrait,
  PageHeading,
  Empty,
  StateView,
  BackLink,
  control,
  labels,
} from "./ui";
import { screenLink } from "../lib/navigation";

export function CustomerCard({ customer, longName = false }) {
  const available = customer.readiness === "ready";
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-structure bg-app p-4 shadow-paper">
      {available ? (
        <Portrait customer={customer} />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-structure/50">
          <div className="px-4 text-center">
            <Icon as={LockKeyhole} className="mx-auto mb-2 text-muted" />
            <p className="text-sm text-muted">
              {customer.readiness === "paused"
                ? "Portfolio access paused"
                : "Awaiting customer consent"}
            </p>
          </div>
        </div>
      )}
      <div className="mt-4 flex items-start justify-between gap-2">
        <h2 className="min-w-0 break-words font-display text-base font-semibold leading-tight">
          {longName ? "Aditi Lakshmi Narayanaswamy Rao" : customer.name}
        </h2>
        <Badge state={customer.readiness} />
      </div>
      {available ? (
        <>
          <p className="mt-2 text-sm leading-tight">
            {customer.age} years · {customer.profession}
          </p>
          <p className="mt-2 text-sm text-muted">{customer.location}</p>
        </>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {customer.readiness === "paused"
            ? "The customer controls when representation resumes."
            : "The customer accepts your invitation and publishes their portfolio."}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-structure pt-4 text-xs text-muted">
        <Icon as={UsersRound} className="h-4 w-4" />
        <span>{customer.assigned.join(" · ")}</span>
      </div>
      <Button
        href={screenLink("customer", { customer: customer.ref })}
        className="mt-4 w-full"
      >
        Open customer
        <Icon as={ArrowRight} />
      </Button>
    </article>
  );
}

export function Customers({
  role,
  visibleCustomers,
  sampleState,
  setSampleState,
  query,
  setQuery,
  params,
  changeParam,
  openModal,
  invited,
}) {
  const [view, setView] = useState("cards");
  const readiness = params.get("status") || "all";
  const assignee = params.get("assignee") || "all";
  const results = visibleCustomers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(query.toLowerCase()) &&
      (readiness === "all" || customer.readiness === readiness) &&
      (assignee === "all" || customer.assigned.includes(assignee)),
  );
  return (
    <>
      <PageHeading
        eyebrow="Your customer book"
        title="People you represent"
        description="One place to remember the person, their family and what happens next."
      >
        {role === "Admin" && (
          <Button
            variant="primary"
            onClick={(event) => openModal({ type: "invite" }, event)}
          >
            <Icon as={Plus} />
            Invite customer
          </Button>
        )}
      </PageHeading>
      {invited && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-sand bg-sand/20 p-4"
        >
          Sample invitation prepared · Awaiting acceptance · Expires in 7 days
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <label className="grid min-w-0 flex-1 gap-2 sm:min-w-64">
          <span className="text-xs font-medium text-muted">
            Find a customer
          </span>
          <div className="relative">
            <Icon as={Search} className="absolute left-4 top-4 text-muted" />
            <input
              type="search"
              name="customerSearch"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name…"
              className={`${control} w-full pl-12`}
            />
          </div>
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-medium text-muted">Readiness</span>
          <select
            name="customerStatus"
            className={control}
            value={readiness}
            onChange={(event) => changeParam("status", event.target.value)}
          >
            <option value="all">All customers</option>
            <option value="ready">Ready</option>
            <option value="paused">Paused</option>
            <option value="invited">Invited</option>
          </select>
        </label>
        {role === "Admin" && (
          <label className="grid gap-2">
            <span className="text-xs font-medium text-muted">Assigned to</span>
            <select
              name="assignee"
              className={control}
              value={assignee}
              onChange={(event) => changeParam("assignee", event.target.value)}
            >
              <option value="all">Anyone</option>
              <option>Maya</option>
              <option>Neha</option>
              <option>Vikram</option>
            </select>
          </label>
        )}
        <div className="flex gap-2" role="group" aria-label="Customer layout">
          <Button
            aria-label="Show customer cards"
            aria-pressed={view === "cards"}
            variant={view === "cards" ? "primary" : "secondary"}
            onClick={() => setView("cards")}
            className="px-4"
          >
            <Icon as={LayoutGrid} />
          </Button>
          <Button
            aria-label="Show customer list"
            aria-pressed={view === "list"}
            variant={view === "list" ? "primary" : "secondary"}
            onClick={() => setView("list")}
            className="px-4"
          >
            <Icon as={List} />
          </Button>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted" role="status">
          {results.length} customers
          {role !== "Admin" ? " · Assigned to Maya" : " · In your agency"}
        </p>
        <span className="flex items-center gap-2 text-xs text-muted">
          <Icon as={ShieldCheck} className="h-4 w-4" />
          Customer-owned VivIntro portfolios
        </span>
      </div>
      <StateView
        state={sampleState}
        onRetry={() => setSampleState("normal")}
        empty={
          <Empty
            title="Your customer book starts here"
            description="Invite a customer to connect their VivIntro portfolio with your agency."
            action={
              role === "Admin" ? (
                <Button
                  variant="primary"
                  onClick={(event) => openModal({ type: "invite" }, event)}
                >
                  Invite customer
                </Button>
              ) : (
                <Button onClick={() => setSampleState("normal")}>
                  Return to sample customers
                </Button>
              )
            }
          />
        }
      >
        {results.length === 0 ? (
          <Empty
            action={
              <Button
                onClick={() => {
                  setQuery("");
                  const next = new URLSearchParams(params.toString());
                  next.delete("status");
                  next.delete("assignee");
                  window.history.replaceState(null, "", `/?${next}`);
                }}
              >
                Clear search and filters
              </Button>
            }
          />
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {results.map((customer, index) => (
              <CustomerCard
                key={customer.ref}
                customer={customer}
                longName={sampleState === "long" && index === 0}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-structure">
            <div className="hidden grid-cols-4 gap-4 border-b border-structure bg-structure/30 p-4 text-xs font-medium text-muted md:grid">
              <span>Customer</span>
              <span>Readiness</span>
              <span>Assigned team</span>
              <span>Representation</span>
            </div>
            {results.map((customer) => (
              <Link
                key={customer.ref}
                href={screenLink("customer", { customer: customer.ref })}
                className="grid grid-cols-1 items-center gap-4 border-b border-structure p-4 last:border-0 hover:bg-structure/20 md:grid-cols-4"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Portrait customer={customer} compact />
                  <span className="min-w-0 break-words font-medium">
                    {customer.name}
                  </span>
                </div>
                <Badge state={customer.readiness} />
                <span className="text-sm text-muted">
                  {customer.assigned.join(", ")}
                </span>
                <span className="text-sm text-muted">{customer.mandate}</span>
              </Link>
            ))}
          </div>
        )}
      </StateView>
    </>
  );
}

export function Today({
  role,
  visibleCustomers,
  introductions,
  sampleState,
  setSampleState,
  openModal,
}) {
  const responses = introductions.filter((intro) => !intro.reviewed);
  const open = introductions.filter((intro) =>
    ["created", "shared"].includes(intro.state),
  );
  return (
    <>
      <PageHeading
        eyebrow="Today · Tuesday, 13 October"
        title="A little clarity for your day"
        description="Pick up the conversations and Introductions that need your attention."
      >
        <Button variant="primary" href={screenLink("customers")}>
          Open customer book
          <Icon as={ArrowRight} />
        </Button>
      </PageHeading>
      <StateView state={sampleState} onRetry={() => setSampleState("normal")}>
        <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[
            {
              label: "Customers ready",
              value: visibleCustomers.filter(
                (customer) => customer.readiness === "ready",
              ).length,
            },
            { label: "Open Introductions", value: open.length },
            { label: "Responses to review", value: responses.length },
            {
              label: "Mutual interest",
              value: introductions.filter((intro) => intro.state === "mutual")
                .length,
            },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-structure p-4">
              <p className="text-sm text-muted">{label}</p>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
                {value}
              </p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">
                Needs your attention
              </h2>
              <Badge state="waiting">
                {responses.length + open.length} items
              </Badge>
            </div>
            {responses.length + open.length === 0 ? (
              <Empty
                title="You’re all caught up"
                description="Your team’s latest responses are reviewed. Explore your customer book when you’re ready."
                action={
                  <Button href={screenLink("customers")}>Open customers</Button>
                }
              />
            ) : (
              <div className="divide-y divide-structure">
                {responses.map((intro) => (
                  <Link
                    key={`response-${intro.ref}`}
                    href={screenLink("introduction", { intro: intro.ref })}
                    className="flex min-h-24 items-center gap-4 py-4 hover:bg-structure/20"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage/40">
                      <Icon as={MessageCircle} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        A customer response is ready
                      </p>
                      <p className="mt-1 break-words text-sm text-muted">
                        {customerByRef(intro.a).name} +{" "}
                        {customerByRef(intro.b).name}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {intro.creator} · Review and decide your next
                        conversation
                      </p>
                    </div>
                    <Icon as={ChevronRight} />
                  </Link>
                ))}
                {open.map((intro) => (
                  <Link
                    key={`open-${intro.ref}`}
                    href={screenLink("introduction", { intro: intro.ref })}
                    className="flex min-h-24 items-center gap-4 py-4 hover:bg-structure/20"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sand/40">
                      <Icon as={Clock3} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {intro.state === "created"
                          ? "Ready to share with both sides"
                          : "Waiting for a customer"}
                      </p>
                      <p className="mt-1 break-words text-sm text-muted">
                        {customerByRef(intro.a).name} +{" "}
                        {customerByRef(intro.b).name}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Respond by {intro.deadline}
                      </p>
                    </div>
                    <Icon as={ChevronRight} />
                  </Link>
                ))}
              </div>
            )}
          </Panel>
          <Panel>
            <div className="mb-4 flex items-center gap-2">
              <Icon as={FileText} />
              <h2 className="font-display text-lg font-semibold">
                Keep the person in view
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Aditi has published version 4. New Introductions use this version;
              existing Introductions keep the version shared at creation.
            </p>
            <div className="my-6 flex items-center gap-4">
              <Portrait customer={customers[0]} compact />
              <div>
                <p className="font-medium">Aditi Rao</p>
                <p className="mt-1 text-sm text-muted">
                  Published portfolio update
                </p>
              </div>
            </div>
            <Button
              href={screenLink("customer", { customer: customers[0].ref })}
              className="w-full"
            >
              Review customer update
              <Icon as={ArrowRight} />
            </Button>
            <div className="mt-6 rounded-xl bg-sand/20 p-4">
              <p className="font-medium">A simple way to begin</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Invite a customer, let them publish their portfolio, then review
                a pair before creating an Introduction.
              </p>
              {role === "Admin" && (
                <Button
                  onClick={(event) => openModal({ type: "invite" }, event)}
                  className="mt-4"
                >
                  Invite customer
                  <Icon as={Plus} />
                </Button>
              )}
            </div>
          </Panel>
        </div>
      </StateView>
    </>
  );
}

export function ProfileSections({ customer }) {
  const sections = [
    { title: "About me", text: customer.about },
    {
      title: "Education & profession",
      text: `${customer.education}. ${customer.profession}.`,
    },
    { title: "Family", text: customer.family },
    { title: "Preferences", text: customer.preferences },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {sections.map((section) => (
        <details
          key={section.title}
          className="rounded-xl border border-structure p-4"
        >
          <summary className="min-h-12 font-medium">{section.title}</summary>
          <p className="mt-2 break-words text-sm leading-relaxed text-muted">
            {section.text}
          </p>
        </details>
      ))}
      <details className="rounded-xl border border-structure p-4 md:col-span-2">
        <summary className="min-h-12 font-medium">Astrology</summary>
        <dl className="mt-2 grid grid-cols-2 gap-4 leading-tight">
          <div>
            <dt className="text-xs text-muted">Gotra</dt>
            <dd className="mt-1 font-medium">{customer.gotra}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Manglik status</dt>
            <dd className="mt-1 font-medium">{customer.manglik}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Published horoscope attachment appears here when permitted. Exact
          birth time is excluded from Broker Standard.
        </p>
      </details>
    </div>
  );
}

export function CustomerDetail({
  customer,
  role,
  introductions,
  openModal,
  familyProposals = {},
}) {
  const available = customer.readiness === "ready";
  const history = introductions.filter((intro) =>
    [intro.a, intro.b].includes(customer.ref),
  );
  const familyViewers = [
    ...(customer.familyViewers || []),
    ...(familyProposals[customer.ref] || []),
  ];
  const activeFamilyCount = familyViewers.filter(
    (viewer) => viewer.status === "active",
  ).length;
  return (
    <>
      <BackLink href={screenLink("customers")}>Customer book</BackLink>
      <PageHeading
        eyebrow="Customer portfolio"
        title={customer.name}
        description={
          available
            ? "A customer-owned portfolio, with your agency’s representation and history alongside it."
            : "This customer’s portfolio is currently unavailable to your agency."
        }
      >
        {available && canCreate(role) && (
          <Button
            variant="primary"
            href={screenLink("matches", { customer: customer.ref })}
          >
            Find matches
            <Icon as={HeartHandshake} />
          </Button>
        )}
      </PageHeading>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[288px_minmax(0,1fr)]">
        <Panel>
          {available ? (
            <Portrait customer={customer} />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-structure/50">
              <Icon as={LockKeyhole} />
              <span className="ml-2 text-muted">Portfolio unavailable</span>
            </div>
          )}
          <div className="mt-4">
            <Badge state={customer.readiness} />
          </div>
          {available && (
            <>
              <p className="mt-4 font-medium">
                {customer.age} years · {customer.height}
              </p>
              <p className="mt-2 text-sm text-muted">{customer.profession}</p>
              <p className="mt-2 text-sm text-muted">{customer.location}</p>
            </>
          )}
          <div className="mt-6 border-t border-structure pt-4">
            <p className="text-xs font-medium text-muted">
              Team helping this customer
            </p>
            <p className="mt-2 text-sm">{customer.assigned.join(" · ")}</p>
          </div>
          <div className="mt-4 border-t border-structure pt-4">
            <p className="text-xs font-medium text-muted">Representation</p>
            <p className="mt-2 text-sm">{customer.mandate}</p>
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel>
            <h2 className="mb-4 font-display text-lg font-semibold">
              Ready for an Introduction?
            </h2>
            {available ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  "Active mandate",
                  `Published version ${customer.version}`,
                  "Liveness complete",
                  "Staff assignment allowed",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 rounded-lg bg-sage/20 p-4"
                  >
                    <Icon as={Check} />
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-sand bg-sand/20 p-4 text-sm leading-relaxed">
                {customer.readiness === "paused"
                  ? "Representation is paused by the customer. Profile viewing and new Introductions are unavailable."
                  : "Waiting for the customer to accept the invitation and publish their portfolio. Their consent cannot be completed by your team."}
              </div>
            )}
          </Panel>
          {available && (
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold">
                    Family representatives
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                    The candidate controls one family roster across their active
                    brokers. Your team can propose a person, but cannot approve
                    or activate access.
                  </p>
                </div>
                <Badge state={customer.consentVersion === "V3" ? "ready" : "waiting"}>
                  {customer.consentVersion === "V3"
                    ? `${activeFamilyCount} of 3 active`
                    : "V3 consent needed"}
                </Badge>
              </div>
              {familyViewers.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-structure p-4 text-sm text-muted">
                  No family viewers are active. This does not prevent the
                  candidate from receiving or responding to an Introduction.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {familyViewers.map((viewer, index) => (
                    <div
                      key={`${viewer.name}-${index}`}
                      className="rounded-xl border border-structure p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{viewer.name}</p>
                          <p className="mt-1 text-xs text-muted">
                            {viewer.relationship}
                            {viewer.primary ? " · Primary contact" : ""}
                          </p>
                        </div>
                        <Badge
                          state={viewer.status === "active" ? "ready" : "waiting"}
                        >
                          {viewer.status === "active"
                            ? "Active"
                            : viewer.status === "awaiting-google"
                              ? "Awaiting Google"
                              : "Candidate approval needed"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {role !== "Viewer" && activeFamilyCount < 3 && (
                <Button
                  className="mt-4"
                  onClick={(event) =>
                    openModal(
                      {
                        type: "familyProposal",
                        customerRef: customer.ref,
                      },
                      event,
                    )
                  }
                >
                  <Icon as={UsersRound} />
                  Propose family viewer
                </Button>
              )}
              <p className="mt-4 text-xs leading-relaxed text-muted">
                Names and setup status are shown only to finish this agency’s
                onboarding. Other brokers and their activity remain invisible.
              </p>
            </Panel>
          )}
          {available && (
            <Panel>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold">
                    Broker Standard Profile
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    Read what matters first. Expand a section for the details.
                  </p>
                </div>
                <Badge>Version {customer.version}</Badge>
              </div>
              <dl className="mb-6 grid grid-cols-2 gap-4 border-b border-structure pb-6">
                {[
                  ["Age", `${customer.age} years`],
                  ["Height", customer.height],
                  ["Marital status", customer.marital],
                  ["Diet", customer.diet],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd className="mt-1 text-sm font-medium leading-tight">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <ProfileSections customer={customer} />
              <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted">
                <Icon as={LockKeyhole} className="h-4 w-4" />
                Protected Contact, financial information and owner-private notes
                are absent from your broker view.
              </p>
            </Panel>
          )}
          <Panel>
            <h2 className="mb-4 font-display text-lg font-semibold">
              Introduction history
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted">
                No Introductions yet. Start by reviewing a suitable pair.
              </p>
            ) : (
              <div className="divide-y divide-structure">
                {history.map((intro) => (
                  <Link
                    key={intro.ref}
                    href={screenLink("introduction", { intro: intro.ref })}
                    className="flex flex-wrap items-center justify-between gap-4 py-4 hover:bg-structure/20"
                  >
                    <div>
                      <p className="font-medium">
                        With{" "}
                        {
                          customerByRef(
                            intro.a === customer.ref ? intro.b : intro.a,
                          ).name
                        }
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Created {intro.created} · {intro.creator}
                      </p>
                    </div>
                    <Badge state={intro.state} />
                  </Link>
                ))}
              </div>
            )}
          </Panel>
          {available && role !== "Viewer" && (
            <Button
              onClick={(event) =>
                openModal(
                  {
                    type: "info",
                    title: "Ask the customer to clarify",
                    message:
                      "Your team can flag a portfolio update for clarification. The customer edits and publishes their own portfolio. This preview does not send a message or change the published information.",
                  },
                  event,
                )
              }
            >
              Ask for clarification
              <Icon as={CircleHelp} />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

export function Introductions({
  introductions,
  params,
  changeParam,
  sampleState,
  setSampleState,
}) {
  const state = params.get("introState") || "all";
  const results = introductions.filter(
    (intro) =>
      state === "all" ||
      (state === "open"
        ? ["created", "shared"].includes(intro.state)
        : state === "closed"
          ? ["declined", "revoked", "expired"].includes(intro.state)
          : intro.state === state),
  );
  return (
    <>
      <PageHeading
        eyebrow="Introductions"
        title="Every pair, with a clear next step"
        description="See both customer responses and keep your follow-up connected to the pair."
      >
        <Button href={screenLink("customers")} variant="primary">
          Find a pair
          <Icon as={Plus} />
        </Button>
      </PageHeading>
      <div
        role="group"
        aria-label="Introduction status"
        className="mb-6 flex flex-wrap gap-2"
      >
        {[
          ["all", "All"],
          ["open", "Open"],
          ["mutual", "Mutual interest"],
          ["closed", "Closed"],
        ].map(([value, label]) => (
          <Button
            key={value}
            aria-pressed={state === value}
            variant={state === value ? "primary" : "secondary"}
            onClick={() => changeParam("introState", value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <StateView state={sampleState} onRetry={() => setSampleState("normal")}>
        {results.length === 0 ? (
          <Empty
            title="No Introductions in this view"
            description="Review another status or return to your customer book."
            action={
              <Button href={screenLink("customers")}>Open customers</Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-structure">
            <div className="hidden grid-cols-[2fr_1fr_1fr_1fr] gap-4 bg-structure/30 p-4 text-xs font-medium text-muted lg:grid">
              <span>Customer pair</span>
              <span>Responses</span>
              <span>Status</span>
              <span>Next date</span>
            </div>
            {results.map((intro) => (
              <Link
                key={intro.ref}
                href={screenLink("introduction", { intro: intro.ref })}
                className="grid grid-cols-1 items-center gap-4 border-t border-structure p-4 hover:bg-structure/20 lg:grid-cols-[2fr_1fr_1fr_1fr]"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative shrink-0">
                    <Portrait customer={customerByRef(intro.a)} compact />
                    <span className="absolute -right-2 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-app bg-sage text-xs">
                      {customerByRef(intro.b).initial}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="break-words font-medium">
                      {customerByRef(intro.a).name}
                      <br />
                      {customerByRef(intro.b).name}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Created {intro.created} · {intro.creator}
                    </p>
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <p>
                    {customerByRef(intro.a).name.split(" ")[0]} ·{" "}
                    {labels[intro.responses.a]}
                  </p>
                  <p>
                    {customerByRef(intro.b).name.split(" ")[0]} ·{" "}
                    {labels[intro.responses.b]}
                  </p>
                </div>
                <Badge state={intro.state} />
                <div>
                  <p className="text-xs text-muted">
                    {intro.completeUntil
                      ? "Complete access until"
                      : "Response deadline"}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {intro.completeUntil || intro.deadline}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </StateView>
    </>
  );
}

export function IntroductionDetail({ intro, role, openModal, markReviewed }) {
  const a = customerByRef(intro.a);
  const b = customerByRef(intro.b);
  const active =
    ["created", "shared", "mutual"].includes(intro.state) ||
    (intro.state === "declined" && intro.responseOpen !== false);
  const shareLabels = {
    "not-shared": "Not shared",
    initiated: "Share initiated",
    confirmed: "Broker confirmed shared",
  };
  const familyUpdateLabels = {
    "family-interested": "Appears interested",
    "family-declined": "Declined verbally",
    "needs-time": "Needs more time",
    callback: "Requested a callback",
    "no-response": "No response yet",
  };
  return (
    <>
      <BackLink href={screenLink("introductions")}>All Introductions</BackLink>
      <PageHeading
        eyebrow="Introduction detail"
        title={`${a.name.split(" ")[0]} + ${b.name.split(" ")[0]}`}
        description="The pair stays in view, from the first share to the next conversation."
      >
        <Badge state={intro.state} />
      </PageHeading>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Panel>
          <div className="grid grid-cols-2 gap-4">
            {[a, b].map((customer, index) => (
              <div key={customer.ref}>
                <Portrait customer={customer} />
                <h2 className="mt-4 break-words font-display text-lg font-semibold">
                  {customer.name}
                </h2>
                <p className="mt-2 text-sm text-muted">
                  {customer.age} · {customer.location}
                </p>
                <div className="mt-4">
                  <Badge state={intro.responses[index === 0 ? "a" : "b"]} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  Pinned version {intro.versions[index === 0 ? "a" : "b"]}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {(customer.familyViewers || []).filter(
                    (viewer) => viewer.status === "active",
                  ).length} active family viewer(s)
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-structure p-4">
            <p className="flex items-center gap-2 font-medium">
              <Icon as={LockKeyhole} />
              {intro.state === "mutual"
                ? "Complete access is active for both customers"
                : !active
                  ? "Customer access has ended"
                  : "Protected Contact stays hidden"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {intro.state === "mutual"
                ? `Both confirmed Interested. They and the family viewers frozen for this Introduction can view the opposite pinned Complete Portfolio until ${intro.completeUntil}. Your broker view does not include contact details.`
                : !active
                  ? "No active customer access remains on this Introduction. Recorded responses stay in its history."
                  : intro.state === "created"
                    ? "After that side is shared, the signed-in customer sees the opposite Broker Standard. Complete access starts only after both confirm Interested."
                    : "Each person sees Broker Standard. Reciprocal Complete access starts only after both confirm Interested."}
            </p>
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel>
            <h2 className="font-display text-lg font-semibold">
              Share with each family
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Use the existing WhatsApp group for each customer. These actions
              are separate so one side never appears shared because the other
              side was contacted.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {["a", "b"].map((side) => {
                const customer = customerByRef(intro[side]);
                const share = intro.shareStates?.[side] || {
                  state: "not-shared",
                  at: null,
                };
                return (
                  <div key={side} className="rounded-xl border border-structure p-4">
                    <p className="font-medium">{customer.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {shareLabels[share.state] || "Not shared"}
                      {share.at ? ` · ${share.at}` : ""}
                    </p>
                    {active && canCreate(role) && (
                      <Button
                        className="mt-4 w-full"
                        variant={share.state === "not-shared" ? "primary" : "secondary"}
                        onClick={(event) =>
                          openModal(
                            {
                              type: "share",
                              side,
                              title: `Share with ${customer.name}`,
                            },
                            event,
                          )
                        }
                      >
                        <Icon as={share.state === "not-shared" ? Send : Copy} />
                        {share.state === "not-shared" ? "Share on WhatsApp" : "Sharing actions"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel>
            <h2 className="mb-4 font-display text-lg font-semibold">
              Next broker action
            </h2>
            <p className="text-sm leading-relaxed text-muted">
              {intro.state === "created"
                ? "The Introduction is saved. Share separately with each customer’s existing family group."
                : intro.state === "mutual"
                  ? "Continue your usual conversations with both customers. Mutual interest keeps you involved; it does not mean a marriage outcome is confirmed."
                  : intro.state === "shared"
                    ? `Follow up with ${intro.responses.a === "waiting" ? a.name.split(" ")[0] : b.name.split(" ")[0]}. Their decision must be submitted by them in VivIntro.`
                    : intro.state === "declined" && active
                      ? "One customer declined. The other may still record their independent response until the deadline; Complete access will not open for this pair."
                      : "This Introduction is closed. Review the history before considering a new pair."}
            </p>
            <p className="mt-4 text-xs text-muted">
              Broker responsible · {intro.creator}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {!intro.reviewed && role !== "Viewer" && (
                <Button onClick={markReviewed}>
                  Mark response reviewed
                  <Icon as={Check} />
                </Button>
              )}
            </div>
            {intro.reviewed &&
              (intro.responses.a !== "waiting" ||
                intro.responses.b !== "waiting") && (
                <p className="mt-4 text-xs text-muted">
                  Latest response reviewed
                </p>
              )}
          </Panel>
          <Panel>
            <h2 className="font-display text-lg font-semibold">
              Family conversations
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Record what a family told the broker without turning it into the
              candidate’s Interested or Decline response.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {["a", "b"].map((side) => {
                const customer = customerByRef(intro[side]);
                const update = intro.familyUpdates?.[side];
                return (
                  <div key={side} className="rounded-xl border border-structure p-4">
                    <p className="font-medium">{customer.name}</p>
                    <p className="mt-2 text-sm">
                      {update
                        ? familyUpdateLabels[update.status] || update.status
                        : "No family update recorded"}
                    </p>
                    {update && (
                      <p className="mt-1 text-xs text-muted">
                        Reported by {update.source} through {update.channel} · {update.at}
                      </p>
                    )}
                    {active && role !== "Viewer" && (
                      <Button
                        className="mt-4 w-full"
                        onClick={(event) =>
                          openModal(
                            {
                              type: "familyUpdate",
                              side,
                              title: `Record ${customer.name.split(" ")[0]} family update`,
                            },
                            event,
                          )
                        }
                      >
                        <Icon as={MessageCircle} />
                        {update ? "Update family report" : "Record family update"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Candidate decisions remain separate, immutable and authoritative.
            </p>
          </Panel>
          <Panel>
            <h2 className="mb-4 font-display text-lg font-semibold">
              Two separate dates
            </h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted">Respond within 15 days</dt>
                <dd className="mt-2 font-medium">{intro.deadline}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">30-day Complete access</dt>
                <dd className="mt-2 font-medium">
                  {intro.completeUntil ||
                    (intro.state === "revoked" &&
                    intro.responses.a === "interested" &&
                    intro.responses.b === "interested"
                      ? "Ended on revocation"
                      : "Not started")}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              After mutual interest, Complete access can continue beyond the
              response deadline. Revocation ends access earlier.
            </p>
          </Panel>
        </div>
        <Panel>
          <h2 className="mb-4 font-display text-lg font-semibold">
            What happened
          </h2>
          <ol className="space-y-4">
            <li className="flex gap-4">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-navy" />
              <div>
                <p className="font-medium">
                  Introduction created by {intro.creator}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {intro.created} · Both published versions saved
                </p>
              </div>
            </li>
            {["a", "b"].map((side) => {
              const share = intro.shareStates?.[side];
              return share && share.state !== "not-shared" ? (
                <li key={`share-${side}`} className="flex gap-4">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-navy" />
                  <div>
                    <p className="font-medium">
                      {shareLabels[share.state]} with {customerByRef(intro[side]).name}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {share.at} · Delivery not inferred
                    </p>
                  </div>
                </li>
              ) : null;
            })}
            {["a", "b"].map((side) => {
              const update = intro.familyUpdates?.[side];
              return update ? (
                <li key={`family-${side}`} className="flex gap-4">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-navy" />
                  <div>
                    <p className="font-medium">
                      Family update for {customerByRef(intro[side]).name}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {familyUpdateLabels[update.status] || update.status} · Not a candidate response
                    </p>
                  </div>
                </li>
              ) : null;
            })}
            {(intro.responseOrder || ["a", "b"])
              .filter((side) => intro.responses[side] !== "waiting")
              .map((side) => (
                <li key={side} className="flex gap-4">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-navy" />
                  <div>
                    <p className="font-medium">
                      {customerByRef(intro[side]).name} ·{" "}
                      {labels[intro.responses[side]]}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {intro.responses[side] === "interested"
                        ? "Reciprocal disclosure consequence confirmed"
                        : "Customer decision recorded"}
                    </p>
                  </div>
                </li>
              ))}
            {intro.state === "mutual" && (
              <li className="rounded-lg bg-sage/30 p-4">
                <p className="font-medium">Mutual interest confirmed</p>
                <p className="mt-1 text-xs text-muted">
                  30-day reciprocal Complete access began
                </p>
              </li>
            )}
            {intro.state === "revoked" && (
              <li className="rounded-lg bg-rose/30 p-4">
                Introduction revoked · Access stopped for both customers
              </li>
            )}
          </ol>
        </Panel>
        <Panel>
          <h2 className="mb-4 font-display text-lg font-semibold">
            Candidate response simulator
          </h2>
          <p className="mb-4 rounded-xl border border-sand bg-sand/20 p-4 text-sm leading-relaxed">
            Prototype only. These controls simulate a response arriving from a
            separate authenticated candidate session. They must never appear
            as broker actions in production.
          </p>
          <div className="flex flex-wrap gap-2">
            {["a", "b"].map((side) => (
              <Button
                key={side}
                disabled={
                  !["shared", "declined"].includes(intro.state) ||
                  intro.responseOpen === false ||
                  intro.responses[side] !== "waiting" ||
                  !intro.shareStates?.[side] ||
                  intro.shareStates[side].state === "not-shared"
                }
                onClick={(event) =>
                  openModal({ type: "response", side }, event)
                }
              >
                Simulate {customerByRef(intro[side]).name.split(" ")[0]}’s
                response
                <Icon as={ArrowRight} />
              </Button>
            ))}
          </div>
          {active && canCreate(role) && (
            <Button
              variant="rose"
              onClick={(event) => openModal({ type: "revoke" }, event)}
              className="mt-6"
            >
              Revoke Introduction
            </Button>
          )}
        </Panel>
      </div>
    </>
  );
}

export function Team({ role, openModal, visibleCustomers }) {
  return (
    <>
      <PageHeading
        eyebrow="Team"
        title="A small team, working together"
        description="Keep responsibility clear without losing the shared agency context."
      >
        {role === "Admin" && (
          <Button
            variant="primary"
            onClick={(event) =>
              openModal(
                {
                  type: "info",
                  title: "Invite a team member",
                  message:
                    "The existing team invitation is email-bound, single-use and valid for 7 days. Production role changes and suspension require fresh authentication. This wireframe does not grant access.",
                },
                event,
              )
            }
          >
            <Icon as={Plus} />
            Invite team member
          </Button>
        )}
      </PageHeading>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {team.map((member) => (
          <Panel key={member.name}>
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-structure font-medium">
                {member.initial}
              </span>
              <div>
                <h2 className="font-display text-base font-semibold">
                  {member.name}
                </h2>
                <p className="mt-1 text-sm text-muted">{member.role}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted">
              {member.role === "Owner"
                ? "Agency-wide access"
                : `${visibleCustomers.filter((customer) => customer.assigned.includes(member.short)).length} visible assigned customers`}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {member.role === "Coordinator"
                ? "Reviews assigned customers and helps with follow-up. Introduction creation is unavailable."
                : member.role === "Owner"
                  ? "Manages the agency, team and access."
                  : "Reviews assigned portfolios and creates Introductions."}
            </p>
            {role === "Admin" && (
              <Button
                className="mt-4"
                onClick={(event) =>
                  openModal(
                    {
                      type: "info",
                      title: `${member.name}’s access`,
                      message:
                        "Customer assignment is shown here. Full assignment editing is a backend and UI dependency for the production pilot; the prototype does not change roles or staff access.",
                    },
                    event,
                  )
                }
              >
                Review access
                <Icon as={UsersRound} />
              </Button>
            )}
          </Panel>
        ))}
      </div>
    </>
  );
}

export function Settings({ role }) {
  return (
    <>
      <PageHeading
        eyebrow="Settings"
        title="The essentials for your agency"
        description="Simple, visible controls for how your team works."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="font-display text-lg font-semibold">Agency</h2>
          <dl className="mt-6 space-y-4">
            <div>
              <dt className="text-xs text-muted">Business</dt>
              <dd className="mt-1 font-medium">Saathi Matchmakers</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Current view</dt>
              <dd className="mt-1">{role}</dd>
            </div>
          </dl>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-semibold">Communication</h2>
          <div className="mt-4 flex items-center gap-2">
            <Icon as={Mail} />
            <span>Email notification outbox</span>
          </div>
          <div className="mt-4">
            <Badge state="waiting">WhatsApp provider not connected</Badge>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            AiSensy or a similar provider can later deliver neutral
            notifications. A delivery channel does not change who may view an
            Introduction.
          </p>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-semibold">
            Consent & timing
          </h2>
          <dl className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-muted">Customer invitation</dt>
              <dd className="mt-1 font-medium">7 days</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Fresh mandate on renewal</dt>
              <dd className="mt-1 font-medium">1 year</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Introduction response</dt>
              <dd className="mt-1 font-medium">15 days</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">After mutual interest</dt>
              <dd className="mt-1 font-medium">30 days</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Customers control pause, renewal and termination through My Brokers
            in VivIntro.
          </p>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-semibold">
            Matching policy preview
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Gotra, Manglik, missing information, preferences and overrides need
            an approved policy before production implementation. Sample card
            checks illustrate the proposed experience.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Liveness means a live person completed a check. It does not certify
            age, legal identity or the truth of their portfolio.
          </p>
        </Panel>
      </div>
    </>
  );
}
