"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { TagsInput } from "@/components/ui/TagsInput";
import { CategorySelect } from "@/components/categories/CategorySelect";
import { db } from "@/lib/firebase/client";
import { editCardDetailsSchema, type EditCardDetailsInput } from "@/lib/validation/cardEdit";
import type { GiftCard } from "@/types/card";

export function EditCardDialog({ card, uid }: { card: GiftCard; uid: string }) {
  const [open, setOpen] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditCardDetailsInput>({
    resolver: zodResolver(editCardDetailsSchema),
    defaultValues: {
      name: card.name,
      expiryDate: card.expiryDate?.toDate() ?? null,
      barcodeOrCode: card.barcodeOrCode,
      cvv: card.cvv,
      acceptingRetailersUrl: card.acceptingRetailersUrl,
      notes: card.notes,
      categoryId: card.categoryId,
      tags: card.tags,
    },
  });

  async function onSubmit(values: EditCardDetailsInput) {
    try {
      await updateDoc(doc(db, "cards", card.id), {
        name: values.name,
        expiryDate: values.expiryDate ? Timestamp.fromDate(values.expiryDate) : null,
        barcodeOrCode: values.barcodeOrCode,
        cvv: values.cvv,
        acceptingRetailersUrl: values.acceptingRetailersUrl,
        notes: values.notes,
        categoryId: values.categoryId,
        tags: values.tags,
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
          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="edit-cvv">CVV</Label>
              <Input
                id="edit-cvv"
                inputMode="numeric"
                maxLength={4}
                {...register("cvv", { setValueAs: (v: string) => (v ? v.trim() : null) })}
                aria-describedby={errors.cvv ? "edit-cvv-error" : undefined}
              />
              {errors.cvv && (
                <p id="edit-cvv-error" role="alert" className="text-sm text-destructive">
                  {errors.cvv.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-barcodeOrCode">מספר כרטיס</Label>
            <Input id="edit-barcodeOrCode" {...register("barcodeOrCode")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-acceptingRetailersUrl">קישור לרשתות מכבדות</Label>
            <Input
              id="edit-acceptingRetailersUrl"
              type="url"
              placeholder="https://..."
              {...register("acceptingRetailersUrl", { setValueAs: (v: string) => (v ? v.trim() : null) })}
              aria-describedby={errors.acceptingRetailersUrl ? "edit-acceptingRetailersUrl-error" : undefined}
            />
            {errors.acceptingRetailersUrl && (
              <p id="edit-acceptingRetailersUrl-error" role="alert" className="text-sm text-destructive">
                {errors.acceptingRetailersUrl.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">הערות</Label>
            <Textarea
              id="edit-notes"
              {...register("notes", { setValueAs: (v: string) => (v ? v.trim() : null) })}
              aria-describedby={errors.notes ? "edit-notes-error" : undefined}
            />
            {errors.notes && (
              <p id="edit-notes-error" role="alert" className="text-sm text-destructive">
                {errors.notes.message}
              </p>
            )}
          </div>
          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <CategorySelect uid={uid} value={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            name="tags"
            control={control}
            render={({ field }) => (
              <TagsInput label="תגיות" value={field.value} onChange={field.onChange} />
            )}
          />
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
