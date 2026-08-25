"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/firebase/client";
import { editCardDetailsSchema, type EditCardDetailsInput } from "@/lib/validation/cardEdit";
import type { GiftCard } from "@/types/card";

export function EditCardDialog({ card }: { card: GiftCard }) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditCardDetailsInput>({
    resolver: zodResolver(editCardDetailsSchema),
    defaultValues: {
      name: card.name,
      expiryDate: card.expiryDate?.toDate() ?? null,
      barcodeOrCode: card.barcodeOrCode,
    },
  });

  async function onSubmit(values: EditCardDetailsInput) {
    try {
      await updateDoc(doc(db, "cards", card.id), {
        name: values.name,
        expiryDate: values.expiryDate ? Timestamp.fromDate(values.expiryDate) : null,
        barcodeOrCode: values.barcodeOrCode,
        updatedAt: serverTimestamp(),
      });
      toast.success("הכרטיס עודכן");
      setOpen(false);
    } catch {
      toast.error("העדכון נכשל");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">עריכה</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת פרטי כרטיס</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">שם הכרטיס</Label>
            <Input id="edit-name" {...register("name")} aria-describedby={errors.name ? "edit-name-error" : undefined} />
            {errors.name && (
              <p id="edit-name-error" role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-expiryDate">תוקף</Label>
            <Input
              id="edit-expiryDate"
              type="date"
              defaultValue={card.expiryDate ? card.expiryDate.toDate().toISOString().slice(0, 10) : ""}
              {...register("expiryDate", { setValueAs: (v: string) => (v ? new Date(v) : null) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-barcodeOrCode">מספר כרטיס</Label>
            <Input id="edit-barcodeOrCode" {...register("barcodeOrCode")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "שומר..." : "שמירה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
