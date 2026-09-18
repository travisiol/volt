import assert from "node:assert/strict";
import { test } from "node:test";
import { nextPhase, runPurchaseSequence, SEQUENCE } from "@/lib/battery/machine";
import type { ReservePurchase } from "@/types/reserve";

test("phase transitions follow the loop and ignore out-of-order events", () => {
  assert.equal(nextPhase("charging", "charge_reached"), "full");
  assert.equal(nextPhase("charging", "purchase_confirmed"), "charging");
  assert.equal(nextPhase("full", "purchase_started"), "purchasing");
  assert.equal(nextPhase("full", "purchase_confirmed"), "confirmed");
  assert.equal(nextPhase("full", "charge_dropped"), "charging");
  assert.equal(nextPhase("purchasing", "purchase_failed"), "full");
  assert.equal(nextPhase("purchasing", "purchase_confirmed"), "confirmed");
  assert.equal(nextPhase("confirmed", "reset_done"), "resetting");
  assert.equal(nextPhase("resetting", "reset_done"), "charging");
});

test("the sequence plays full → purchasing → confirmed → resetting → charging and starts the next cycle", async () => {
  const phases: string[] = [];
  const activity: string[] = [];
  const purchases: ReservePurchase[] = [];
  let battery = { currentChargeUsd: 1000, targetChargeUsd: 1000, percentage: 100, currentCycle: 7, lastUpdated: 0, cycleStartedAt: null as number | null };
  const store = {
    phase: "charging" as const,
    battery,
    reserve: { reserveValueUsd: null, tslaTokenBalance: 0, totalCycles: 0, totalFeesRouted: null, lastPurchase: null, lastUpdated: 0 },
    setPhase: (p: string) => phases.push(p),
    flash: () => phases.push("flash"),
    pushActivity: (a: { title: string; value: string }) => activity.push(`${a.title} ${a.value}`),
    addPurchase: (p: ReservePurchase) => purchases.push(p),
    setReserve: () => {},
    setBattery: (patch: Partial<typeof battery>) => {
      battery = { ...battery, ...patch };
    },
  };
  const purchase: ReservePurchase = { id: "p7", cycle: 7, timestamp: 1, amountUsd: 1000, tslaAmount: 2.5, tslaPrice: 400, txHash: null, status: "confirmed" };
  const t0 = Date.now();
  await runPurchaseSequence(store as never, purchase);
  const took = Date.now() - t0;
  assert.deepEqual(phases, ["full", "flash", "purchasing", "confirmed", "resetting", "charging"]);
  assert.equal(purchases.length, 1);
  assert.equal(battery.currentCycle, 8);
  assert.equal(battery.currentChargeUsd, 0);
  assert.ok(activity.some((a) => a.startsWith("RESERVE PURCHASE +$1,000 TSLA")));
  assert.ok(activity.some((a) => a === "NEW CYCLE CYCLE #008 STARTED"));
  const expected = SEQUENCE.fullMs + SEQUENCE.purchasingMs + SEQUENCE.confirmedMs + SEQUENCE.resettingMs;
  assert.ok(took >= expected - 50 && took < expected + 1500, `took ${took}ms, expected ≈ ${expected}`);
});

test("skipPurchasing goes straight from full to confirmed (a purchase already on the chain)", async () => {
  const phases: string[] = [];
  const store = {
    phase: "charging",
    battery: { currentChargeUsd: 0, targetChargeUsd: 1000, percentage: 0, currentCycle: 1, lastUpdated: 0, cycleStartedAt: null },
    reserve: {},
    setPhase: (p: string) => phases.push(p),
    flash: () => {},
    pushActivity: () => {},
    addPurchase: () => {},
    setReserve: () => {},
    setBattery: () => {},
  };
  await runPurchaseSequence(store as never, { id: "x", cycle: 1, timestamp: 5, amountUsd: null, tslaAmount: 0.1, tslaPrice: null, txHash: "0xab", status: "confirmed" }, { skipPurchasing: true, nextCycleStartsAt: 5 });
  assert.deepEqual(phases, ["full", "confirmed", "resetting", "charging"]);
});
