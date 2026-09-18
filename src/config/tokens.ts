import { TSLA_TOKEN, VOLT_TOKEN } from "./contracts";

export const VOLT = {
  symbol: "VOLT",
  name: "VOLT",
  decimals: 18,
  address: VOLT_TOKEN,
} as const;

/**
 * The reserve asset. Wording matters: this is a TSLA Stock Token on Robinhood
 * Chain — tokenized TSLA exposure — not a share of Tesla, Inc.
 */
export const TSLA = {
  symbol: "TSLA",
  name: "Tesla • Robinhood Token",
  shortName: "TSLA Stock Token",
  decimals: 18,
  address: TSLA_TOKEN,
} as const;

export const ETH = { symbol: "ETH", decimals: 18 } as const;
