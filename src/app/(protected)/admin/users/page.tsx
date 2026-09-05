import type { Metadata } from "next";
import Link from "next/link";

import { UserSearchForm } from "@/components/admin/UserSearchForm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  adminUserSearchEmailSchema,
  adminUserSearchUidSchema,
  adminUsersCursorSchema,
} from "@/lib/validation/adminUsers";
import { findUserByEmail, findUserByUid, listUsersPage } from "@/lib/services/adminUsers";
import type { UserProfile } from "@/types/user";

function formatDate(timestamp: UserProfile["createdAt"]): string {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(
    timestamp.toDate()
  );
}

// `photoURL` is written once by ensureUserProfile() at signup (src/actions/auth.ts)
// and never refreshed, so it can be stale or null — the fallback initial covers
// both. Deliberately not read from the Auth record instead: that would mean one
// adminAuth.getUser() per row on every page load.
//
// alt="" on purpose: the display name sits in the adjacent cell, so a real alt
// would just make a screen reader announce the same person twice.
function UserAvatar({ user }: { user: UserProfile }) {
  return (
    <Avatar>
      <AvatarImage src={user.photoURL ?? undefined} alt="" />
      <AvatarFallback>{user.displayName?.charAt(0) || user.email?.charAt(0) || "?"}</AvatarFallback>
    </Avatar>
  );
}

// The search box accepts one field; which lookup runs is decided by shape
// (src/lib/validation/adminUsers.ts) rather than a second control — an "@"
// anywhere in the query is treated as an email, everything else as a uid.
async function resolveSearch(q: string): Promise<{ user: UserProfile | null } | null> {
  if (q.includes("@")) {
    const parsed = adminUserSearchEmailSchema.safeParse(q);
    if (!parsed.success) return { user: null };
    return { user: await findUserByEmail(parsed.data) };
  }

  const parsed = adminUserSearchUidSchema.safeParse(q);
  if (!parsed.success) return { user: null };
  return { user: await findUserByUid(parsed.data) };
}

// Per-page <title> (WCAG 2.4.2, Level A) — see the note in src/app/layout.tsx.
export const metadata: Metadata = { title: "משתמשים · פאנל ניהול" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const { q, cursor } = await searchParams;
  const trimmedQuery = q?.trim() ?? "";

  const searchResult = trimmedQuery ? await resolveSearch(trimmedQuery) : null;
  const parsedCursor = cursor ? adminUsersCursorSchema.safeParse(cursor) : null;
  const listResult = trimmedQuery ? null : await listUsersPage(parsedCursor?.success ? parsedCursor.data : undefined);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">משתמשים</h1>
        <p className="text-sm text-muted-foreground">רשימת כל המשתמשים הרשומים במערכת</p>
      </div>

      <UserSearchForm initialQuery={trimmedQuery} />

      {searchResult && (
        <div className="rounded-lg border p-4">
          {searchResult.user ? (
            <UserRow user={searchResult.user} />
          ) : (
            <p className="text-muted-foreground">לא נמצא משתמש התואם לחיפוש &quot;{trimmedQuery}&quot;</p>
          )}
        </div>
      )}

      {listResult && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-right">
                <tr>
                  <th className="w-px p-3 font-medium">
                    <span className="sr-only">תמונת פרופיל</span>
                  </th>
                  <th className="p-3 font-medium">שם</th>
                  <th className="p-3 font-medium">אימייל</th>
                  <th className="p-3 font-medium">נרשם/ה בתאריך</th>
                  <th className="p-3 font-medium">ספק כניסה</th>
                  <th className="p-3 font-medium">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {listResult.users.map((user) => (
                  <tr key={user.uid} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="w-px p-3">
                      <UserAvatar user={user} />
                    </td>
                    <td className="p-3">
                      <Link href={`/admin/users/${user.uid}`} className="underline underline-offset-2">
                        {user.displayName || user.uid}
                      </Link>
                    </td>
                    <td className="p-3">{user.email}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                    <td className="p-3 text-muted-foreground">{user.authProvider}</td>
                    <td className="p-3">
                      {user.deletionRequestedAt ? (
                        <span className="text-destructive">מחיקה ממתינה</span>
                      ) : (
                        <span className="text-muted-foreground">פעיל</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {listResult.users.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">אין משתמשים להצגה</p>
          )}

          {listResult.nextCursor && (
            <Link
              href={`/admin/users?cursor=${listResult.nextCursor}`}
              className="text-sm underline underline-offset-2"
            >
              עמוד הבא
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function UserRow({ user }: { user: UserProfile }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <UserAvatar user={user} />
        <div>
          <p className="font-medium">{user.displayName || user.uid}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <Link href={`/admin/users/${user.uid}`} className="underline underline-offset-2">
        פרטים
      </Link>
    </div>
  );
}
