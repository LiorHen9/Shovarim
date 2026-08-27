"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { updateCardBalance } from "@/actions/balance";
import { updateBalanceSchema, type UpdateBalanceInput } from "@/lib/validation/balanceUpdate";

export function UpdateBalanceDialog({
  cardId,
  currentBalance,
}: {
  cardId: string;
  currentBalance: number;
}) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateBalanceInput>({
    resolver: zodResolver(updateBalanceSchema),
    defaultValues: { cardId, newBalance: currentBalance },
  });

  async function onSubmit(values: UpdateBalanceInput) {
    try {
      const result = await updateCardBalance(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("היתרה עודכנה");
      setOpen(false);
    } catch {
      toast.error("עדכון היתרה נכשל");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset({ cardId, newBalance: currentBalance });
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          עדכון יתרה ידני
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עדכון יתרה ידני</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            עדכון זה משנה את היתרה ישירות ואינו יוצר רשומה ביומן השימושים. מיועד לתיקוני יתרה
            (למשל אימות מול בית העסק), לא לרישום הוצאה.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="newBalance">יתרה חדשה</Label>
            <Input
              id="newBalance"
              type="number"
              step="0.01"
              {...register("newBalance", { valueAsNumber: true })}
              aria-describedby={errors.newBalance ? "newBalance-error" : undefined}
            />
            {errors.newBalance && (
              <p id="newBalance-error" role="alert" className="text-sm text-destructive">
                {errors.newBalance.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "שומר..." : "עדכון"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
