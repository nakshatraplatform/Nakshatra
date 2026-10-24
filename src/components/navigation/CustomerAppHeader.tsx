"use client";

import { LoadingOrb } from "@/components/loading/LoadingStatus";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { Suspense, use, useEffect, useRef, useState } from "react";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import styles from "./CustomerAppHeader.module.css";

import type { AccountProfile } from "@/features/account/profile";

type CustomerPage = "dashboard" | "brokers" | "account";

const destinations = [
  { page: "dashboard", href: "/dashboard", label: "Dashboard" },
] as const;

export function CustomerAppHeader({ currentPage, userEmail, accountProfile }: { currentPage: CustomerPage; userEmail?: string; accountProfile?: Promise<AccountProfile> }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false;
  }

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(false);
    try {
      const { clearLocalAccountSession } = await import("@/features/account/client/account.api");
      await clearLocalAccountSession();
      router.push("/");
    } catch {
      setSignOutError(true);
      setSigningOut(false);
    }
  }

  function links(className: string) {
    return destinations.map(({ page, href, label }) => (
      <Link
        key={page}
        href={href}
        className={className}
        aria-current={currentPage === page ? "page" : undefined}
        onClick={closeMenu}
      >
        {label}
      </Link>
    ));
  }

  return (
    <header className={`${styles.header} dashboard-header`}>
      <div className={styles.inner}>
        <VivIntroBrand href="/dashboard" variant="horizontal" displayWidth={166} priority />
        <nav className={styles.desktopNav} aria-label="Customer pages">
          {links(styles.navLink)}
        </nav>
        <div className={styles.actions}>
          <ThemeSwitch />
          <details
            ref={menuRef}
            className={styles.accountMenu}
            onBlur={(event) => {
              // Safari touch can blur summary without focusing the tapped action.
              // Outside pointers still dismiss; keyboard focus leaving has a target.
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) closeMenu();
            }}
            onKeyDown={(event) => {
              const details = menuRef.current;
              if (!details) return;
              if (event.key === "Escape" && details.open) {
                event.preventDefault();
                event.stopPropagation();
                closeMenu();
                details.querySelector("summary")?.focus();
              }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                details.open = true;
                const items = Array.from(details.querySelectorAll<HTMLElement>("a, button:not(:disabled)"))
                  .filter(item => item.getClientRects().length > 0);
                const index = items.indexOf(document.activeElement as HTMLElement);
                const next = index < 0 ? (event.key === "ArrowDown" ? 0 : items.length - 1)
                  : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
                items[next]?.focus();
              }
            }}
          >
            <summary aria-label="Account menu">
              <Suspense fallback={<AccountIdentity userEmail={userEmail} />}><AccountIdentity profile={accountProfile} userEmail={userEmail} /></Suspense>
              <ChevronDown size={15} className={styles.chevron} aria-hidden="true" />
            </summary>
            <div className={styles.menuPanel}>
              <div className={styles.identity}>
                <Suspense fallback={<AccountIdentity userEmail={userEmail} expanded />}><AccountIdentity profile={accountProfile} userEmail={userEmail} expanded /></Suspense>
              </div>
              <nav className={styles.mobileNav} aria-label="Customer pages mobile">
                {links(styles.menuLink)}
              </nav>
              <Link href="/account" className={styles.menuLink} onClick={closeMenu} aria-current={currentPage === "account" ? "page" : undefined}>
                <Settings size={17} aria-hidden="true" /> Account settings
              </Link>
              <button type="button" aria-label="Sign out" aria-busy={signingOut} className={styles.menuSignOut} onClick={signOut} disabled={signingOut}>
                {signingOut ? <LoadingOrb size={20} /> : <LogOut size={17} aria-hidden="true" />} {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </details>
        </div>
      </div>
      {signOutError ? <p className={styles.error} role="alert">Could not sign out. Please try again.</p> : null}
    </header>
  );
}


/** Only this small identity region suspends; the account controls stay interactive. */
function AccountIdentity({ profile, userEmail, expanded = false }: {
  profile?: Promise<AccountProfile>; userEmail?: string; expanded?: boolean;
}) {
  const names = profile ? use(profile) : undefined;
  const parts = [names?.firstName.trim(), names?.lastName.trim()].filter(Boolean);
  const displayName = parts.join(" ") || userEmail || "Account";
  const initials = parts.map(part => Array.from(part!)[0]).join("").toLocaleUpperCase();
  return <>
    <span className={styles.avatar} aria-hidden="true">{initials || <UserRound size={20} />}</span>
    {expanded ? <div><strong>{displayName}</strong><p>{userEmail || "Signed in"}</p></div>
      : <span className={styles.triggerLabel} title={displayName}>{displayName}</span>}
  </>;
}
