import { formatEther, type Address } from "viem";
import { PONS } from "@/config/contracts";
import type { FeeData } from "@/types/reserve";
import { ponsCurveAbi, ponsEscrowAbi } from "./abis";
import { publicClient } from "./client";

/**
 * How trades are taxed and where the money is right now, straight from the
 * curve. `toBatteryBps` is the share of every trade that reaches the reserve:
 * the creator's cut of the base fee plus the creator tax, if any.
 */
export async function getFeeData(curve: Address, reserveWallet: Address | null): Promise<FeeData> {
  const client = publicClient();
  const [feeBps, creatorTaxBps, protocolShareBps, quoteFeeBalance] = await Promise.all([
    client.readContract({ address: curve, abi: ponsCurveAbi, functionName: "feeBps" }),
    client.readContract({ address: curve, abi: ponsCurveAbi, functionName: "creatorTaxBps" }),
    client.readContract({ address: curve, abi: ponsCurveAbi, functionName: "protocolFeeShareBps" }),
    client.readContract({ address: curve, abi: ponsCurveAbi, functionName: "quoteFeeBalance" }),
  ]);
  let claimableEth: number | null = null;
  if (reserveWallet) {
    try {
      const c = await client.readContract({ address: PONS.feeEscrow, abi: ponsEscrowAbi, functionName: "balanceOf", args: [reserveWallet] });
      claimableEth = Number(formatEther(c));
    } catch {
      claimableEth = null;
    }
  }
  const fee = Number(feeBps);
  const protocol = Number(protocolShareBps);
  const tax = Number(creatorTaxBps);
  return {
    feeBps: fee,
    creatorTaxBps: tax,
    protocolShareBps: protocol,
    toBatteryBps: Math.round((fee * (10_000 - protocol)) / 10_000 + tax),
    accruingOnCurveEth: Number(formatEther(quoteFeeBalance)),
    claimableEth,
  };
}
