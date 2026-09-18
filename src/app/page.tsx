import { ActivitySection } from "@/components/activity/ActivitySection";
import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { TransparencySection } from "@/components/landing/TransparencySection";
import { UtilitySection } from "@/components/landing/UtilitySection";
import { ReserveSection } from "@/components/reserve/ReserveSection";

/**
 * The narrative: the battery, how it works, the reserve, the current,
 * why hold, verify everything, power the reserve.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <div className="hairline mx-auto max-w-[1200px]" />
      <HowItWorks />
      <ReserveSection />
      <ActivitySection />
      <UtilitySection />
      <TransparencySection />
      <FinalCta />
    </>
  );
}
