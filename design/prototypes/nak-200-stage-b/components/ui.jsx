"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Check,
  X,
  UserRound,
  ArrowRight,
  AlertCircle,
  Search,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

export const control =
  "min-h-12 rounded-lg border border-navy/60 bg-app px-4 py-2 text-sm text-navy focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50";
const buttonStyles = {
  primary: "border-navy bg-navy text-app hover:bg-navy/90",
  secondary: "border-navy/60 bg-app text-navy hover:bg-structure/50",
  rose: "border-rose bg-rose text-navy hover:bg-rose/80",
  sage: "border-sage bg-sage text-navy hover:bg-sage/80",
};

export function Button({
  children,
  variant = "secondary",
  href,
  className = "",
  ...props
}) {
  const classes = `inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-150 focus-visible:transition-none motion-reduce:transition-none motion-safe:not-focus-visible:active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`;
  return href ? (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  ) : (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}

export function Icon({ as: Component, className = "", ...props }) {
  return (
    <Component
      size={20}
      strokeWidth={1.5}
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      {...props}
    />
  );
}

const tones = {
  ready: "bg-sage text-navy",
  mutual: "bg-sage text-navy",
  interested: "bg-sage text-navy",
  waiting: "bg-sand text-navy",
  missing: "bg-sand text-navy",
  invited: "bg-sand text-navy",
  created: "bg-sand text-navy",
  shared: "bg-sand text-navy",
  paused: "bg-rose text-navy",
  blocked: "bg-rose text-navy",
  declined: "bg-rose text-navy",
  revoked: "bg-rose text-navy",
  neutral: "bg-structure text-navy",
  expired: "bg-structure text-navy",
};
export const labels = {
  ready: "Ready",
  mutual: "Mutual interest",
  interested: "Interested",
  waiting: "Waiting",
  missing: "Needs information",
  invited: "Invited",
  created: "Created",
  shared: "Awaiting responses",
  paused: "Paused",
  blocked: "Cannot introduce",
  declined: "Declined",
  revoked: "Revoked",
  expired: "Expired",
};

export function Badge({ state = "neutral", children }) {
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium leading-tight ${tones[state] || tones.neutral}`}
    >
      {state === "ready" || state === "mutual" ? (
        <Check size={12} strokeWidth={1.5} aria-hidden="true" />
      ) : null}
      {children || labels[state]}
    </span>
  );
}

const photoTone = {
  sage: "bg-sage/35",
  sand: "bg-sand/35",
  rose: "bg-rose/35",
  structure: "bg-structure/60",
};
export function Portrait({ customer, compact = false, thumbnail = false }) {
  return (
    <div
      role="img"
      aria-label={`Photo placeholder for ${customer.name}`}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${photoTone[customer.tone]} ${compact ? "h-12 w-12 rounded-full" : thumbnail ? "h-24 w-24 rounded-xl" : "aspect-[4/3] w-full rounded-xl"}`}
    >
      <UserRound
        strokeWidth={1.5}
        className={compact ? "h-6 w-6 text-navy/60" : thumbnail ? "h-12 w-12 text-navy/35" : "h-24 w-24 text-navy/35"}
        aria-hidden="true"
      />
      {!compact && !thumbnail && (
        <>
          <span className="absolute left-4 top-4 font-display text-lg font-medium text-navy/70">
            {customer.initial}
          </span>
          <span className="absolute bottom-4 left-4 rounded-full bg-app/90 px-2 py-1 text-xs text-muted">
            Sample photo
          </span>
        </>
      )}
    </div>
  );
}

export function Panel({ children, className = "", ...props }) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-structure bg-app p-4 shadow-paper sm:p-6 ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}

export function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
          {eyebrow}
        </p>
        <h1
          tabIndex={-1}
          id="page-title"
          className="scroll-mt-24 font-display text-2xl font-semibold leading-tight tracking-tight text-balance outline-none focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-4 sm:text-3xl"
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
  returnFocusRef,
  animate = false,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-navy/25" />
        <Dialog.Content
          onCloseAutoFocus={
            returnFocusRef
              ? (event) => {
                  event.preventDefault();
                if (returnFocusRef.current?.isConnected && !returnFocusRef.current.disabled)
                    returnFocusRef.current.focus();
                  else
                    document
                      .getElementById("page-title")
                      ?.focus({ preventScroll: true });
                }
              : undefined
          }
          className={`fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-structure bg-app p-6 font-body text-navy shadow-float outline-none motion-reduce:animate-none ${animate ? "data-[state=open]:animate-enter" : ""} ${wide ? "max-w-3xl" : "max-w-lg"}`}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-xl font-semibold leading-tight">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-structure hover:bg-structure/50"
              aria-label="Close dialog"
            >
              <Icon as={X} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Toast({ message, onDismiss }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!message || paused) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [message, paused, onDismiss]);
  return (
    <div aria-live="polite" aria-atomic="true">
      {message && (
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="fixed left-4 right-4 top-24 z-60 flex items-center gap-4 rounded-xl border border-sage bg-sage p-4 text-navy shadow-float animate-enter motion-reduce:animate-none lg:bottom-8 lg:left-auto lg:top-auto lg:w-96"
        >
          <Icon as={Check} />
          <p className="flex-1 text-sm font-medium">{message}</p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg hover:bg-app/30"
          >
            <Icon as={X} />
          </button>
        </div>
      )}
    </div>
  );
}

export function StateView({ state, onRetry, children, empty }) {
  if (state === "loading")
    return (
      <div role="status" aria-busy="true">
        <p className="mb-4 text-muted">Loading customer profiles…</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="rounded-2xl border border-structure p-4">
              <div className="aspect-[4/3] rounded-xl bg-structure motion-safe:animate-pulse" />
              <div className="mt-4 h-4 w-2/3 rounded bg-structure" />
              <div className="mt-2 h-4 w-1/2 rounded bg-structure" />
              <div className="mt-4 h-12 rounded-lg bg-structure" />
            </div>
          ))}
        </div>
      </div>
    );
  if (state === "error")
    return (
      <Panel>
        <div className="flex items-start gap-4">
          <Icon as={AlertCircle} className="text-navy" />
          <div>
            <h2 className="font-display text-lg font-semibold">
              We couldn’t load this view
            </h2>
            <p className="mt-2 text-muted">
              Your work is still here. Try loading the profiles again.
            </p>
            <Button onClick={onRetry} className="mt-4">
              Try again
            </Button>
          </div>
        </div>
      </Panel>
    );
  if (state === "empty")
    return (
      empty || (
        <Empty
          title="Your customer book starts here"
          description="Invite a customer to connect their VivIntro portfolio with your agency."
          action={<Button href="/?screen=customers">Open customer book</Button>}
        />
      )
    );
  return children;
}

export function Empty({
  title = "No customers in this view",
  description = "Try removing a filter or searching for another name.",
  action,
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-structure px-6 py-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-structure/60">
        <Icon as={Search} />
      </div>
      <h2 className="font-display text-xl font-semibold text-balance">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function BackLink({ href, children }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex min-h-12 items-center gap-2 rounded-lg text-sm font-medium hover:underline"
    >
      <Icon as={ArrowLeft} />
      {children}
    </Link>
  );
}
export function ForwardIcon() {
  return <Icon as={ArrowRight} />;
}
