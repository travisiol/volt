import { formatUnits, type Address } from "viem";
import type { VoltTokenInfo } from "@/types/reserve";
import { erc20Abi, ponsCurveAbi, ponsTokenAbi } from "./abis";
import { publicClient } from "./client";

/**
 * Facts about the VOLT token: ERC-20 metadata plus, when it is a Pons V2
 * launch, its curve and the spot price the curve implies.
 */
export async function getVoltTokenInfo(token: Address): Promise<VoltTokenInfo> {
  const client = publicClient();
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: "name" }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "totalSupply" }),
  ]);

  let curve: Address | null = null;
  try {
    const c = await client.readContract({ address: token, abi: ponsTokenAbi, functionName: "curve" });
    if (c && !/^0x0{40}$/i.test(c)) curve = c;
  } catch {
    curve = null; // a plain ERC-20 has no curve()
  }

  let graduated: boolean | null = null;
  let priceEth: number | null = null;
  if (curve) {
    try {
      const [g, reserves] = await Promise.all([
        client.readContract({ address: curve, abi: ponsCurveAbi, functionName: "graduated" }),
        client.readContract({ address: curve, abi: ponsCurveAbi, functionName: "getReserves" }),
      ]);
      graduated = g;
      const [quote, tokens] = reserves;
      if (tokens > 0n) priceEth = Number(formatUnits(quote, 18)) / Number(formatUnits(tokens, decimals));
    } catch {
      graduated = null;
    }
  }

  return { address: token, name, symbol, decimals, totalSupply: Number(formatUnits(totalSupply, decimals)), curve, graduated, priceEth };
}
