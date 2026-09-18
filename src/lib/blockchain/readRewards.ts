import { formatUnits, type Address } from "viem";
import { rewardsAbi } from "./abis";
import { publicClient } from "./client";

export interface RewardsSnapshot {
  claimableTsla: number;
  totalDistributedTsla: number;
  /** Epoch ms, or null when the contract reports 0. */
  nextDistributionAt: number | null;
}

/**
 * Holder rewards, only ever read when the feature flag is on and a contract
 * is configured. If any call fails the dashboard shows nothing — no claim
 * is ever made from defaults.
 */
export async function getRewards(contract: Address, account: Address, decimals = 18): Promise<RewardsSnapshot> {
  const client = publicClient();
  const [claimable, total, next] = await Promise.all([
    client.readContract({ address: contract, abi: rewardsAbi, functionName: "claimable", args: [account] }),
    client.readContract({ address: contract, abi: rewardsAbi, functionName: "totalDistributed" }),
    client.readContract({ address: contract, abi: rewardsAbi, functionName: "nextDistributionAt" }),
  ]);
  return {
    claimableTsla: Number(formatUnits(claimable, decimals)),
    totalDistributedTsla: Number(formatUnits(total, decimals)),
    nextDistributionAt: next > 0n ? Number(next) * 1000 : null,
  };
}
