"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { deleteCard } from "@/actions/card";

export function DeleteCardButton({
  cardId,
  cardName,
  redirectTo,
}: {
  cardId: string;
  cardName: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    try {
      const result = await deleteCard({ cardId });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("הכרטיס נמחק");
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
    } catch {
      toast.error("מחיקת הכרטיס נכשלה");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`מחיקת הכרטיס "${cardName}"`}>
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>מחיקת כרטיס</DialogTitle>
          <DialogDescription>
            למחוק לצמיתות את הכרטיס &quot;{cardName}&quot;? הפעולה תמחק גם את יומן השימושים והתמונות
            המשויכות אליו, ולא ניתנת לביטול.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            ביטול
          </Button>
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={pending}>
            מחיקה לצמיתות
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
