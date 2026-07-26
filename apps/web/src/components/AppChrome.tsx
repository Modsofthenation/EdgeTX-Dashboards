"use client";

import Link from "next/link";
import styles from "./AppChrome.module.css";

export type AppSurface = "generate" | "layout";

interface AppChromeProps {
  surface: AppSurface;
  /** Optional subtitle under the product name (model · radio, widget meta, etc.) */
  subtitle?: React.ReactNode;
  /** Whether Layout nav should be enabled / highlighted as available */
  layoutHref?: string | null;
  layoutDisabledReason?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Shared product chrome: brand + primary surfaces (Generate | Layout).
 * Both chat and editor mount this so the app reads as one product.
 */
export function AppChrome({
  surface,
  subtitle,
  layoutHref,
  layoutDisabledReason,
  actions,
  children,
}: AppChromeProps) {
  const layoutActive = surface === "layout";
  const generateActive = surface === "generate";
  const layoutEnabled = Boolean(layoutHref);

  return (
    <>
      <header className={styles.chrome}>
        <div className={styles.brandBlock}>
          <Link
            href="/"
            className={styles.logo}
            aria-label="EdgeTX Dashboard Generator home"
          >
            ETX
          </Link>
          <div className={styles.brandCopy}>
            <p className={styles.product}>EdgeTX Dashboards</p>
            {subtitle ? (
              <div className={styles.subtitle}>{subtitle}</div>
            ) : null}
          </div>
        </div>

        <nav className={styles.nav} aria-label="Primary">
          <Link
            href="/"
            className={generateActive ? styles.navItemActive : styles.navItem}
            aria-current={generateActive ? "page" : undefined}
          >
            Generate
          </Link>
          {layoutEnabled ? (
            <Link
              href={layoutHref!}
              className={layoutActive ? styles.navItemActive : styles.navItem}
              aria-current={layoutActive ? "page" : undefined}
            >
              Layout
            </Link>
          ) : (
            <span
              className={styles.navItemDisabled}
              title={
                layoutDisabledReason ??
                "Open Layout to build or edit a dashboard"
              }
            >
              Layout
            </span>
          )}
        </nav>

        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      {children}
    </>
  );
}
