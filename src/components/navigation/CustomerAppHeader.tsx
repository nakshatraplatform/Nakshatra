"use client";

import { LoadingOrb } from "@/components/loading/LoadingStatus";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import styles from "./CustomerAppHeader.module.css";

type CustomerPage = "dashboard" | "brokers" | "account";

const destinations = [
  { page: "dashboard", href: "/dashboard", label: "Dashboard" },
  { page: "brokers", href: "/brokers", label: "My brokers" },
] as const;

export function CustomerAppHeader({ currentPage, userEmail }: { currentPage: CustomerPage; userEmail?: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const initials = userEmail?.trim().slice(0, 2).toUpperCase();

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
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeMenu();
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
              <span className={styles.avatar} aria-hidden="true">{initials || <UserRound size={20} />}</span>
              <span className={styles.triggerLabel}>Your account</span>
              <ChevronDown size={15} className={styles.chevron} aria-hidden="true" />
            </summary>
            <div className={styles.menuPanel}>
              <div className={styles.identity}>
                <span className={styles.avatar} aria-hidden="true">{initials || <UserRound size={20} />}</span>
                <div><strong>Your account</strong><p>{userEmail || "Signed in"}</p></div>
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
