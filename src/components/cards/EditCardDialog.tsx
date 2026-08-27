"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { TagsInput } from "@/components/ui/TagsInput";
import { CategorySelect } from "@/components/categories/CategorySelect";
import { getCardSecrets, updateCardDetails } from "@/actions/card";
import { editCardDetailsSchema, type EditCardDetailsInput } from "@/lib/validation/cardEdit";
import type { GiftCard } from "@/types/card";

export function EditCardDialog({ card, uid }: { card: GiftCard; uid: string }) {
  const [open, setOpen] = useState(false);
  // cvv/barcodeOrCode are stored encrypted (src/lib/crypto/fieldEncryption.ts)
  // — `card` (from the live onSnapshot listener) only ever holds ciphertext,
  // so the plaintext form fields are fetched via getCardSecrets each time the
  // dialog opens rather than read off the `card` prop.
  const [secretsLoading, setSecretsLoading] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditCardDetailsInput>({
    resolver: zodResolver(editCardDetailsSchema),
    defaultValues: {
      name: card.name,
      expiryDate: card.expiryDate?.toDate() ?? null,
      barcodeOrCode: null,
      cvv: null,
      acceptingRetailersUrl: card.acceptingRetailersUrl,
      notes: card.notes,
      categoryId: card.categoryId,
      tags: card.tags,
    },
  });

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;

    reset({
      name: card.name,
      expiryDate: card.expiryDate?.toDate() ?? null,
      barcodeOrCode: null,
      cvv: null,
      acceptingRetailersUrl: card.acceptingRetailersUrl,
      notes: card.notes,
      categoryId: card.categoryId,
      tags: card.tags,
    });

    setSecretsLoading(true);
    const result = await getCardSecrets({ cardId: card.id });
    setSecretsLoading(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    reset(
      {
        name: card.name,
        expiryDate: card.expiryDate?.toDate() ?? null,
        barcodeOrCode: result.barcodeOrCode,
        cvv: result.cvv,
        acceptingRetailersUrl: card.acceptingRetailersUrl,
        notes: card.notes,
        categoryId: card.categoryId,
        tags: card.tags,
      },
      { keepDefaultValues: false }
    );
  }

  async function onSubmit(values: EditCardDetailsInput) {
    const result = await updateCardDetails({ cardId: card.id, ...values });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("הכרטיס עודכן");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">עריכה</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת פרטי כרטיס</DialogTitle>
        </DialogHeader>
        {secretsLoading && <Skeleton className="h-40 w-full" />}
        {!secretsLoading && (
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
        )}
      </DialogContent>
    </Dialog>
  );
}
