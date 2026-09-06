"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { reportActionError } from "@/lib/actions/clientErrors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertClubCardAction } from "@/actions/adminClubs";
import { clubCardFormSchema, type ClubCardFormValues } from "@/lib/validation/club";
import type { AdminClub, AdminClubCard } from "@/lib/services/adminClubs";

// A tier under one club. The stored doc id is `${clubId}-${cardId}`, so the
// form only asks for the tier half — see ADR #61 for why the membership points
// at the tier rather than at the club.
export function ClubCardFormDialog({
  club,
  card,
  open,
  onOpenChange,
}: {
  club: AdminClub;
  card: AdminClubCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = card !== null;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClubCardFormValues>({
    resolver: zodResolver(clubCardFormSchema),
    defaultValues: {
      clubId: club.id,
      cardId: "",
      name: "",
      description: "",
      sortOrder: 1,
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      clubId: club.id,
      // The doc id is prefixed with the club id; strip it back off so the
      // field shows what was typed ("vip"), not the composed id.
      cardId: card ? card.id.slice(club.id.length + 1) : "",
      name: card?.name ?? "",
      description: card?.description ?? "",
      sortOrder: card?.sortOrder ?? club.cards.length + 1,
      isActive: card?.isActive ?? true,
    });
  }, [open, club, card, reset]);

  async function onSubmit(values: ClubCardFormValues) {
    try {
      const result = await upsertClubCardAction(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "הכרטיס עודכן" : "הכרטיס נוסף");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      reportActionError(error, "שמירת הכרטיס נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `עריכת כרטיס ב${club.name}` : `כרטיס חדש ב${club.name}`}</DialogTitle>
          <DialogDescription>
            דרג כרטיס אחד תחת המועדון. המשתמש מסמן כרטיס, לא מועדון.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="card-id">מזהה</Label>
            <Input
              id="card-id"
              dir="ltr"
              readOnly={isEdit}
              placeholder="vip"
              {...register("cardId")}
              aria-describedby="card-id-hint"
            />
            <p id="card-id-hint" className="text-xs text-muted-foreground">
              המזהה שיישמר הוא <span dir="ltr">{club.id}-</span> ואחריו הערך הזה.
            </p>
            {errors.cardId && (
              <p role="alert" className="text-sm text-destructive">
                {errors.cardId.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="card-name">שם הדרג</Label>
            <Input
              id="card-name"
              placeholder="VIP"
              {...register("name")}
              aria-describedby={errors.name ? "card-name-error" : undefined}
            />
            {errors.name && (
              <p id="card-name-error" role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="card-description">תיאור</Label>
            <Textarea id="card-description" rows={2} {...register("description")} />
            {errors.description && (
              <p role="alert" className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="card-sort">סדר תצוגה</Label>
            <Input
              id="card-sort"
              type="number"
              min={0}
              className="w-24"
              {...register("sortOrder", { valueAsNumber: true })}
            />
            {errors.sortOrder && (
              <p role="alert" className="text-sm text-destructive">
                {errors.sortOrder.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Checkbox
                  id="card-active"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <Label htmlFor="card-active" className="font-normal">
              פעיל (מוצג למשתמשים)
            </Label>
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
