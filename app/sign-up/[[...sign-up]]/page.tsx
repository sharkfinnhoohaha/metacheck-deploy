import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Pricing CTAs carry purchase intent via ?redirect_url=/api/checkout?tier=pro|team
// so a visitor who picked a paid plan lands on checkout right after sign-up
// instead of the generic dashboard. Only same-origin app paths are honored
// (guards against open-redirect); anything else falls back to /dashboard.
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const safeRedirect =
    redirect_url && redirect_url.startsWith("/") && !redirect_url.startsWith("//")
      ? redirect_url
      : "/dashboard";

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <SignUp signInUrl="/sign-in" forceRedirectUrl={safeRedirect} />
    </div>
  );
}
