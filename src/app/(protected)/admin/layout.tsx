import { redirect } from "next/navigation";

import { getSessionUid, isAdminUid } from "@/lib/auth/session";

// Second gate on top of (protected)/layout.tsx's session check — that layout
// already guarantees a signed-in uid here, this one additionally requires
// adminRoles/{uid} (docs/DECISIONS.md ADR #42). Redirects to /dashboard
// rather than throwing, so a non-admin signed-in user just lands back in the
// app instead of hitting an error boundary.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const uid = await getSessionUid();
  if (!uid) redirect("/");
  if (!(await isAdminUid(uid))) redirect("/dashboard");

  return <div className="space-y-6">{children}</div>;
}
