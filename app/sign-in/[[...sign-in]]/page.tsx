import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
