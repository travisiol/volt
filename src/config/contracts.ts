import { getAddress, isAddress, type Address, type Hex } from "viem";

/**
 * Every address VOLT touches, in one place, all from the environment.
 *
 * VERIFIED values were read from Robinhood Chain (chain id 4663) through the
 * public RPC on 2026-09-18. CONFIGURE values are empty until the token is
 * launched and the reserve wallet exists — the UI says so wherever they matter
 * and the site says NOT CONFIGURED until they are set.
 */

export interface ConfigIssue {
  key: string;
  message: string;
}

export const configIssues: ConfigIssue[] = [];

function parseAddress(key: string, raw: string | undefined, fallback?: Address): Address | null {
  const value = raw?.trim();
  if (!value) return fallback ?? null;
  if (!isAddress(value)) {
    configIssues.push({ key, message: `${key} is not a valid address (${value.slice(0, 12)}...)` });
    return fallback ?? null;
  }
  return getAddress(value);
}

/** CONFIGURE — the VOLT ERC-20. A Pons V2 launch on Robinhood Chain is the assumed venue. */
export const VOLT_TOKEN = parseAddress("NEXT_PUBLIC_VOLT_TOKEN", process.env.NEXT_PUBLIC_VOLT_TOKEN);

/** CONFIGURE — where routed fees land and where the TSLA Stock Tokens are held. */
export const RESERVE_WALLET = parseAddress("NEXT_PUBLIC_RESERVE_WALLET", process.env.NEXT_PUBLIC_RESERVE_WALLET);

/** CONFIGURE (optional) — the account authorized to execute purchases once the battery is full. */
export const EXECUTOR = parseAddress("NEXT_PUBLIC_EXECUTOR", process.env.NEXT_PUBLIC_EXECUTOR);

/** CONFIGURE (optional) — an on-chain router/splitter in front of the reserve, if one is deployed. */
export const ROUTING_CONTRACT = parseAddress("NEXT_PUBLIC_ROUTING_CONTRACT", process.env.NEXT_PUBLIC_ROUTING_CONTRACT);

/** CONFIGURE (optional) — a rewards contract; only read when holder rewards are enabled. */
export const REWARDS_CONTRACT = parseAddress("NEXT_PUBLIC_REWARDS_CONTRACT", process.env.NEXT_PUBLIC_REWARDS_CONTRACT);

/**
 * VERIFIED — "Tesla • Robinhood Token", symbol TSLA, 18 decimals.
 * Read through name()/symbol()/decimals() on 2026-09-18 (block 66 312 986).
 */
export const TSLA_TOKEN = parseAddress("NEXT_PUBLIC_TSLA_TOKEN", process.env.NEXT_PUBLIC_TSLA_TOKEN, "0x322f0929c4625ed5bad873c95208d54e1c003b2d") as Address;

/** VERIFIED — Pons V2 factory and its fee escrow (factory.feeEscrow()), where swept creator fees wait to be claimed. */
export const PONS = {
  factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as Address,
  feeEscrow: parseAddress("NEXT_PUBLIC_PONS_ESCROW", process.env.NEXT_PUBLIC_PONS_ESCROW, "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e") as Address,
  appUrl: (process.env.NEXT_PUBLIC_PONS_APP_URL?.trim() || "https://www.ponsfamily.com").replace(/\/$/, ""),
} as const;

/**
 * VERIFIED — Pyth on Robinhood Chain (ERC1967 proxy, v1.4.5). Only BTC/ETH have
 * ever been pushed on-chain, and the ETH print was 14 days old on 2026-09-18:
 * the on-chain read is a last resort, always shown with its age.
 */
export const PYTH = {
  address: "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a" as Address,
  feeds: {
    /** Crypto.ETH/USD */
    ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" as Hex,
    /** Equity.Index.TSLA/USD — "Pyth price in USD for TSLA 24/7". */
    TSLA: "0xe6da44bff5b8b06897a3739dd331b440d6662595bb862e37046892c568ae3fc0" as Hex,
    /** Equity.US.TSLA/USD — market hours only. */
    TSLA_MARKET: "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1" as Hex,
  },
} as const;

/** CONFIGURE — WalletConnect Cloud project id; without it only injected wallets are offered. */
export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || "";

/** Everything LIVE mode needs before it can be honest. */
export const liveConfigured = Boolean(VOLT_TOKEN && RESERVE_WALLET);
