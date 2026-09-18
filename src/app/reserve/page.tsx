import type { Metadata } from "next";
import { ReservePage } from "@/components/reserve/ReservePage";

export const metadata: Metadata = { title: "Reserve", description: "The VOLT TSLA reserve: value, balance, cycles, purchases." };

export default function Page() {
  return <ReservePage />;
}
