import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { voltConfig } from "@/config/volt";
import { Providers } from "@/components/Providers";
import { Background } from "@/components/layout/Background";
import { Footer } from "@/components/layout/Footer";
import { Intro } from "@/components/layout/Intro";
import { Navbar } from "@/components/layout/Navbar";
import { Toaster } from "@/components/layout/Toaster";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", weight: ["400", "500", "600", "700", "800", "900"], display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(voltConfig.site.url),
  title: { default: "VOLT — Trade. Charge. Build TSLA.", template: "%s · VOLT" },
  description: "Every trade charges the reserve. VOLT is a Robinhood Chain token whose trading fees charge a battery; at 100 %, the reserve acquires TSLA Stock Tokens.",
  openGraph: {
    title: "VOLT — Trade. Charge. Build TSLA.",
    description: "Every trade charges the reserve.",
    siteName: "VOLT",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "VOLT — the battery" }],
  },
  twitter: { card: "summary_large_image", title: "VOLT — Trade. Charge. Build TSLA.", description: "Every trade charges the reserve.", images: ["/og.png"] },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#050505", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrains.variable}`}>
      <body className="min-h-svh">
        <Providers>
          <Background />
          <Intro />
          <Navbar />
          <main className="relative z-[2]">{children}</main>
          <Footer />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
