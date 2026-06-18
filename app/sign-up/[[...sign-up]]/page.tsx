import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
