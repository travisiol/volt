import type { Metadata } from "next";
import { ActivityPage } from "@/components/activity/ActivityPage";

export const metadata: Metadata = { title: "Activity", description: "Live current: trades, charge, purchases." };

export default function Page() {
  return <ActivityPage />;
}
