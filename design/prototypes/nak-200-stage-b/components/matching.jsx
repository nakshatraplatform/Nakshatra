"use client";

import {
  Search,
  SlidersHorizontal,
  ArrowRight,
  HeartHandshake,
  Check,
  AlertCircle,
  LockKeyhole,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import { canCreate, pairAssessment } from "../lib/sample-data";
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
} from "./ui";
import { ProfileSections } from "./workspace-screens";
import { screenLink } from "../lib/navigation";

export function MatchWorkspace({
  a,
  visibleCustomers,
  introductions,
  sampleState,
  setSampleState,
  query,
  setQuery,
  params,
  changeParam,
  openModal,
}) {
  const state = params.get("check") || "ready";
  const fields = [
    "diet",
    "manglik",
    "region",
    "marital",
    "visa",
    "community",
    "subCaste",
    "ageBand",
    "heightBand",
  ];
  const candidates = visibleCustomers
    .filter((customer) => customer.ref !== a.ref)
    .map((customer) => ({
      customer,
      check: pairAssessment(a, customer, introductions),
    }));
  const filtered = candidates.filter(
    ({ customer, check }) =>
      (state === "all" || check.state === state) &&
      customer.name.toLowerCase().includes(query.toLowerCase()) &&
      fields.every((field) => {
        const value = params.get(field);
        if (!value) return true;
        if (field === "ageBand")
          return value === "26–29"
            ? customer.age >= 26 && customer.age <= 29
            : customer.age >= 30 && customer.age <= 34;
        if (field === "heightBand")
          return value === "Below 175 cm"
            ? Number.parseInt(customer.height) < 175
            : Number.parseInt(customer.height) >= 175;
        return customer[field] === value;
      }),
  );
  const filterCount = fields.filter((field) => params.get(field)).length;
  const readyCount = candidates.filter(
    (item) => item.check.state === "ready",
  ).length;
  return (
    <>
      <BackLink href={screenLink("customer", { customer: a.ref })}>
        Back to {a.name.split(" ")[0]}
      </BackLink>
      <PageHeading
        eyebrow="Find matches"
        title={`Find someone for ${a.name.split(" ")[0]}`}
        description="Explore the people in your agency. Review their facts, then bring one pair together."
      />
      <div className="sticky top-16 z-10 mb-4 flex items-center gap-2 rounded-xl border border-structure bg-app p-4 shadow-paper lg:hidden">
        <Portrait customer={a} compact />
        <div>
          <p className="text-xs text-muted">Matching for</p>
          <p className="font-medium">
            {a.name} · {a.age}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[256px_minmax(0,1fr)]">
        <aside className="hidden lg:sticky lg:top-28 lg:block">
          <Panel className="p-4 sm:p-4">
            <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted">
              Your reference customer
            </p>
            <Portrait customer={a} />
            <h2 className="mt-4 font-display text-xl font-semibold">
              {a.name}
            </h2>
            <p className="mt-2 text-sm">
              {a.age} years · {a.height}
            </p>
            <p className="mt-2 text-sm text-muted">{a.profession}</p>
            <p className="mt-2 text-sm text-muted">{a.location}</p>
            <div className="mt-4">
              <Badge state={a.readiness} />
            </div>
            <div className="mt-6 border-t border-structure pt-4">
              <p className="text-xs font-medium text-muted">
                What matters to {a.name.split(" ")[0]}
              </p>
              <p className="mt-2 text-sm leading-relaxed">{a.preferences}</p>
            </div>
            <details className="mt-4 border-t border-structure pt-4">
              <summary className="min-h-12 text-sm font-medium">
                Astrology details
              </summary>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-muted">Gotra</dt>
                  <dd className="mt-1 text-sm">{a.gotra}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Manglik</dt>
                  <dd className="mt-1 text-sm">{a.manglik}</dd>
                </div>
              </dl>
            </details>
          </Panel>
        </aside>
        <div className="min-w-0">
          <div className="mb-4 flex gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">
                Search potential customers by name
              </span>
              <Icon as={Search} className="absolute left-4 top-4 text-muted" />
              <input
                className={`${control} w-full pl-12`}
                type="search"
                name="matchSearch"
                autoComplete="off"
                placeholder="Search this customer book…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <Button onClick={(event) => openModal({ type: "filters" }, event)}>
              <Icon as={SlidersHorizontal} />
              <span>Filters{filterCount > 0 ? ` (${filterCount})` : ""}</span>
            </Button>
          </div>
          <div
            className="mb-4 flex flex-wrap gap-2"
            role="group"
            aria-label="Pair checks"
          >
            {[
              ["ready", `Ready to review ${readyCount}`],
              ["missing", "Needs information"],
              ["blocked", "Cannot introduce"],
              ["all", "All"],
            ].map(([value, label]) => (
              <Button
                key={value}
                variant={state === value ? "primary" : "secondary"}
                aria-pressed={state === value}
                onClick={() => changeParam("check", value)}
                className="px-4 text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
          {filterCount > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {fields
                .filter((field) => params.get(field))
                .map((field) => (
                  <span
                    key={field}
                    className="rounded-full bg-structure px-2 py-1 text-xs"
                  >
                    {params.get(field)}
                  </span>
                ))}
              <Button
                className="min-h-12 text-xs"
                onClick={() => {
                  const next = new URLSearchParams(params.toString());
                  fields.forEach((field) => next.delete(field));
                  window.history.replaceState(null, "", `/?${next}`);
                  setQuery("");
                }}
              >
                <Icon as={RotateCcw} className="h-4 w-4" />
                Clear filters
              </Button>
            </div>
          )}
          <div className="mb-4 flex flex-wrap justify-between gap-2 text-xs text-muted">
            <p role="status">{filtered.length} people in this view</p>
            <p>Sample matching policy · Review required before production</p>
          </div>
          <StateView
            state={sampleState}
            onRetry={() => setSampleState("normal")}
          >
            {filtered.length === 0 ? (
              <Empty
                title="No people in this view"
                description="Broaden your search or review customers who need information. Readiness checks still apply."
                action={
                  <Button
                    onClick={() => {
                      setQuery("");
                      const next = new URLSearchParams({
                        screen: "matches",
                        customer: a.ref,
                        check: "all",
                      });
                      window.history.replaceState(null, "", `/?${next}`);
                    }}
                  >
                    Show all customers
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-h-[calc(100dvh-256px)] lg:overflow-y-auto lg:overscroll-contain lg:pr-2">
                {filtered.map(({ customer, check }) => (
                  <article
                    key={customer.ref}
                    className="flex min-w-0 flex-col rounded-2xl border border-structure p-4 shadow-paper"
                  >
                    {customer.readiness === "ready" ? (
                      <Portrait customer={customer} />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-structure/50">
                        <Icon as={LockKeyhole} />
                        <span className="ml-2 text-muted">
                          Portfolio unavailable
                        </span>
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap items-start justify-between gap-2">
                      <h2 className="min-w-0 break-words font-display text-lg font-semibold">
                        {customer.name}
                      </h2>
                      <Badge state={check.state}>
                        {check.state === "ready"
                          ? "Ready to review"
                          : undefined}
                      </Badge>
                    </div>
                    {customer.readiness === "ready" && (
                      <>
                        <p className="mt-2 text-sm leading-tight">
                          {customer.age} years · {customer.profession}
                        </p>
                        <p className="mt-2 text-sm text-muted">
                          {customer.location}
                        </p>
                      </>
                    )}
                    <p className="mt-4 flex-1 text-xs leading-relaxed text-muted">
                      {check.reason}
                    </p>
                    <Button
                      href={screenLink("review", {
                        customer: a.ref,
                        candidate: customer.ref,
                      })}
                      variant={
                        check.state === "ready" ? "primary" : "secondary"
                      }
                      className="mt-4 w-full"
                    >
                      {check.state === "ready"
                        ? "Review pair"
                        : "Review checks"}
                      <Icon as={ArrowRight} />
                    </Button>
                  </article>
                ))}
              </div>
            )}
          </StateView>
        </div>
      </div>
    </>
  );
}

export function PairReview({
  a,
  b,
  role,
  visibleCustomers,
  introductions,
  openModal,
}) {
  const assessment = pairAssessment(a, b, introductions);
  const allowCreate = canCreate(role) && assessment.state === "ready";
  const nextCustomer = visibleCustomers.find(
    (customer) =>
      customer.ref !== a.ref &&
      customer.ref !== b.ref &&
      pairAssessment(a, customer, introductions).state === "ready",
  );
  const rows = [
    ["Age", `${a.age} years`, `${b.age} years`],
    ["Height", a.height, b.height],
    ["Marital status", a.marital, b.marital],
    ["Location", a.location, b.location],
    ["Diet", a.diet, b.diet],
    ["Gotra", a.gotra, b.gotra],
    ["Manglik", a.manglik, b.manglik],
    ["Community", a.community, b.community],
    ["Sub-caste", a.subCaste, b.subCaste],
    ["Residence / relocation", a.visa, b.visa],
  ];
  return (
    <>
      <BackLink href={screenLink("matches", { customer: a.ref })}>
        All potential customers
      </BackLink>
      <PageHeading
        eyebrow="Review the pair"
        title={`${a.name.split(" ")[0]} + ${b.name.split(" ")[0]}`}
        description="Keep both people in view. Check the facts and preferences before creating an Introduction."
      />
      <div className="sticky top-16 z-10 mb-4 flex items-center gap-2 rounded-xl border border-structure bg-app p-4 shadow-paper lg:hidden">
        <Portrait customer={a} compact />
        <div>
          <p className="text-xs text-muted">Matching for</p>
          <p className="font-medium">
            {a.name} · {a.age}
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-structure bg-app shadow-paper">
        <div className="grid grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-2">
          {[a, b].map((customer, index) => (
            <div
              key={customer.ref}
              className={`min-w-0 ${index === 0 ? "hidden lg:block" : ""}`}
            >
              <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4">
                {customer.readiness === "ready" ? (
                  <Portrait customer={customer} thumbnail />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-structure/50">
                    <Icon as={LockKeyhole} />
                  </div>
                )}
                <div>
                  <p className="mb-2 text-xs text-muted">
                    {index === 0 ? "Reference customer" : "Potential prospect"}
                  </p>
                  <h2 className="break-words font-display text-xl font-semibold">
                    {customer.name}
                  </h2>
                  {customer.readiness === "ready" && (
                    <p className="mt-2 text-sm text-muted">
                      {customer.profession}
                    </p>
                  )}
                  <div className="mt-2">
                    <Badge state={customer.readiness} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden items-center justify-center gap-4 border-y border-structure bg-structure/20 p-4 lg:flex">
          <span className="h-px flex-1 bg-structure" />
          <Button
            variant="primary"
            disabled={!allowCreate}
            onClick={(event) => openModal({ type: "create" }, event)}
          >
            <Icon as={HeartHandshake} />
            Create Introduction
          </Button>
          <span className="h-px flex-1 bg-structure" />
        </div>
        <div
          className={`m-4 flex items-start gap-4 rounded-xl p-4 sm:mx-6 ${assessment.state === "ready" ? "bg-sage/20" : assessment.state === "blocked" ? "bg-rose/25" : "bg-sand/25"}`}
          role="status"
        >
          <Icon as={assessment.state === "ready" ? Check : AlertCircle} />
          <div>
            <p className="font-medium">
              {assessment.state === "ready"
                ? "Ready for your review"
                : assessment.state === "blocked"
                  ? "This pair cannot be introduced"
                  : "Information needed before introducing"}
            </p>
            <p className="mt-2 text-sm leading-relaxed">{assessment.reason}</p>
            {!canCreate(role) && (
              <p className="mt-2 text-sm">
                Your role can review this pair. An Advisor or Admin creates the
                Introduction.
              </p>
            )}
          </div>
        </div>
        {a.readiness === "ready" && b.readiness === "ready" && (
          <>
            <div className="px-4 pb-6 sm:px-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">
                  Check the important facts
                </h2>
                <span className="text-xs text-muted">
                  Published v{a.version} / v{b.version}
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-structure">
                <div className="grid grid-cols-2 gap-4 bg-structure/30 px-4 py-4 text-sm font-medium">
                  <span>{a.name}</span>
                  <span>{b.name}</span>
                </div>
                {rows.map(([label, av, bv]) => {
                  const critical =
                    (label === "Gotra" && av === bv) ||
                    (label === "Manglik" &&
                      (av !== bv || av === "Not provided"));
                  return (
                    <div
                      key={label}
                      className={`grid grid-cols-2 gap-4 border-t border-structure p-4 ${critical ? "bg-sand/25" : ""}`}
                    >
                      {[av, bv].map((value, index) => (
                        <div key={index} className="min-w-0">
                          <p className="mb-1 text-xs text-muted">{label}</p>
                          <p className="break-words text-sm font-medium leading-tight">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-structure p-4 sm:p-6">
              <h2 className="mb-4 font-display text-lg font-semibold">
                Preferences go both ways
              </h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {[a, b].map((customer) => (
                  <div
                    key={customer.ref}
                    className="rounded-xl border border-structure p-4"
                  >
                    <p className="mb-2 text-sm font-medium">
                      {customer.name.split(" ")[0]} is looking for
                    </p>
                    <p className="text-sm leading-relaxed text-muted">
                      {customer.preferences}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Readiness does not mean every preference aligns. Discuss
                differences with the customer before proceeding.
              </p>
            </div>
            <div className="border-t border-structure p-4 sm:p-6">
              <h2 className="mb-4 font-display text-lg font-semibold">
                A little more about {b.name.split(" ")[0]}
              </h2>
              <ProfileSections customer={b} />
            </div>
          </>
        )}
        <div className="border-t border-structure p-4 sm:p-6">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <Icon as={LockKeyhole} className="h-4 w-4" />
            This review contains Broker Standard information only. Both
            customers’ published versions are pinned at creation.
          </p>
          <p className="mt-2 text-xs text-muted">
            Matching policy preview · Final checks must be enforced by the
            production server.
          </p>
        </div>
      </div>
      <div className="fixed inset-x-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-20 flex gap-2 rounded-xl border border-structure bg-app p-2 shadow-float lg:static lg:mt-6 lg:justify-end lg:border-0 lg:p-0 lg:shadow-none">
        {nextCustomer && (
          <Button
            href={screenLink("review", {
              customer: a.ref,
              candidate: nextCustomer.ref,
            })}
            className="min-w-0 flex-1 lg:flex-none"
            aria-label="Skip for now"
          >
            <span>Skip<span className="hidden min-[360px]:inline"> for now</span></span>
            <Icon as={ChevronRight} />
          </Button>
        )}
        <Button
          variant="primary"
          disabled={!allowCreate}
          onClick={(event) => openModal({ type: "create" }, event)}
          className="min-w-0 flex-1 lg:hidden"
        >
          Create Introduction
          <Icon as={HeartHandshake} className="hidden min-[360px]:block" />
        </Button>
      </div>
    </>
  );
}
