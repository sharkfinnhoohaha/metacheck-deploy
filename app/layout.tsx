import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "MetaCheck — Fix your metadata before your distributor rejects it",
  description:
    "Scan release metadata for errors, missing credits, ISRC issues. AI fixes them before you submit to DistroKid, TuneCore, or any distributor.",
  keywords: ["metadata validator", "ISRC checker", "music distribution", "DistroKid", "TuneCore"],
  openGraph: {
    title: "MetaCheck — Fix your metadata before your distributor rejects it",
    description: "Catch metadata errors before your distributor does. Free for 3 releases/month.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="noise">
        <body className="min-h-screen antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
