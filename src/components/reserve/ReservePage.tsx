"use client";

import { ExternalLink } from "lucide-react";
import { ReserveValueChart } from "@/components/charts/ReserveValueChart";
import { CycleList } from "@/components/reserve/CycleList";
import { Streak } from "@/components/reserve/Streak";
import { Num } from "@/components/ui/Num";
import { StateNotice } from "@/components/ui/StateNotice";
import { refreshLive } from "@/components/VoltRuntime";
import { explorer } from "@/config/chains";
import { fmtAgo, fmtAmount, fmtClock, fmtCycle, fmtDate, fmtEth, fmtInt, fmtUsd, shortHash } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { reserveSeries } from "@/lib/reserve/cycles";
import { remainingUsd, useVolt } from "@/lib/store/volt";

/** /reserve — VOLT RESERVE: every figure the reserve can honestly report. */
export function ReservePage() {
  const reserve = useVolt((s) => s.reserve);
  const battery = useVolt((s) => s.battery);
  const purchases = useVolt((s) => s.purchases);
  const prices = useVolt((s) => s.prices);
  const status = useVolt((s) => s.status);
  const source = useVolt((s) => s.source);
  const error = useVolt((s) => s.error);
  const feeData = useVolt((s) => s.feeData);
  const now = useNow();
  const series = reserveSeries(purchases, prices.TSLA?.price ?? null);
  const last = reserve.lastPurchase;

  const metrics = [
    { label: "TOTAL RESERVE VALUE", value: reserve.reserveValueUsd != null ? <Num value={reserve.reserveValueUsd} format={(v) => fmtUsd(v)} rate={4} /> : "—", note: prices.TSLA ? `TSLA ${fmtUsd(prices.TSLA.price)} · ${prices.TSLA.sourceLabel}` : "no price source" },
    { label: "TSLA TOKEN BALANCE", value: <Num value={reserve.tslaTokenBalance} format={(v) => `${fmtAmount(v, 4)}`} rate={4} />, note: "TSLA Stock Token" },
    { label: "TOTAL COMPLETED CYCLES", value: fmtInt(reserve.totalCycles), note: `cycle ${fmtCycle(battery.currentCycle)} in progress` },
    { label: "CURRENT BATTERY CHARGE", value: <Num value={battery.percentage} format={(v) => `${v.toFixed(1)}%`} />, note: `${fmtUsd(battery.currentChargeUsd)} / ${fmtUsd(battery.targetChargeUsd, 0)}${battery.chargeEth != null ? ` · ${fmtEth(battery.chargeEth)}` : ""}` },
    { label: "TOTAL FEES ROUTED", value: reserve.totalFeesRouted != null ? fmtUsd(reserve.totalFeesRouted) : "not reported", note: reserve.totalFeesRouted != null ? "into the battery, all cycles" : "the chain does not report what was paid" },
    { label: "LAST ACQUISITION", value: last ? (last.amountUsd != null ? `+${fmtUsd(last.amountUsd, 0)}` : `+${fmtAmount(last.tslaAmount, 4)} TSLA`) : "—", note: last && now ? fmtAgo(last.timestamp, now) : "no purchase yet" },
    { label: "NEXT TARGET", value: fmtUsd(battery.targetChargeUsd, 0), note: `${fmtUsd(remainingUsd(battery))} remaining` },
  ];

  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-28 pb-24 md:px-8 md:pt-36">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="display text-[clamp(44px,6vw,88px)]">VOLT RESERVE</h1>
          <p className="lead mt-3">Built one charge at a time.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`chip ${source === "chain" ? "chip-live" : ""}`}>{source === "chain" ? "ON-CHAIN" : "PRE-LAUNCH PREVIEW"}</span>
          <span className="mono text-[11px] text-muted">{reserve.lastUpdated && now ? `updated ${fmtAgo(reserve.lastUpdated, now)}` : "—"}</span>
        </div>
      </div>

      {status === "error" ? <StateNotice className="mt-8" kind="error" title="RESERVE DATA UNAVAILABLE" body={error ?? "Unable to retrieve the reserve state."} onRetry={refreshLive} /> : null}
      {status === "stale" ? <StateNotice className="mt-8" kind="stale" title="PRICE FEED DELAYED" body={error ?? undefined} onRetry={refreshLive} /> : null}
      {status === "syncing" ? <StateNotice className="mt-8" kind="syncing" title="BATTERY SYNCING" body="Waiting for the latest block." /> : null}
      {status === "unconfigured" ? <StateNotice className="mt-8" kind="empty" title="AWAITING LAUNCH" body="Set NEXT_PUBLIC_VOLT_TOKEN and NEXT_PUBLIC_RESERVE_WALLET; the reserve is then read from Robinhood Chain." /> : null}

      <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-metal bg-metal md:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="metal-hover bg-void-2 p-5 md:p-6">
            <dt className="label text-[10px]">{m.label}</dt>
            <dd className="num mt-3 text-[clamp(22px,2.4vw,34px)] leading-none">{m.value}</dd>
            <dd className="mono mt-2 truncate text-[10px] text-muted">{m.note}</dd>
          </div>
        ))}
        <div className="bg-void-2 p-5 md:p-6">
          <Streak compact />
        </div>
      </dl>

      <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div className="panel p-5 md:p-6">
          <ReserveValueChart points={series} />
          {series.some((p) => p.usd == null) ? <p className="mono mt-4 text-[10px] text-muted">The chain records the TSLA amount, not the price paid; the chart shows the TSLA balance, valued at the current price.</p> : null}
        </div>
        <div>
          <CycleList />
          {feeData ? (
            <p className="mono mt-4 text-[10px] text-muted">
              Fee path: {(feeData.toBatteryBps / 100).toFixed(2)}% of every trade reaches the battery
              {feeData.claimableEth != null ? ` · ${fmtEth(feeData.claimableEth)} claimable in escrow` : ""}.
            </p>
          ) : null}
        </div>
      </div>

      <section className="mt-20">
        <h2 className="display text-3xl md:text-4xl">RESERVE ACTIVITY</h2>
        <ol className="mt-6 border-t border-metal">
          {purchases.length === 0 ? <li className="mono py-8 text-center text-[12px] text-muted">No reserve purchases yet.</li> : null}
          {purchases.map((p) => (
            <li key={p.id} className="metal-hover grid grid-cols-1 gap-3 border-b border-metal py-5 md:grid-cols-[110px_140px_1fr_1fr_1fr_110px] md:items-center md:gap-6">
              <div className="mono text-[12px] text-silver">
                {fmtClock(p.timestamp)}
                <span className="block text-[10px] text-muted">{fmtDate(p.timestamp)}</span>
              </div>
              <div className="display-wide text-[12px] tracking-[0.16em]">BATTERY {fmtCycle(p.cycle)}</div>
              <div className="num text-xl text-volt-hot">{p.amountUsd != null ? `+${fmtUsd(p.amountUsd)} TSLA` : `+${fmtAmount(p.tslaAmount, 4)} TSLA`}</div>
              <div className="mono text-[12px]">
                <span className="label text-[9px]">TX</span>
                <span className="block">
                  {p.txHash ? (
                    <a href={explorer.tx(p.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-ink hover:text-volt-hot">
                      {shortHash(p.txHash)} <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="text-muted">{source === "preview" ? "preview" : "—"}</span>
                  )}
                </span>
              </div>
              <div className="mono text-[12px]">
                <span className="label text-[9px]">TSLA PRICE</span>
                <span className="block text-silver">{p.tslaPrice != null ? fmtUsd(p.tslaPrice) : "not reported"}</span>
              </div>
              <div className="mono text-[12px]">
                <span className="label text-[9px]">STATUS</span>
                <span className={`block ${p.status === "confirmed" ? "text-ink" : p.status === "failed" ? "text-volt-hot" : "text-silver"}`}>{p.status.toUpperCase()}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
