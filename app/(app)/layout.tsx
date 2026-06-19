import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "./_components/Sidebar";
import { isAdminUser } from "@/lib/auth/admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();
  const admin = isAdminUser(userId, user?.emailAddresses?.[0]?.emailAddress);

  return (
    <div className="min-h-screen flex">
      <Sidebar isAdmin={admin} />
      <main className="flex-1 overflow-y-auto ml-60">
        {children}
      </main>
    </div>
  );
}
