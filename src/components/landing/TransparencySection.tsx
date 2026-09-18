"use client";

import { AddressRow } from "@/components/ui/AddressRow";
import { EXECUTOR, PONS, RESERVE_WALLET, ROUTING_CONTRACT, TSLA_TOKEN, VOLT_TOKEN } from "@/config/contracts";
import { CHAIN_ID, RPC_URL } from "@/config/chains";
import { fmtEth } from "@/lib/format";
import { useVolt } from "@/lib/store/volt";

/**
 * VERIFY EVERYTHING. The addresses the system runs on, and the split a
 * trade actually goes through — read from the curve in LIVE mode. Unset
 * addresses say NOT CONFIGURED; nothing is invented to fill a row.
 */
export function TransparencySection() {
  const feeData = useVolt((s) => s.feeData);
  const source = useVolt((s) => s.source);
  const volt = useVolt((s) => s.volt);
  const prices = useVolt((s) => s.prices);

  const protocolShare = feeData ? feeData.feeBps * (feeData.protocolShareBps / 10_000) : null;

  return (
    <section id="transparency" className="relative mx-auto max-w-[1440px] px-5 py-24 md:px-8 md:py-32">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <h2 className="display text-[clamp(40px,5.5vw,72px)]">VERIFY EVERYTHING.</h2>
        <p className="label">ROBINHOOD CHAIN · ID {CHAIN_ID}</p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div>
          <div className="border-b border-metal">
            <AddressRow label="RESERVE WALLET" address={RESERVE_WALLET} note="Receives routed fees, holds the TSLA Stock Tokens." tag={RESERVE_WALLET ? undefined : "CONFIGURE"} />
            <AddressRow label="VOLT CONTRACT" address={VOLT_TOKEN} token note={volt?.curve ? "Pons V2 launch — bonding curve below." : "The VOLT ERC-20."} tag={VOLT_TOKEN ? undefined : "CONFIGURE"} />
            {volt?.curve ? <AddressRow label="VOLT CURVE" address={volt.curve} note="Where trades happen and fees accrue before they are swept." /> : null}
            <AddressRow label="TSLA TOKEN CONTRACT" address={TSLA_TOKEN} token note="Tesla • Robinhood Token — the reserve asset." tag="VERIFIED" />
            <AddressRow label="ROUTING CONTRACT" address={ROUTING_CONTRACT} note={ROUTING_CONTRACT ? "On-chain router in front of the reserve." : "No router deployed: fees reach the reserve wallet directly."} />
            <AddressRow label="AUTHORIZED EXECUTOR" address={EXECUTOR} note={EXECUTOR ? "Executes the TSLA purchase once the battery is full." : "Executor not published yet."} />
            <AddressRow label="FEE ESCROW" address={PONS.feeEscrow} note="Pons V2 escrow: swept creator fees waiting to be claimed by the reserve." tag="VERIFIED" />
          </div>
          <p className="mono mt-4 text-[11px] text-muted">
            RPC {RPC_URL} · Price source{" "}
            {prices.TSLA ? (
              <span className="text-silver">
                {prices.TSLA.sourceLabel}
                {prices.ETH && prices.ETH.source !== prices.TSLA.source ? ` / ${prices.ETH.sourceLabel}` : ""}
              </span>
            ) : (
              "—"
            )}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="panel p-6">
            <div className="label">ALLOCATION</div>
            <p className="mt-3 text-sm leading-relaxed text-silver">Everything that enters the battery is spent on one thing.</p>
            <Bar label="TSLA RESERVE" pct={100} accent />
            <p className="mono mt-4 text-[11px] text-muted">100% of battery charge → TSLA Stock Token purchases. No other destination is implemented.</p>
          </div>

          <div className="panel p-6">
            <div className="label">FEE PATH PER TRADE · {source === "chain" ? "READ FROM THE CURVE" : "STANDARD PONS V2 SPLIT"}</div>
            {feeData ? (
              <>
                <Bar label="→ BATTERY (creator share)" pct={(feeData.toBatteryBps / feeData.feeBps) * 100 || 0} value={`${(feeData.toBatteryBps / 100).toFixed(2)}%`} accent />
                <Bar label="→ VENUE PROTOCOL" pct={protocolShare != null && feeData.feeBps ? (protocolShare / feeData.feeBps) * 100 : 0} value={protocolShare != null ? `${(protocolShare / 100).toFixed(2)}%` : "—"} />
                <dl className="mono mt-5 grid grid-cols-2 gap-3 text-[11px] text-muted">
                  <div>
                    <dt>BASE FEE</dt>
                    <dd className="text-silver">{(feeData.feeBps / 100).toFixed(2)}%</dd>
                  </div>
                  <div>
                    <dt>CREATOR TAX</dt>
                    <dd className="text-silver">{(feeData.creatorTaxBps / 100).toFixed(2)}%</dd>
                  </div>
                  <div>
                    <dt>ACCRUING ON CURVE</dt>
                    <dd className="text-silver">{feeData.accruingOnCurveEth != null ? fmtEth(feeData.accruingOnCurveEth * ((10_000 - feeData.protocolShareBps) / 10_000)) : "—"}</dd>
                  </div>
                  <div>
                    <dt>CLAIMABLE IN ESCROW</dt>
                    <dd className="text-silver">{feeData.claimableEth != null ? fmtEth(feeData.claimableEth) : "—"}</dd>
                  </div>
                </dl>

              </>
            ) : (
              <p className="mono mt-3 text-[12px] text-muted">Read from the VOLT curve once the token is configured.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Bar({ label, pct, value, accent }: { label: string; pct: number; value?: string; accent?: boolean }) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <span className="mono text-[11px] text-silver">{label}</span>
        <span className="mono text-[11px] text-ink">{value ?? `${pct.toFixed(0)}%`}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-metal">
        <div className={`h-full ${accent ? "bg-volt" : "bg-silver/60"}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}
