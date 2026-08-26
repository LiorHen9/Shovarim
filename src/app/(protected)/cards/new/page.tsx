"use client";

import { use } from "react";

import { CardForm } from "@/components/cards/CardForm";
import { useAuth } from "@/hooks/useAuth";

export default function NewCardPage({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string }>;
}) {
  const { user, loading } = useAuth();
  const { listId } = use(searchParams);

  if (loading || !user) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">כרטיס חדש</h1>
      <CardForm uid={user.uid} initialListId={listId ?? null} />
    </div>
  );
}
