# VOLT

**TRADE. CHARGE. BUILD TSLA.** — Every trade charges the reserve.

VOLT is a Robinhood Chain token ecosystem built around one loop:

```
trades → fees → the battery charges → 100 % → TSLA Stock Tokens are acquired for the reserve → the battery resets
```

The site is that loop rendered as hardware: a 3D industrial energy cell that fills with every fee, a purchase sequence when it reaches 100 %, and a storage rack that gains one module per completed cycle.

Two states, never mixed:

- **Pre-launch preview** (no token / reserve wallet configured): the loop runs as a simulation so the mechanism can be seen — trades, charge, purchases, reset — with real prices and no transaction hashes. The navbar badge says **PREVIEW**, the battery caption says PREVIEW, the reserve and activity pages say PRE-LAUNCH PREVIEW.
- **Live** (token + reserve wallet set): everything on screen is read from Robinhood Chain. The badge says **LIVE**.

> Not affiliated with Tesla, Inc. or Robinhood Markets, Inc. The reserve holds **TSLA Stock Tokens** (`Tesla • Robinhood Token`, a tokenized asset on Robinhood Chain) — not shares of Tesla, Inc.

## How it reads the chain

| Screen figure | Source |
| --- | --- |
| Battery charge | reserve wallet ETH + Pons escrow claimable + the creator's share (70 %) of unswept fees on the VOLT curve, valued at ETH/USD |
| Trades → `+$x TO BATTERY` | `CurveBuy` / `CurveSell` logs of the VOLT curve × the creator share read from the curve (`feeBps`, `protocolFeeShareBps`, `creatorTaxBps`) |
| Reserve purchases / cycles | every TSLA `Transfer` into the reserve wallet (real tx hashes; USD paid is never invented) |
| TSLA reserve value | TSLA balance × price (Pyth Hermes with a key → Yahoo Finance delayed → Pyth on-chain, each shown with its source and age) |
| Signature moment | a new TSLA inflow to the reserve plays FULL → +TSLA → RESERVE UPDATED → reset |

The site never buys anything. When the battery reaches its target it shows **PURCHASE ELIGIBLE · AWAITING EXECUTOR**; the authorized executor (published in VERIFY EVERYTHING when configured) performs the acquisition, and the chain confirms it.

## Configure

Copy `.env.example` to `.env.local`. Without a token and a reserve wallet the site runs the pre-launch preview.

- `NEXT_PUBLIC_VOLT_TOKEN` — the VOLT ERC-20 (a Pons V2 launch on Robinhood Chain; the curve is discovered from the token).
- `NEXT_PUBLIC_RESERVE_WALLET` — receives routed fees and holds the TSLA Stock Tokens.
- `NEXT_PUBLIC_RESERVE_START_BLOCK` — first block to scan for TSLA inflows (set it; scanning from genesis is slow).
- `NEXT_PUBLIC_EXECUTOR`, `NEXT_PUBLIC_ROUTING_CONTRACT` — optional, shown when set.
- `NEXT_PUBLIC_TARGET_CHARGE_USD` — the purchase threshold (default 1000).
- `NEXT_PUBLIC_HOLDER_REWARDS` + `NEXT_PUBLIC_REWARDS_CONTRACT` — holder rewards stay **NOT LIVE** unless both are set and the contract answers `claimable / totalDistributed / nextDistributionAt`.
- `PYTH_API_KEY` — server only; best price source. Without it the server uses Yahoo Finance (delayed), then Pyth on-chain (can be days old — shown as STALE).

Verified on chain (2026-09-18): TSLA token `0x322f0929c4625ed5bad873c95208d54e1c003b2d` (18 decimals), Pons V2 fee escrow `0xd3AF…Ac9e`, Pyth `0x8250…87a`.

## Run

```bash
npm install
npm run dev          # http://localhost:3629
npm run build
npm test             # state machine, cycle derivation, formatting, price staleness
npm run live-check   # every read against Robinhood Chain on real addresses
```

The browser reaches the chain through `/api/rpc` (a same-origin relay — the public RPC's rate-limit responses carry a malformed CORS header) and prices through `/api/price`. Deploy as a normal Next.js app (Vercel: import the repo, no settings).

## Verify the animations

Dev builds expose `window.__volt.qa` — `fill(pct)`, `fee(usd)`, `purchase()` — absent from production bundles.

```bash
node scripts/capture.mjs          # headless captures of every route → docs/captures
node scripts/tour.mjs             # scroll tour of the landing
node scripts/signature-strip.mjs  # the FULL → PURCHASING → CONFIRMED → RESET sequence as a contact sheet
node scripts/qa-shot.mjs 82       # the hero at a given charge
```

## Structure

```
src/app            routes: /, /reserve, /activity, /dashboard, /api/price, /api/rpc
src/components     battery (R3F cell + shader), reserve (R3F rack, cycles), activity, wallet, landing, ui
src/config         chains, contracts (validated addresses), tokens, volt
src/lib/blockchain readVolt · readFees · readBattery · readReserve · readRewards (all contract calls live here)
src/lib/pricing    provider chain: hermes → yahoo → pyth on-chain, with source + staleness
src/lib/battery    the state machine (charging → full → purchasing → confirmed → resetting)
src/lib/live       the chain sync that feeds the store (configured)
src/lib/preview    the pre-launch preview engine (unconfigured): same store, simulated trades, real prices
src/lib/store      one zustand store; the WebGL scenes read it per frame
src/types          BatteryState · ReserveState · ReservePurchase · ChargeCycle · ActivityItem · PriceQuote
```

## Before mainnet

- Launch VOLT on Pons V2 with the reserve wallet as `creatorFeeRecipient`; set the two addresses and the start block.
- Publish the executor address and the procedure it follows (claim escrow → acquire TSLA → transfer to the reserve).
- Get a Pyth Hermes key for sub-second prices, or accept the delayed source.
- Legal wording review: "TSLA Stock Token", no Tesla marks, no affiliation.
