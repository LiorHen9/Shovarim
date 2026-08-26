"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteUsageEntry } from "@/actions/usage";
import { formatCurrency } from "@/lib/format";

export function DeleteUsageEntryButton({
  cardId,
  entryId,
  purpose,
  amount,
  currency,
}: {
  cardId: string;
  entryId: string;
  purpose: string;
  amount: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDelete(restoreBalance: boolean) {
    setPending(true);
    try {
      await deleteUsageEntry({ cardId, entryId, restoreBalance });
      toast.success(restoreBalance ? "השימוש נמחק והסכום הוחזר ליתרה" : "השימוש נמחק");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "מחיקת השימוש נכשלה");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`מחיקת השימוש "${purpose}"`}>
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>מחיקת רשומת שימוש</DialogTitle>
          <DialogDescription>
            למחוק את השימוש &quot;{purpose}&quot; בסך {formatCurrency(amount, currency)}? האם להחזיר את
            הסכום ליתרת הכרטיס?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            ביטול
          </Button>
          <Button variant="outline" onClick={() => void handleDelete(false)} disabled={pending}>
            מחיקה בלי להחזיר ליתרה
          </Button>
          <Button onClick={() => void handleDelete(true)} disabled={pending}>
            מחיקה והחזרת הסכום ליתרה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
