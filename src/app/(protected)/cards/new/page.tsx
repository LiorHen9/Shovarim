"use client";

import { CardForm } from "@/components/cards/CardForm";
import { useAuth } from "@/hooks/useAuth";

export default function NewCardPage() {
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">כרטיס חדש</h1>
      <CardForm uid={user.uid} />
    </div>
  );
}
