import { PONS, VOLT_TOKEN, liveConfigured } from "./contracts";

const num = (raw: string | undefined, fallback: number) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const voltConfig = {
  site: {
    name: "VOLT",
    tagline: "TRADE. CHARGE. BUILD TSLA.",
    line: "Every trade charges the reserve.",
    url: (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://volt.example").replace(/\/$/, ""),
    twitter: process.env.NEXT_PUBLIC_TWITTER_URL?.trim() || "",
  },
  /** True once a VOLT token and a reserve wallet are configured — the site reads the chain from then on. */
  configured: liveConfigured,
  /** The charge level, in USD, at which a purchase becomes eligible. */
  targetChargeUsd: num(process.env.NEXT_PUBLIC_TARGET_CHARGE_USD, 1000),
  /** Feature flag: never claim holders receive TSLA unless this is on AND a rewards contract answers. */
  holderRewardsEnabled: process.env.NEXT_PUBLIC_HOLDER_REWARDS === "true",
  /** Where TRADE VOLT goes. Defaults to the Pons page of the token; null until a token exists. */
  tradeUrl: process.env.NEXT_PUBLIC_TRADE_URL?.trim() || (VOLT_TOKEN ? `${PONS.appUrl}/launchpad/${VOLT_TOKEN}` : null),
  /** First block worth scanning for reserve inflows. 0 means from genesis (slow) — set it once the reserve exists. */
  reserveStartBlock: BigInt(process.env.NEXT_PUBLIC_RESERVE_START_BLOCK?.trim() || "0"),
  polling: {
    batteryMs: 8_000,
    reserveMs: 15_000,
    purchasesMs: 20_000,
    tradesMs: 6_000,
    priceMs: 45_000,
  },
  /** Reads older than this are shown as STALE. */
  staleAfterMs: 60_000,
  /** The pre-launch preview: runs only while no token / reserve wallet is configured. */
  preview: {
    seed: 24,
    /** Cycle in progress when the preview starts. */
    startCycle: 24,
    startChargeUsd: 821.42,
    /** Used only if the price layer does not answer. */
    fallbackTslaPrice: 362.4,
    fallbackEthPrice: 2593,
    /** Milliseconds between simulated trades. */
    tradeGapMs: [2_400, 8_500] as [number, number],
  },
} as const;
