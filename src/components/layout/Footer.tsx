import Link from "next/link";
import { VoltMark } from "@/components/brand/VoltMark";
import { voltConfig } from "@/config/volt";

export function Footer() {
  return (
    <footer className="relative z-[2] border-t border-metal">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 py-12 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <div className="flex items-center gap-3">
            <VoltMark size={30} className="text-ink" />
            <span className="display text-2xl">VOLT</span>
          </div>
          <p className="display-wide mt-4 text-[11px] tracking-[0.22em] text-silver">TRADE. CHARGE. BUILD.</p>
        </div>
        <nav className="flex flex-wrap gap-x-7 gap-y-3" aria-label="Footer">
          <Link href="/reserve" className="nav-link">
            Reserve
          </Link>
          <Link href="/activity" className="nav-link">
            Activity
          </Link>
          <Link href="/dashboard" className="nav-link">
            Dashboard
          </Link>
          <Link href="/#transparency" className="nav-link">
            Transparency
          </Link>
          {voltConfig.site.twitter ? (
            <a href={voltConfig.site.twitter} target="_blank" rel="noreferrer" className="nav-link">
              X
            </a>
          ) : null}
        </nav>
      </div>
      <div className="mx-auto max-w-[1440px] px-5 pb-10 md:px-8">
        <p className="max-w-3xl text-[11px] leading-relaxed text-muted">
          VOLT is an independent token project on Robinhood Chain. It is not affiliated with, endorsed by, or connected to Tesla, Inc. or Robinhood Markets, Inc. The reserve holds TSLA Stock Tokens — a tokenized asset on Robinhood Chain that
          tracks TSLA — not shares of Tesla, Inc. Nothing on this site is investment advice; token values can go to zero. Reserve purchases happen only when the battery reaches its target and an authorized executor acts; nothing is
          guaranteed.
        </p>
      </div>
    </footer>
  );
}
