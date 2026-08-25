"use client";

import { useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase/client";
import type { CardStatus } from "@/types/card";

export function ArchiveCardButton({ cardId, status }: { cardId: string; status: CardStatus }) {
  const [pending, setPending] = useState(false);
  const isArchived = status === "archived";

  async function toggleArchive() {
    setPending(true);
    try {
      await updateDoc(doc(db, "cards", cardId), {
        status: isArchived ? "active" : "archived",
        updatedAt: serverTimestamp(),
      });
      toast.success(isArchived ? "הכרטיס שוחזר מהארכיון" : "הכרטיס הועבר לארכיון");
    } catch {
      toast.error("הפעולה נכשלה");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" onClick={() => void toggleArchive()} disabled={pending}>
      {isArchived ? "שחזור מארכיון" : "העברה לארכיון"}
    </Button>
  );
}
