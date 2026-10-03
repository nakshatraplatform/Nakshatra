"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import styles from "./CustomerAppHeader.module.css";

type CustomerPage = "dashboard" | "brokers" | "account";

const destinations = [
  { page: "dashboard", href: "/dashboard", label: "Dashboard" },
  { page: "brokers", href: "/brokers", label: "My brokers" },
  { page: "account", href: "/account", label: "Account" },
] as const;

export function CustomerAppHeader({ currentPage, userEmail }: { currentPage: CustomerPage; userEmail?: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        menuRef.current.open = false;
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
          <button type="button" className={styles.desktopSignOut} onClick={signOut} disabled={signingOut}>
            <LogOut size={17} aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
          </button>
          <details
            ref={menuRef}
            className={styles.mobileMenu}
            onKeyDown={(event) => {
              if (event.key === "Escape" && menuRef.current?.open) {
                menuRef.current.open = false;
                menuRef.current.querySelector("summary")?.focus();
              }
            }}
          >
            <summary aria-label="Menu"><Menu size={19} aria-hidden="true" /><span>Menu</span></summary>
            <div className={styles.menuPanel}>
              {userEmail ? <p className={styles.accountEmail}>{userEmail}</p> : null}
              <nav aria-label="Customer pages mobile">
                {links(styles.menuLink)}
              </nav>
              <button type="button" className={styles.menuSignOut} onClick={signOut} disabled={signingOut}>
                <LogOut size={17} aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </details>
        </div>
      </div>
      {signOutError ? <p className={styles.error} role="alert">Could not sign out. Please try again.</p> : null}
    </header>
  );
}
