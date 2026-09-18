import type { Metadata } from "next";
import { DashboardPage } from "@/components/wallet/DashboardPage";

export const metadata: Metadata = { title: "Dashboard", description: "Your VOLT position." };

export default function Page() {
  return <DashboardPage />;
}
