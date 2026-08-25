"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useCards } from "@/hooks/useCards";
import { formatCurrency, formatDate, statusLabelHe } from "@/lib/format";

export default function CardsPage() {
  const { user } = useAuth();
  const { cards, loading } = useCards(user?.uid ?? null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">הכרטיסים שלי</h1>
        <Button asChild>
          <Link href="/cards/new">כרטיס חדש</Link>
        </Button>
      </div>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!loading && cards.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          עדיין אין כאן כרטיסים. הוסיפו את הראשון.
        </p>
      )}

      <ul className="space-y-2">
        {cards.map((card) => (
          <li key={card.id}>
            <Link
              href={`/cards/${card.id}`}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent"
            >
              <div>
                <p className="font-medium">{card.name}</p>
                <p className="text-sm text-muted-foreground">
                  {card.expiryDate ? `בתוקף עד ${formatDate(card.expiryDate)}` : "ללא תוקף"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono">
                  {formatCurrency(card.currentBalance, card.currency)}
                </span>
                <Badge variant={card.status === "active" ? "default" : "secondary"}>
                  {statusLabelHe[card.status]}
                </Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
