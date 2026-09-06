"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { reportActionError } from "@/lib/actions/clientErrors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clearClubLogoAction,
  deleteClubAction,
  deleteClubCardAction,
  setClubLogoAction,
  syncBuiltInCatalogAction,
} from "@/actions/adminClubs";
import { validateClubLogo } from "@/lib/validation/club";
import type { AdminClub, AdminClubCard } from "@/lib/services/adminClubs";
import { ClubFormDialog } from "./ClubFormDialog";
import { ClubCardFormDialog } from "./ClubCardFormDialog";

// The catalog editor (docs/ROADMAP.md Phase 10.1.b). Everything here writes
// through Server Actions that check adminRoles server-side — the catalog stays
// `allow write: if false` for every browser, so nothing on this page talks to
// Firestore directly.
export function ClubCatalogManager({ catalog }: { catalog: AdminClub[] }) {
  const router = useRouter();
  const [clubDialog, setClubDialog] = useState<{ open: boolean; club: AdminClub | null }>({
    open: false,
    club: null,
  });
  const [cardDialog, setCardDialog] = useState<{
    open: boolean;
    club: AdminClub | null;
    card: AdminClubCard | null;
  }>({ open: false, club: null, card: null });
  // Deleting a club takes its tiers with it and cannot be undone. The service
  // already refuses when anyone holds a tier, so the blast radius is limited to
  // a club nobody uses — but a misclick still throws away a name, a colour and
  // an uploaded logo, which is enough to be worth one confirmation. Tier
  // deletes are not gated this way on purpose: same proportionality as
  // UserModerationSection, where only the highest-impact action confirms.
  const [pendingDelete, setPendingDelete] = useState<AdminClub | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // One helper for every mutation on this page: they all show a toast, refresh
  // the server-rendered list, and must not fire twice from a double click.
  async function run(key: string, action: () => Promise<{ error: string } | object>, success: string) {
    setBusy(key);
    try {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      router.refresh();
    } catch (error) {
      reportActionError(error, "הפעולה נכשלה");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setClubDialog({ open: true, club: null })}>מועדון חדש</Button>
        <Button
          variant="outline"
          disabled={busy === "sync"}
          onClick={() =>
            run(
              "sync",
              async () => {
                const result = await syncBuiltInCatalogAction();
                if (!("error" in result)) {
                  toast.info(`${result.clubs} מועדונים, ${result.cards} כרטיסים`);
                }
                return result;
              },
              "הקטלוג המובנה הוחל"
            )
          }
        >
          {busy === "sync" ? "מסנכרן..." : "החלת הקטלוג המובנה"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        &quot;החלת הקטלוג המובנה&quot; כותבת מחדש את שבעת המועדונים שמוגדרים בקוד ודורסת עריכות
        שנעשו להם כאן. מועדונים אחרים, וכל סימוני המשתמשים, לא נוגעים.
      </p>

      {catalog.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          הקטלוג ריק. אפשר להחיל את הקטלוג המובנה, או ליצור מועדון חדש.
        </p>
      ) : (
        <ul className="space-y-4">
          {catalog.map((club) => (
            <li key={club.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start gap-3">
                <ClubLogoCell club={club} busy={busy} run={run} />

                <div className="min-w-40 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{club.name}</h2>
                    <code className="text-xs text-muted-foreground" dir="ltr">
                      {club.id}
                    </code>
                    {!club.isActive && <Badge variant="secondary">מושבת</Badge>}
                  </div>
                  {club.description && (
                    <p className="text-sm text-muted-foreground">{club.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {club.website ?? "—"}
                  </p>
                </div>

                {/* Every button on this page is one of several identically
                    labelled ones, so each carries an aria-label naming what it
                    acts on — a screen reader reaching "מחיקה" five times in a
                    row otherwise has no way to tell them apart (WCAG 2.4.6). */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`עריכת ${club.name}`}
                    onClick={() => setClubDialog({ open: true, club })}
                  >
                    עריכה
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    aria-label={`מחיקת ${club.name}`}
                    disabled={busy === `del-${club.id}`}
                    onClick={() => setPendingDelete(club)}
                  >
                    מחיקה
                  </Button>
                </div>
              </div>

              <ul className="mt-3 space-y-2 border-t pt-3">
                {club.cards.map((card) => (
                  <li key={card.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">{card.name}</span>
                    {!card.isActive && <Badge variant="secondary">מושבת</Badge>}
                    {/* The number that decides whether delete is even offered —
                        surfaced up front so the refusal is never a surprise. */}
                    <span className="text-xs text-muted-foreground">
                      {card.membershipCount === 0
                        ? "אין מחזיקים"
                        : `${card.membershipCount} מחזיקים`}
                    </span>
                    <span className="flex-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`עריכת הכרטיס ${card.name} ב${club.name}`}
                      onClick={() => setCardDialog({ open: true, club, card })}
                    >
                      עריכה
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      aria-label={`מחיקת הכרטיס ${card.name} ב${club.name}`}
                      disabled={busy === `delcard-${card.id}` || card.membershipCount > 0}
                      title={
                        card.membershipCount > 0
                          ? "יש מחזיקים לכרטיס — אפשר להשבית אותו בעריכה"
                          : undefined
                      }
                      onClick={() =>
                        run(
                          `delcard-${card.id}`,
                          () => deleteClubCardAction(club.id, card.id.slice(club.id.length + 1)),
                          "הכרטיס נמחק"
                        )
                      }
                    >
                      מחיקה
                    </Button>
                  </li>
                ))}

                {club.cards.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    אין כרטיסים — המועדון לא יוצג למשתמשים עד שיתווסף אחד.
                  </li>
                )}

                <li>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`הוספת כרטיס ל${club.name}`}
                    onClick={() => setCardDialog({ open: true, club, card: null })}
                  >
                    הוספת כרטיס
                  </Button>
                </li>
              </ul>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>למחוק את {pendingDelete?.name}?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.cards.length
                ? `הפעולה תמחק גם ${pendingDelete.cards.length} כרטיסים תחת המועדון, ואינה ניתנת לביטול.`
                : "הפעולה אינה ניתנת לביטול."}{" "}
              כדי להוריד מועדון מהתצוגה בלי למחוק אותו, אפשר לסמן אותו כלא-פעיל בעריכה.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              ביטול
            </Button>
            <Button
              variant="destructive"
              disabled={busy?.startsWith("del-")}
              onClick={async () => {
                const club = pendingDelete;
                if (!club) return;
                await run(`del-${club.id}`, () => deleteClubAction(club.id), "המועדון נמחק");
                setPendingDelete(null);
              }}
            >
              מחיקה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClubFormDialog
        club={clubDialog.club}
        open={clubDialog.open}
        onOpenChange={(open) => setClubDialog((current) => ({ ...current, open }))}
      />
      {cardDialog.club && (
        <ClubCardFormDialog
          club={cardDialog.club}
          card={cardDialog.card}
          open={cardDialog.open}
          onOpenChange={(open) => setCardDialog((current) => ({ ...current, open }))}
        />
      )}
    </div>
  );
}

// Upload goes through a Server Action rather than firebase/storage, because
// storage.rules keeps clubLogos/ unwritable by any client (see that file). The
// file input is hidden behind a button so the control reads as one thing.
function ClubLogoCell({
  club,
  busy,
  run,
}: {
  club: AdminClub;
  busy: string | null;
  run: (key: string, action: () => Promise<{ error: string } | object>, success: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const key = `logo-${club.id}`;

  function onPick(file: File | undefined) {
    if (!file) return;
    // Checked here for an instant message; setClubLogo re-checks server-side,
    // since a Server Action is directly POST-able.
    const invalid = validateClubLogo(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    const formData = new FormData();
    formData.set("clubId", club.id);
    formData.set("logo", file);
    void run(key, () => setClubLogoAction(formData), "הלוגו עודכן");
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {club.logoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element -- same reason as
           ClubsGrid: next/image is not used anywhere in this repo. */
        <img
          src={club.logoUrl}
          alt=""
          width={40}
          height={40}
          className="size-10 rounded-md bg-white object-contain p-px"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-10 place-content-center rounded-md text-base font-bold text-white"
          style={{ backgroundColor: club.color }}
        >
          {club.name.slice(0, 1)}
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        aria-label={`העלאת לוגו עבור ${club.name}`}
        onChange={(event) => {
          onPick(event.target.files?.[0]);
          // Reset so picking the same file twice fires change again.
          event.target.value = "";
        }}
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-0 text-xs underline"
        aria-label={`בחירת לוגו עבור ${club.name}`}
        disabled={busy === key}
        onClick={() => inputRef.current?.click()}
      >
        {busy === key ? "מעלה..." : "לוגו"}
      </Button>
      {club.logoUrl && (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-xs underline"
          aria-label={`הסרת הלוגו של ${club.name}`}
          disabled={busy === key}
          onClick={() => void run(key, () => clearClubLogoAction(club.id), "הלוגו הוסר")}
        >
          הסרה
        </Button>
      )}
    </div>
  );
}
