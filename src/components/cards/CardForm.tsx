"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { collection, doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ImageDropInput } from "@/components/ui/ImageDropInput";
import { TagsInput } from "@/components/ui/TagsInput";
import { CategorySelect } from "@/components/categories/CategorySelect";
import { ListSelect } from "@/components/lists/ListSelect";
import { useCardLists } from "@/hooks/useCardLists";
import { db } from "@/lib/firebase/client";
import { uploadCardImage } from "@/lib/storage/upload";
import { createCardSchema, type CreateCardInput } from "@/lib/validation/card";

const DEFAULT_LIST_NAME = "הרשימה שלי";

export function CardForm({ uid, initialListId }: { uid: string; initialListId?: string | null }) {
  const router = useRouter();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(initialListId ?? null);
  const { lists, loading: listsLoading, error: listsError } = useCardLists(uid);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateCardInput>({
    resolver: zodResolver(createCardSchema),
    defaultValues: {
      name: "",
      categoryId: null,
      tags: [],
      initialBalance: 0,
      currency: "ILS",
      expiryDate: null,
      purchaseDate: null,
      barcodeOrCode: null,
      cvv: null,
      acceptingRetailersUrl: null,
      notes: null,
    },
  });
  const cardName = useWatch({ control, name: "name" });
  const activeListId = initialListId ?? selectedListId;
  const activeList = activeListId ? lists.find((l) => l.id === activeListId) : null;
  // Storage rules only permit image uploads under the actual list owner's uid
  // (docs/DECISIONS.md #15); hide the control rather than let a manager hit a
  // permission error on submit.
  const canUploadImage = !activeListId || activeList?.ownerId === uid;

  async function onSubmit(values: CreateCardInput) {
    try {
      let listId = initialListId ?? selectedListId;
      let listOwnerId = uid;
      if (!listId) {
        if (listsError) {
          toast.error("שגיאה בטעינת הרשימות. נסו לרענן את הדף.");
          return;
        }
        if (listsLoading) {
          toast.error("הרשימות עדיין נטענות, נסו שוב בעוד רגע");
          return;
        }
        if (lists.length === 0) {
          const listRef = doc(collection(db, "cardLists"));
          await setDoc(listRef, {
            ownerId: uid,
            name: DEFAULT_LIST_NAME,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          listId = listRef.id;
        } else {
          toast.error("יש לבחור רשימה עבור הכרטיס");
          return;
        }
      } else {
        const list = lists.find((l) => l.id === listId);
        if (!list || list.role === "viewer") {
          toast.error("אין הרשאה להוסיף כרטיסים לרשימה זו");
          return;
        }
        listOwnerId = list.ownerId;
      }

      const cardRef = doc(collection(db, "cards"));
      // Storage rules only permit writes under the actual list owner's uid
      // (docs/DECISIONS.md #15) — a manager sharing someone else's list can
      // create the card but not attach an image yet.
      const cardImageUrl =
        imageFile && listOwnerId === uid ? await uploadCardImage(uid, cardRef.id, imageFile) : null;

      await setDoc(cardRef, {
        ownerId: listOwnerId,
        listId,
        name: values.name,
        categoryId: values.categoryId,
        tags: values.tags,
        initialBalance: values.initialBalance,
        currentBalance: values.initialBalance,
        currency: values.currency.toUpperCase(),
        expiryDate: values.expiryDate ? Timestamp.fromDate(values.expiryDate) : null,
        purchaseDate: values.purchaseDate ? Timestamp.fromDate(values.purchaseDate) : null,
        cardImageUrl,
        barcodeOrCode: values.barcodeOrCode,
        cvv: values.cvv,
        acceptingRetailersUrl: values.acceptingRetailersUrl,
        notes: values.notes,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("הכרטיס נוסף");
      router.push(`/cards/${cardRef.id}`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "שמירת הכרטיס נכשלה");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">שם הכרטיס</Label>
        <Input id="name" {...register("name")} aria-describedby={errors.name ? "name-error" : undefined} />
        {errors.name && (
          <p id="name-error" role="alert" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>

      {!initialListId && listsLoading && <Skeleton className="h-16 w-full" />}
      {!initialListId && listsError && (
        <p role="alert" className="text-sm text-destructive">
          שגיאה בטעינת הרשימות. נסו לרענן את הדף.
        </p>
      )}
      {!initialListId && !listsLoading && !listsError && lists.length === 0 && (
        <p className="text-sm text-muted-foreground">
          זו הרשימה הראשונה שלכם — ניצור עבורכם רשימה בשם &quot;{DEFAULT_LIST_NAME}&quot; ונשייך אליה את הכרטיס.
        </p>
      )}
      {!initialListId && !listsLoading && !listsError && lists.length > 0 && (
        <ListSelect uid={uid} value={selectedListId} onChange={setSelectedListId} />
      )}

      {canUploadImage && (
        <ImageDropInput
          label="תמונת כרטיס (אופציונלי)"
          previewAlt={`תצוגה מקדימה של תמונת הכרטיס ${cardName || ""}`}
          onFileSelected={setImageFile}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="initialBalance">יתרה התחלתית</Label>
          <Input
            id="initialBalance"
            type="number"
            step="0.01"
            {...register("initialBalance", { valueAsNumber: true })}
            aria-describedby={errors.initialBalance ? "balance-error" : undefined}
          />
          {errors.initialBalance && (
            <p id="balance-error" role="alert" className="text-sm text-destructive">
              {errors.initialBalance.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">מטבע</Label>
          <Input id="currency" maxLength={3} {...register("currency")} />
          {errors.currency && (
            <p role="alert" className="text-sm text-destructive">
              {errors.currency.message}
            </p>
          )}
        </div>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="expiryDate">תוקף (אופציונלי)</Label>
          <Input
            id="expiryDate"
            type="date"
            {...register("expiryDate", {
              setValueAs: (v: string) => (v ? new Date(v) : null),
            })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cvv">CVV (אופציונלי)</Label>
          <Input
            id="cvv"
            inputMode="numeric"
            maxLength={4}
            {...register("cvv", { setValueAs: (v: string) => (v ? v.trim() : null) })}
            aria-describedby={errors.cvv ? "cvv-error" : undefined}
          />
          {errors.cvv && (
            <p id="cvv-error" role="alert" className="text-sm text-destructive">
              {errors.cvv.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="barcodeOrCode">מספר כרטיס (אופציונלי)</Label>
        <Input id="barcodeOrCode" {...register("barcodeOrCode")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="acceptingRetailersUrl">קישור לרשתות מכבדות (אופציונלי)</Label>
        <Input
          id="acceptingRetailersUrl"
          type="url"
          placeholder="https://..."
          {...register("acceptingRetailersUrl", { setValueAs: (v: string) => (v ? v.trim() : null) })}
          aria-describedby={errors.acceptingRetailersUrl ? "acceptingRetailersUrl-error" : undefined}
        />
        {errors.acceptingRetailersUrl && (
          <p id="acceptingRetailersUrl-error" role="alert" className="text-sm text-destructive">
            {errors.acceptingRetailersUrl.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">הערות (אופציונלי)</Label>
        <Textarea
          id="notes"
          {...register("notes", { setValueAs: (v: string) => (v ? v.trim() : null) })}
          aria-describedby={errors.notes ? "notes-error" : undefined}
        />
        {errors.notes && (
          <p id="notes-error" role="alert" className="text-sm text-destructive">
            {errors.notes.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "שומר..." : "שמירה"}
      </Button>
    </form>
  );
}
