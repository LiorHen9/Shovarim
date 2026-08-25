"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArchiveCardButton } from "@/components/cards/ArchiveCardButton";
import { EditCardDialog } from "@/components/cards/EditCardDialog";
import { AddUsageForm } from "@/components/usage/AddUsageForm";
import { useAuth } from "@/hooks/useAuth";
import { useCard } from "@/hooks/useCard";
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
  const { entries, loading: entriesLoading } = useUsageLog(cardId, user?.uid ?? null);

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (!card) return <p className="text-muted-foreground">הכרטיס לא נמצא.</p>;

  return (
    <div className="space-y-6">
      <Link href="/cards" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowRight className="size-4" />
        חזרה לכרטיסים
      </Link>

      <div className="flex items-start justify-between rounded-lg border p-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">{card.name}</h1>
          <p className="text-sm text-muted-foreground">
            {card.expiryDate ? `בתוקף עד ${formatDate(card.expiryDate)}` : "ללא תוקף"}
          </p>
          <Badge variant={card.status === "active" ? "default" : "secondary"}>
            {statusLabelHe[card.status]}
          </Badge>
        </div>
        <div className="space-y-2 text-left">
          <p className="text-2xl font-bold font-mono">
            {formatCurrency(card.currentBalance, card.currency)}
          </p>
          <p className="text-xs text-muted-foreground">
            מתוך {formatCurrency(card.initialBalance, card.currency)}
          </p>
          <div className="flex gap-2">
            <EditCardDialog card={card} />
            <ArchiveCardButton cardId={card.id} status={card.status} />
          </div>
        </div>
      </div>

      <AddUsageForm cardId={card.id} />

      <div className="space-y-2">
        <h2 className="font-semibold">יומן שימושים</h2>
        {entriesLoading && <Skeleton className="h-12 w-full" />}
        {!entriesLoading && entries.length === 0 && (
          <p className="text-sm text-muted-foreground">אין עדיין שימושים בכרטיס זה.</p>
        )}
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{entry.purpose}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(entry.date)}
                  {entry.location ? ` · ${entry.location}` : ""}
                </p>
              </div>
              <span className="font-mono text-sm">
                -{formatCurrency(entry.amount, card.currency)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
