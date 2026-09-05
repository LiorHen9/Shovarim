"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { ArrowRight, CheckIcon, ExternalLink, PencilIcon, TrashIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardDetailSkeleton, CardListSkeleton } from "@/components/skeletons/PageSkeletons";
import { DeleteCardButton } from "@/components/cards/DeleteCardButton";
import { ShareListDialog } from "@/components/lists/ShareListDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useCardLists } from "@/hooks/useCardLists";
import { useCards } from "@/hooks/useCards";
import { useListMembers } from "@/hooks/useListMembers";
import { db } from "@/lib/firebase/client";
import { formatCurrency, formatDate, statusLabelHe } from "@/lib/format";
import { createCardListSchema } from "@/lib/validation/cardList";

export default function CardListDetailPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { lists, loading: listsLoading } = useCardLists(user?.uid ?? null);
  const { cards, loading: cardsLoading } = useCards(user?.uid ?? null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const list = lists.find((l) => l.id === listId);
  const isOwner = list?.role === "owner";
  // Only the owner can query the full members subcollection (Security Rules
  // deny it to anyone else) — see useListMembers.
  const { members } = useListMembers(isOwner ? listId : null);

  if (authLoading || !user || listsLoading) return <CardDetailSkeleton />;
  if (!list) return <p className="text-muted-foreground">הרשימה לא נמצאה.</p>;

  const canManage = list.role === "owner" || list.role === "manager";
  const listCards = cards.filter((card) => card.listId === listId);
  const deleteBlockedReasons: string[] = [];
  if (listCards.length > 0) deleteBlockedReasons.push("אי אפשר למחוק רשימה שיש בה כרטיסים");
  if (members.length > 0) {
    deleteBlockedReasons.push("יש לבטל את השיתוף עם כל המשתמשים לפני מחיקת הרשימה");
  }

  function startEdit() {
    setNameValue(list!.name);
    setEditingName(true);
  }

  async function saveEdit() {
    const parsed = createCardListSchema.shape.name.safeParse(nameValue);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "שם לא תקין");
      return;
    }
    try {
      await updateDoc(doc(db, "cardLists", list!.id), {
        name: parsed.data,
        updatedAt: serverTimestamp(),
      });
      toast.success("שם הרשימה עודכן");
      setEditingName(false);
    } catch {
      toast.error("העדכון נכשל");
    }
  }

  async function removeList() {
    if (deleteBlockedReasons.length > 0) {
      toast.error(deleteBlockedReasons[0]);
      return;
    }
    try {
      await deleteDoc(doc(db, "cardLists", list!.id));
      toast.success("הרשימה נמחקה");
      router.push("/cards");
    } catch {
      toast.error("המחיקה נכשלה");
    }
  }

  return (
    <div className="space-y-4">
      <Link href="/cards" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowRight className="size-4" />
        חזרה לרשימות
      </Link>

      <div className="flex items-center justify-between">
        {editingName ? (
          <div className="flex items-center gap-1">
            <Input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              aria-label="שם חדש לרשימה"
              autoFocus
              className="max-w-xs"
            />
            <Button variant="ghost" size="icon-sm" onClick={() => void saveEdit()} aria-label="שמירת שם הרשימה">
              <CheckIcon className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setEditingName(false)} aria-label="ביטול עריכה">
              <XIcon className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <h1 className="text-xl font-bold">{list.name}</h1>
            {isOwner && (
              <>
                <Button variant="ghost" size="icon-sm" onClick={startEdit} aria-label="עריכת שם הרשימה">
                  <PencilIcon className="size-4" />
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={deleteBlockedReasons.length > 0 ? 0 : undefined}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void removeList()}
                        disabled={deleteBlockedReasons.length > 0}
                        aria-label="מחיקת הרשימה"
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {deleteBlockedReasons.length > 0 && (
                    <TooltipContent>
                      {deleteBlockedReasons.length === 1 ? (
                        deleteBlockedReasons[0]
                      ) : (
                        <ul className="list-disc space-y-0.5 ps-3.5">
                          {deleteBlockedReasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      )}
                    </TooltipContent>
                  )}
                </Tooltip>
                <ShareListDialog listId={list.id} listName={list.name} />
              </>
            )}
          </div>
        )}
        {canManage && (
          <Button asChild>
            <Link href={`/cards/new?listId=${list.id}`}>כרטיס חדש</Link>
          </Button>
        )}
      </div>

      {cardsLoading && (
        <CardListSkeleton />
      )}

      {!cardsLoading && listCards.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">עדיין אין כרטיסים ברשימה הזו.</p>
      )}

      <ul className="space-y-2">
        {listCards.map((card) => (
          <li
            key={card.id}
            className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent"
          >
            <Link href={`/cards/${card.id}`} className="flex flex-1 items-center gap-3">
              {card.cardImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.cardImageUrl}
                  alt={`תמונת הכרטיס ${card.name}`}
                  className="h-10 w-10 rounded-md border object-cover"
                />
              )}
              <div>
                <p className="font-medium">{card.name}</p>
                <p className="text-sm text-muted-foreground">
                  {card.expiryDate ? `בתוקף עד ${formatDate(card.expiryDate)}` : "ללא תוקף"}
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              {card.acceptingRetailersUrl && (
                <a
                  href={card.acceptingRetailersUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`רשתות מכבדות את ${card.name}`}
                  className="text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="size-4" />
                </a>
              )}
              <Link href={`/cards/${card.id}`} className="flex items-center gap-3">
                <span className="font-mono">
                  {formatCurrency(card.currentBalance, card.currency)}
                </span>
                <Badge variant={card.status === "active" ? "default" : "secondary"}>
                  {statusLabelHe[card.status]}
                </Badge>
              </Link>
              {canManage && <DeleteCardButton cardId={card.id} cardName={card.name} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
