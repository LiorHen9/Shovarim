"use client";

import { useEffect, useState } from "react";
import { deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { usePendingInvitations } from "@/hooks/usePendingInvitations";
import { db } from "@/lib/firebase/client";
import type { CardListMember, ListMemberRole } from "@/types/cardListMember";

const roleLabelHe: Record<ListMemberRole, string> = {
  manager: "מנהל/ת",
  viewer: "צופה/ה",
};

function InvitationRow({ invitation }: { invitation: CardListMember }) {
  const [listName, setListName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, "cardLists", invitation.listId)).then((snap) => {
      if (!cancelled && snap.exists()) setListName((snap.data().name as string) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [invitation.listId]);

  async function accept() {
    setPending(true);
    try {
      await updateDoc(doc(db, "cardLists", invitation.listId, "members", invitation.memberUid), {
        status: "accepted",
        updatedAt: serverTimestamp(),
      });
      toast.success("ההזמנה התקבלה");
    } catch {
      toast.error("אישור ההזמנה נכשל");
    } finally {
      setPending(false);
    }
  }

  async function decline() {
    setPending(true);
    try {
      await deleteDoc(doc(db, "cardLists", invitation.listId, "members", invitation.memberUid));
      toast.success("ההזמנה נדחתה");
    } catch {
      toast.error("דחיית ההזמנה נכשלה");
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border p-3">
      <p className="text-sm">
        הוזמנת להצטרף לרשימה <span className="font-medium">&quot;{listName ?? "..."}&quot;</span> בתור{" "}
        {roleLabelHe[invitation.role]}
      </p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" disabled={pending} onClick={() => void accept()}>
          קבלה
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => void decline()}>
          דחייה
        </Button>
      </div>
    </li>
  );
}

export function PendingInvitationsPanel({ uid }: { uid: string }) {
  const { invitations } = usePendingInvitations(uid);

  if (invitations.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="font-semibold">הזמנות ממתינות</h2>
      <ul className="space-y-2">
        {invitations.map((invitation) => (
          <InvitationRow key={invitation.id} invitation={invitation} />
        ))}
      </ul>
    </div>
  );
}
