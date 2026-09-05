"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/skeletons/PageSkeletons";
import { useAuth } from "@/hooks/useAuth";
import { useCards } from "@/hooks/useCards";
import { formatCurrency } from "@/lib/format";

export default function DashboardPage() {
  const { user } = useAuth();
  const { cards, loading } = useCards(user?.uid ?? null);

  const activeCards = cards.filter((c) => c.status === "active");
  const totalsByCurrency = activeCards.reduce<Record<string, number>>((acc, card) => {
    acc[card.currency] = (acc[card.currency] ?? 0) + card.currentBalance;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">שלום{user?.displayName ? `, ${user.displayName}` : ""}</h1>
        <p className="text-muted-foreground">סיכום הכרטיסים הפעילים שלכם</p>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : activeCards.length === 0 ? (
        <div className="space-y-3 rounded-lg border p-6 text-center">
          <p className="text-muted-foreground">עדיין אין כרטיסים פעילים.</p>
          <Button asChild>
            <Link href="/cards/new">הוספת כרטיס ראשון</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">כרטיסים פעילים</p>
            <p className="text-2xl font-bold">{activeCards.length}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">יתרה כוללת</p>
            {Object.entries(totalsByCurrency).map(([currency, total]) => (
              <p key={currency} className="font-mono text-2xl font-bold">
                {formatCurrency(total, currency)}
              </p>
            ))}
          </div>
        </div>
      )}

      <Button asChild variant="outline">
        <Link href="/cards">כל הכרטיסים</Link>
      </Button>
    </div>
  );
}
