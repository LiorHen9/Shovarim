"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateListDialog } from "@/components/lists/CreateListDialog";
import { PendingInvitationsPanel } from "@/components/lists/PendingInvitationsPanel";
import { useAuth } from "@/hooks/useAuth";
import { useCardLists } from "@/hooks/useCardLists";
import { useCards } from "@/hooks/useCards";

export default function CardsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { lists, loading: listsLoading, error: listsError } = useCardLists(user?.uid ?? null);
  const { cards, loading: cardsLoading, error: cardsError } = useCards(user?.uid ?? null);
  const [createListOpen, setCreateListOpen] = useState(false);

  const loading = listsLoading || cardsLoading;
  const error = listsError ?? cardsError;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">הכרטיסים שלי</h1>
        <div className="flex gap-2">
          {!listsLoading && lists.length > 0 && (
            <Button variant="outline" onClick={() => setCreateListOpen(true)}>
              רשימה חדשה
            </Button>
          )}
          <Button asChild>
            <Link href="/cards/new">כרטיס חדש</Link>
          </Button>
        </div>
      </div>

      {user && <PendingInvitationsPanel uid={user.uid} />}

      {loading && !error && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {error && (
        <p role="alert" className="py-12 text-center text-destructive">
          שגיאה בטעינת הכרטיסים. נסו לרענן את הדף.
        </p>
      )}

      {!loading && !error && lists.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          עדיין אין כאן כרטיסים. הוסיפו את הראשון ותיווצר עבורכם רשימה ראשונית.
        </p>
      )}

      {!loading && lists.length > 0 && (
        <ul className="space-y-2">
          {lists.map((list) => {
            const count = cards.filter((card) => card.listId === list.id).length;
            return (
              <li key={list.id}>
                <Link
                  href={`/cards/lists/${list.id}`}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent"
                >
                  <span className="flex items-center gap-2 font-medium">
                    {list.name}
                    {list.role !== "owner" && <Badge variant="secondary">משותפת</Badge>}
                  </span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {count === 0 ? "אין כרטיסים" : `${count} כרטיסים`}
                    <ChevronLeft className="size-4" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {user && (
        <CreateListDialog
          uid={user.uid}
          open={createListOpen}
          onOpenChange={setCreateListOpen}
          onCreated={(listId) => router.push(`/cards/lists/${listId}`)}
        />
      )}
    </div>
  );
}
