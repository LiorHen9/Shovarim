import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { UserModerationSection } from "@/components/admin/UserModerationSection";
import { getUserDetail } from "@/lib/services/adminUsers";
import { adminUserSearchUidSchema } from "@/lib/validation/adminUsers";

function formatTimestamp(value: { toDate(): Date } | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(value.toDate());
}

function formatIsoDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const parsedUid = adminUserSearchUidSchema.safeParse(uid);
  if (!parsedUid.success) notFound();

  const detail = await getUserDetail(parsedUid.data);
  if (!detail) notFound();

  const {
    profile,
    disabled,
    emailVerified,
    lastSignInAt,
    cardCount,
    listCount,
    moderation,
    emailBlocked,
    channelLinks,
  } = detail;

  return (
    <div className="space-y-4">
      <Link href="/admin/users" className="text-sm underline underline-offset-2">
        חזרה לרשימת המשתמשים
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{profile.displayName || profile.uid}</h1>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
        <div className="flex gap-2">
          {moderation.blocked && <Badge variant="destructive">חסום</Badge>}
          {disabled && <Badge variant="destructive">חשבון מושבת</Badge>}
          {profile.deletionRequestedAt && <Badge variant="destructive">מחיקה ממתינה</Badge>}
          {!emailVerified && <Badge variant="outline">אימייל לא מאומת</Badge>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">פרופיל</h2>
          <dl className="space-y-1 text-sm">
            <Row label="uid" value={profile.uid} mono />
            <Row label="ספק כניסה" value={profile.authProvider} />
            <Row label="שפה" value={profile.locale} />
            <Row label="מטבע ברירת מחדל" value={profile.currency} />
            <Row label="נרשם/ה בתאריך" value={formatTimestamp(profile.createdAt)} />
            <Row label="כניסה אחרונה" value={formatIsoDate(lastSignInAt)} />
            <Row label="בקשת מחיקה" value={formatTimestamp(profile.deletionRequestedAt)} />
          </dl>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">שימוש</h2>
          <dl className="space-y-1 text-sm">
            <Row label="כרטיסים" value={String(cardCount)} />
            <Row label="רשימות" value={String(listCount)} />
          </dl>
        </div>
      </div>

      <UserModerationSection
        uid={profile.uid}
        email={profile.email}
        moderation={moderation}
        emailBlocked={emailBlocked}
        channelLinks={channelLinks}
      />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono" : undefined}>{value}</dd>
    </div>
  );
}
