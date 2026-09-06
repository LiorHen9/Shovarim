"use client";

import { useState } from "react";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { toast } from "sonner";

import { db } from "@/lib/firebase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useClubCatalog } from "@/hooks/useClubCatalog";
import { useClubMemberships } from "@/hooks/useClubMemberships";

export function ClubsGrid({ uid }: { uid: string }) {
  const { catalog, loading: catalogLoading, error: catalogError } = useClubCatalog();
  const { heldCardIds, loading: heldLoading, error: heldError } = useClubMemberships(uid);
  // What the user just clicked, before the write has round-tripped. Rendering
  // straight off heldCardIds would leave the box visually unchanged until the
  // snapshot lands — on a slow connection the tick simply doesn't appear when
  // you click it. These entries win over the snapshot until it catches up.
  const [optimistic, setOptimistic] = useState<ReadonlyMap<string, boolean>>(new Map());

  // An entry in `optimistic` means that card's write is still in flight, so the
  // same state disables just that checkbox — the repo's usual disabled={isSubmitting},
  // scoped to one control so a slow write never freezes the rest of the grid. It
  // also removes the double-toggle race: without it a quick tick/untick queues two
  // writes whose order decides the outcome.
  function setOverride(clubCardId: string, held: boolean | null) {
    setOptimistic((current) => {
      const next = new Map(current);
      if (held === null) next.delete(clubCardId);
      else next.set(clubCardId, held);
      return next;
    });
  }

  async function toggle(clubCardId: string, isHeld: boolean) {
    setOverride(clubCardId, !isHeld);
    // The doc id is pinned to `${uid}_${clubCardId}` by firestore.rules, which
    // is what lets this be a blind set/delete: no read to find an existing row,
    // and no way to end up with two.
    const ref = doc(db, "clubMemberships", `${uid}_${clubCardId}`);
    try {
      if (isHeld) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, {
          id: `${uid}_${clubCardId}`,
          ownerId: uid,
          clubCardId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("שמירת השינוי נכשלה");
    } finally {
      // The override exists only while the write is in flight. Firestore's
      // latency compensation has already delivered the change to our own
      // onSnapshot by the time the write resolves, so handing control back to
      // the snapshot here costs no flicker — and on failure it reverts the tick
      // the server refused rather than leaving a lie on screen.
      setOverride(clubCardId, null);
    }
  }

  if (catalogError || heldError) {
    return (
      <p role="alert" className="py-12 text-center text-destructive">
        שגיאה בטעינת המועדונים
      </p>
    );
  }

  if (catalogLoading || heldLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  if (catalog.length === 0) {
    return <p className="text-sm text-muted-foreground">אין מועדונים זמינים כרגע.</p>;
  }

  const isHeld = (clubCardId: string) => optimistic.get(clubCardId) ?? heldCardIds.has(clubCardId);

  const heldCount = catalog.reduce(
    (total, club) => total + club.cards.filter((card) => isHeld(card.id)).length,
    0
  );

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {heldCount === 0 ? "לא נבחרו כרטיסים" : `נבחרו ${heldCount} כרטיסים`}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {catalog.map((club) => (
          // fieldset/legend, not a heading + div: the checkboxes are labelled
          // with the tier alone ("VIP"), and the legend is what makes a screen
          // reader announce it as "מועדון מפעל הפיס, VIP" instead of a bare
          // "VIP" with no clue which club it belongs to.
          <fieldset
            key={club.id}
            className="rounded-lg border border-s-4 p-4"
            style={{ borderInlineStartColor: club.color }}
          >
            <legend className="px-1 font-semibold">{club.name}</legend>

            {club.description && (
              <p className="text-sm text-muted-foreground">{club.description}</p>
            )}
            <a
              href={club.website}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`לאתר של ${club.name}`}
              className="text-sm underline underline-offset-2"
            >
              לאתר המועדון
            </a>

            <div className="mt-3 space-y-2">
              {club.cards.map((card) => {
                const held = isHeld(card.id);
                return (
                  <label key={card.id} className="flex items-start gap-2">
                    <Checkbox
                      className="mt-0.5"
                      checked={held}
                      disabled={optimistic.has(card.id)}
                      onCheckedChange={() => toggle(card.id, held)}
                    />
                    <span className="text-sm leading-tight">
                      {card.name}
                      {card.description && (
                        <span className="block text-xs text-muted-foreground">
                          {card.description}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
