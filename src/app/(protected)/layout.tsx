import { redirect } from "next/navigation";

import { Header } from "@/components/layout/Header";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { ConsentBanner } from "@/components/legal/ConsentBanner";
import { DeletionPendingBanner } from "@/components/legal/DeletionPendingBanner";
import { getSessionUid } from "@/lib/auth/session";
import { A11Y_MAIN_CONTENT_ID } from "@/lib/a11y/constants";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const uid = await getSessionUid();
  if (!uid) redirect("/");

  return (
    // Mounted here rather than in the root layout (which is what the Next guide shows):
    // there is already an established banner slot above the Header, the public pages are
    // static and a connectivity bar on them is noise, and useOffline() returns false
    // during SSR anyway so it would buy nothing there.
    <div className="flex min-h-full flex-1 flex-col">
      <OfflineBanner />
      <DeletionPendingBanner />
      <Header />
      {/* Was a plain <div>. Every signed-in page therefore had no main landmark, so a
          screen-reader user could not jump to the content and the skip link had nothing to
          target. WCAG 1.3.1 / 2.4.1. */}
      <main id={A11Y_MAIN_CONTENT_ID} className="mx-auto w-full max-w-4xl flex-1 p-4">
        {children}
      </main>
      <ConsentBanner />
    </div>
  );
}
