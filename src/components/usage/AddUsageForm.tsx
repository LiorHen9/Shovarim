"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addUsageEntry } from "@/actions/usage";
import { createUsageEntrySchema, type CreateUsageEntryInput } from "@/lib/validation/usageLog";

export function AddUsageForm({ cardId }: { cardId: string }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUsageEntryInput>({
    resolver: zodResolver(createUsageEntrySchema),
    defaultValues: { cardId, amount: 0, date: new Date(), purpose: "", location: null },
  });

  async function onSubmit(values: CreateUsageEntryInput) {
    try {
      await addUsageEntry(values);
      toast.success("השימוש נוסף והיתרה עודכנה");
      reset({ cardId, amount: 0, date: new Date(), purpose: "", location: null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "הוספת השימוש נכשלה");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-lg border p-4">
      <h2 className="font-semibold">הוספת שימוש</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">סכום</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            {...register("amount", { valueAsNumber: true })}
            aria-describedby={errors.amount ? "amount-error" : undefined}
          />
          {errors.amount && (
            <p id="amount-error" role="alert" className="text-sm text-destructive">
              {errors.amount.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">תאריך</Label>
          <Input
            id="date"
            type="date"
            {...register("date", { setValueAs: (v: string) => new Date(v) })}
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="purpose">מטרת השימוש</Label>
        <Input
          id="purpose"
          placeholder="למשל: ארוחת ערב במסעדה"
          {...register("purpose")}
          aria-describedby={errors.purpose ? "purpose-error" : undefined}
        />
        {errors.purpose && (
          <p id="purpose-error" role="alert" className="text-sm text-destructive">
            {errors.purpose.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="location">מיקום (אופציונלי)</Label>
        <Input id="location" {...register("location")} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "שומר..." : "הוספה"}
      </Button>
    </form>
  );
}
