import { redirect } from "next/navigation";

import { Header } from "@/components/layout/Header";
import { ConsentBanner } from "@/components/legal/ConsentBanner";
import { getSessionUid } from "@/lib/auth/session";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const uid = await getSessionUid();
  if (!uid) redirect("/");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header />
      <div className="mx-auto w-full max-w-4xl flex-1 p-4">{children}</div>
      <ConsentBanner />
    </div>
  );
}
