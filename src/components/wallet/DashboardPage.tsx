"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { formatUnits, type Address } from "viem";
import { useBalance, useConnection, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { TradeButton } from "@/components/landing/Hero";
import { StateNotice } from "@/components/ui/StateNotice";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { CHAIN_ID, explorer } from "@/config/chains";
import { REWARDS_CONTRACT, VOLT_TOKEN } from "@/config/contracts";
import { voltConfig } from "@/config/volt";
import { erc20Abi, rewardsAbi } from "@/lib/blockchain/abis";
import { getRewards } from "@/lib/blockchain/readRewards";
import { fmtAmount, fmtDateTime, fmtEth, fmtPct, shortAddress } from "@/lib/format";
import { useMounted } from "@/lib/hooks";
import { toast } from "@/lib/toast";

/**
 * /dashboard — the visitor's own position. Wallet data is always real
 * (it is their wallet); VOLT figures need the token to be configured;
 * rewards need the flag AND a contract that answers.
 */
export function DashboardPage() {
  const mounted = useMounted();
  const { address, isConnected, chainId } = useConnection();
  const wrongChain = isConnected && chainId !== CHAIN_ID;

  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-28 pb-24 md:px-8 md:pt-36">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="display text-[clamp(44px,6vw,88px)]">YOUR POSITION</h1>
          <p className="lead mt-3">Wallet data is read from the chain. Nothing is signed here.</p>
        </div>
      </div>

      {!mounted || !isConnected || !address ? (
        <div className="panel mt-12 flex flex-col items-start gap-5 p-8">
          <div className="label">CONNECT A WALLET</div>
          <p className="max-w-md text-sm leading-relaxed text-silver">See your VOLT balance, your share of the supply, and — when the rewards contract exists — your claimable TSLA.</p>
          <ConnectButton size="md" />
        </div>
      ) : wrongChain ? (
        <StateNotice className="mt-12" kind="error" title="WRONG NETWORK" body="Switch to Robinhood Chain (4663) to read your position." />
      ) : (
        <Position address={address} />
      )}
    </div>
  );
}

function Position({ address }: { address: Address }) {
  const eth = useBalance({ address, chainId: CHAIN_ID });
  const volt = useReadContract({ address: VOLT_TOKEN ?? undefined, abi: erc20Abi, functionName: "balanceOf", args: [address], chainId: CHAIN_ID, query: { enabled: Boolean(VOLT_TOKEN) } });
  const supply = useReadContract({ address: VOLT_TOKEN ?? undefined, abi: erc20Abi, functionName: "totalSupply", chainId: CHAIN_ID, query: { enabled: Boolean(VOLT_TOKEN) } });
  const decimals = useReadContract({ address: VOLT_TOKEN ?? undefined, abi: erc20Abi, functionName: "decimals", chainId: CHAIN_ID, query: { enabled: Boolean(VOLT_TOKEN) } });

  const dec = decimals.data ?? 18;
  const voltBalance = volt.data != null ? Number(formatUnits(volt.data, dec)) : null;
  const share = volt.data != null && supply.data != null && supply.data > 0n ? (Number(volt.data) / Number(supply.data)) * 100 : null;

  return (
    <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="panel p-6">
        <div className="label">WALLET</div>
        <div className="mono mt-3 text-sm text-ink">{shortAddress(address, 10, 8)}</div>
        <a href={explorer.address(address)} target="_blank" rel="noreferrer" className="label mt-2 inline-flex items-center gap-1 hover:text-ink">
          EXPLORER <ArrowUpRight size={11} />
        </a>
        <div className="label mt-6">ETH BALANCE</div>
        <div className="num mt-2 text-2xl">{eth.data ? fmtEth(Number(formatUnits(eth.data.value, 18))) : eth.isError ? <span className="text-volt-hot">unavailable</span> : "…"}</div>
      </div>

      <div className="panel p-6">
        <div className="label">VOLT BALANCE</div>
        {VOLT_TOKEN ? (
          <>
            <div className="num mt-2 text-2xl">{voltBalance != null ? `${fmtAmount(voltBalance, 2)} VOLT` : volt.isError ? <span className="text-volt-hot">unavailable</span> : "…"}</div>
            <div className="label mt-6">SHARE OF SUPPLY</div>
            <div className="num mt-2 text-2xl">{share != null ? fmtPct(share, 4) : "…"}</div>
          </>
        ) : (
          <>
            <div className="mono mt-3 text-sm text-muted">VOLT TOKEN NOT CONFIGURED</div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">Set NEXT_PUBLIC_VOLT_TOKEN once the token is launched; balances are then read from the ERC-20.</p>
          </>
        )}
        <div className="mt-6">
          <TradeButton />
        </div>
      </div>

      <Rewards address={address} />
    </div>
  );
}

function Rewards({ address }: { address: Address }) {
  const enabled = voltConfig.holderRewardsEnabled && Boolean(REWARDS_CONTRACT);
  const q = useQuery({ queryKey: ["rewards", REWARDS_CONTRACT, address], queryFn: () => getRewards(REWARDS_CONTRACT as Address, address), enabled, refetchInterval: 30_000 });
  const client = usePublicClient();
  const { mutateAsync: write } = useWriteContract();
  const [pending, setPending] = useState(false);

  if (!enabled) {
    return (
      <div className="panel p-6">
        <div className="label flex items-center gap-2">
          YOUR TSLA REWARDS <span className="chip h-5 px-1.5 text-[8px]">NOT LIVE</span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-silver">Holder rewards are not enabled. VOLT does not distribute TSLA to holders today.</p>
        <p className="mono mt-3 text-[10px] text-muted">Flag: NEXT_PUBLIC_HOLDER_REWARDS · Contract: NEXT_PUBLIC_REWARDS_CONTRACT</p>
      </div>
    );
  }

  const claim = async () => {
    if (!client || !REWARDS_CONTRACT) return;
    setPending(true);
    try {
      const hash = await write({ address: REWARDS_CONTRACT, abi: rewardsAbi, functionName: "claim", chainId: CHAIN_ID });
      toast({ kind: "info", title: "Claim submitted", body: "Waiting for confirmation…" });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") toast({ kind: "success", title: "Rewards claimed" });
      else toast({ kind: "error", title: "Claim failed", body: "The transaction reverted." });
      await q.refetch();
    } catch (e) {
      const msg = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error).message;
      toast({ kind: "error", title: "Claim not sent", body: msg.split("\n")[0].slice(0, 140) });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="panel p-6">
      <div className="label flex items-center gap-2">
        YOUR TSLA REWARDS <span className="chip chip-live h-5 px-1.5 text-[8px]">LIVE</span>
      </div>
      {q.isError ? (
        <StateNotice className="mt-4" kind="error" title="REWARDS UNAVAILABLE" body="The rewards contract did not answer." onRetry={() => q.refetch()} />
      ) : (
        <>
          <div className="label mt-4 text-[10px]">CLAIMABLE</div>
          <div className="num mt-2 text-2xl">{q.data ? `${fmtAmount(q.data.claimableTsla, 4)} TSLA` : "…"}</div>
          <div className="label mt-4 text-[10px]">NEXT DISTRIBUTION</div>
          <div className="mono mt-1 text-sm text-silver">{q.data ? (q.data.nextDistributionAt ? fmtDateTime(q.data.nextDistributionAt) : "not scheduled") : "…"}</div>
          <div className="label mt-4 text-[10px]">TOTAL DISTRIBUTED</div>
          <div className="mono mt-1 text-sm text-silver">{q.data ? `${fmtAmount(q.data.totalDistributedTsla, 4)} TSLA` : "…"}</div>
          <button type="button" className="btn btn-primary mt-6" disabled={pending || !q.data || q.data.claimableTsla <= 0} onClick={claim}>
            {pending ? "CLAIMING…" : "CLAIM TSLA"}
          </button>
        </>
      )}
    </div>
  );
}
