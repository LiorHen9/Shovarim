"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/firebase/client";
import { createCardSchema, type CreateCardInput } from "@/lib/validation/card";

export function CardForm({ uid }: { uid: string }) {
  const router = useRouter();
  const {
    register,
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
    },
  });

  async function onSubmit(values: CreateCardInput) {
    try {
      const docRef = await addDoc(collection(db, "cards"), {
        ownerId: uid,
        name: values.name,
        categoryId: values.categoryId,
        tags: values.tags,
        initialBalance: values.initialBalance,
        currentBalance: values.initialBalance,
        currency: values.currency.toUpperCase(),
        expiryDate: values.expiryDate ? Timestamp.fromDate(values.expiryDate) : null,
        purchaseDate: values.purchaseDate ? Timestamp.fromDate(values.purchaseDate) : null,
        cardImageUrl: null,
        barcodeOrCode: values.barcodeOrCode,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("הכרטיס נוסף");
      router.push(`/cards/${docRef.id}`);
    } catch (error) {
      console.error(error);
      toast.error("שמירת הכרטיס נכשלה");
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
        <Label htmlFor="barcodeOrCode">מספר כרטיס (אופציונלי)</Label>
        <Input id="barcodeOrCode" {...register("barcodeOrCode")} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "שומר..." : "שמירה"}
      </Button>
    </form>
  );
}
