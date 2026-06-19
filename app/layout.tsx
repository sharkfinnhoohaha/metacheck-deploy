import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const TITLE = "MetaCheck — Fix your metadata before your distributor rejects it";
const DESCRIPTION =
  "Scan release metadata for errors, missing credits, ISRC issues. AI fixes them before you submit to DistroKid, TuneCore, or any distributor.";
const OG_DESCRIPTION = "Catch metadata errors before your distributor does. Free for 3 releases/month.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · MetaCheck" },
  description: DESCRIPTION,
  applicationName: "MetaCheck",
  keywords: [
    "metadata validator", "ISRC checker", "music distribution", "DistroKid",
    "TuneCore", "music metadata", "DDEX", "music royalties",
  ],
  authors: [{ name: "Overlook Strategy" }],
  creator: "Overlook Strategy",
  category: "music",
  icons: { icon: "/icon.svg" },
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    title: TITLE,
    description: OG_DESCRIPTION,
    url: "/",
    siteName: "MetaCheck",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: OG_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
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
