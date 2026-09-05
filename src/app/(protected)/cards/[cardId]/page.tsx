"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CardDetailSkeleton } from "@/components/skeletons/PageSkeletons";
import { ArchiveCardButton } from "@/components/cards/ArchiveCardButton";
import { DeleteCardButton } from "@/components/cards/DeleteCardButton";
import { EditCardDialog } from "@/components/cards/EditCardDialog";
import { CardImageUpload } from "@/components/cards/CardImageUpload";
import { UpdateBalanceDialog } from "@/components/cards/UpdateBalanceDialog";
import { AddUsageForm } from "@/components/usage/AddUsageForm";
import { DeleteUsageEntryButton } from "@/components/usage/DeleteUsageEntryButton";
import { useAuth } from "@/hooks/useAuth";
import { useCard } from "@/hooks/useCard";
import { useCardLists } from "@/hooks/useCardLists";
import { useUsageLog } from "@/hooks/useUsageLog";
import { formatCurrency, formatDate, statusLabelHe } from "@/lib/format";

export default function CardDetailPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = use(params);
  const { user } = useAuth();
  const { card, loading } = useCard(cardId);
  const { lists } = useCardLists(user?.uid ?? null);
  const { entries, loading: entriesLoading } = useUsageLog(cardId, card?.ownerId ?? null);

  if (loading || !user) return <CardDetailSkeleton />;
  if (!card) return <p className="text-muted-foreground">הכרטיס לא נמצא.</p>;

  // Defaults to "viewer" (the least-privileged role) while the lists query is
  // still loading, so management controls don't flash before role resolves.
  const role = lists.find((l) => l.id === card.listId)?.role ?? "viewer";
  const canManage = role === "owner" || role === "manager";
  const isOwner = role === "owner";

  return (
    <div className="space-y-6">
      <Link
        href={`/cards/lists/${card.listId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowRight className="size-4" />
        חזרה לרשימה
      </Link>

      <div className="flex items-start justify-between rounded-lg border p-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{card.name}</h1>
            <p className="text-sm text-muted-foreground">
              {card.expiryDate ? `בתוקף עד ${formatDate(card.expiryDate)}` : "ללא תוקף"}
            </p>
            <Badge variant={card.status === "active" ? "default" : "secondary"}>
              {statusLabelHe[card.status]}
            </Badge>
            {card.acceptingRetailersUrl && (
              <a
                href={card.acceptingRetailersUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" />
                רשתות מכבדות את הכרטיס
              </a>
            )}
          </div>
          {isOwner && (
            <CardImageUpload
              uid={user.uid}
              cardId={card.id}
              cardName={card.name}
              currentUrl={card.cardImageUrl}
            />
          )}
        </div>
        <div className="space-y-2 text-left">
          <div aria-live="polite">
            <p className="text-2xl font-bold font-mono">
              {formatCurrency(card.currentBalance, card.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              מתוך {formatCurrency(card.initialBalance, card.currency)}
            </p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <EditCardDialog card={card} uid={user.uid} />
              <UpdateBalanceDialog cardId={card.id} currentBalance={card.currentBalance} />
              <ArchiveCardButton cardId={card.id} status={card.status} />
              <DeleteCardButton
                cardId={card.id}
                cardName={card.name}
                redirectTo={`/cards/lists/${card.listId}`}
              />
            </div>
          )}
        </div>
      </div>

      {card.notes && (
        <div className="rounded-lg border p-4">
          <h2 className="mb-1 font-semibold">הערות</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{card.notes}</p>
        </div>
      )}

      {canManage && (
        <AddUsageForm cardId={card.id} ownerUid={card.ownerId} canUploadReceipt={isOwner} />
      )}

      <div className="space-y-2">
        <h2 className="font-semibold">יומן שימושים</h2>
        {entriesLoading && <Skeleton className="h-12 w-full" />}
        {!entriesLoading && entries.length === 0 && (
          <p className="text-sm text-muted-foreground">אין עדיין שימושים בכרטיס זה.</p>
        )}
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                {entry.receiptImageUrl && (
                  <a href={entry.receiptImageUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.receiptImageUrl}
                      alt={`קבלה עבור ${entry.purpose}`}
                      width={40}
                      height={40}
                      loading="lazy"
                      decoding="async"
                      className="h-10 w-10 rounded-md border object-cover"
                    />
                  </a>
                )}
                <div>
                  <p className="text-sm font-medium">{entry.purpose}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(entry.date)}
                    {entry.location ? ` · ${entry.location}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">
                  -{formatCurrency(entry.amount, card.currency)}
                </span>
                {canManage && (
                  <DeleteUsageEntryButton
                    cardId={card.id}
                    entryId={entry.id}
                    purpose={entry.purpose}
                    amount={entry.amount}
                    currency={card.currency}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
