"use client";

import Link from "next/link";
import { voltConfig } from "@/config/volt";
import { REWARDS_CONTRACT } from "@/config/contracts";

/**
 * WHY HOLD VOLT? Three honest lines. Nothing that is not live is presented
 * as live; holder rewards are stated as off until the flag and contract exist.
 */
export function UtilitySection() {
  const rewardsLive = voltConfig.holderRewardsEnabled && Boolean(REWARDS_CONTRACT);
  const points = [
    {
      n: "01",
      title: "PARTICIPATION",
      copy: "Holding VOLT is participation in the token economy whose trading fees build the reserve. That is the utility today.",
      status: "LIVE",
    },
    {
      n: "02",
      title: "VERIFICATION",
      copy: "Every charge and every purchase is on Robinhood Chain. The reserve wallet, the token and the TSLA contract are published below.",
      status: "LIVE",
    },
    {
      n: "03",
      title: "HOLDER REWARDS",
      copy: rewardsLive ? "TSLA rewards are distributed by the rewards contract. Claimable balances read live in the dashboard." : "Not enabled. VOLT does not distribute TSLA to holders today; if a rewards contract is deployed, it will appear in the dashboard.",
      status: rewardsLive ? "LIVE" : "NOT LIVE",
    },
  ];

  return (
    <section className="relative mx-auto max-w-[1440px] px-5 py-24 md:px-8 md:py-32">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div>
          <h2 className="display text-[clamp(40px,5.5vw,72px)]">WHY HOLD VOLT?</h2>
          <p className="lead mt-4">No invented benefits.</p>
          <Link href="/dashboard" className="btn btn-ghost mt-8 w-fit">
            YOUR POSITION
          </Link>
        </div>
        <ul className="flex flex-col">
          {points.map((p) => (
            <li key={p.n} className="grid grid-cols-[48px_1fr_auto] gap-4 border-t border-metal py-6 last:border-b">
              <span className="label pt-1">{p.n}</span>
              <div>
                <h3 className="display text-2xl">{p.title}</h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-silver">{p.copy}</p>
              </div>
              <span className={`chip h-6 self-start ${p.status === "LIVE" ? "chip-live" : ""}`}>{p.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
