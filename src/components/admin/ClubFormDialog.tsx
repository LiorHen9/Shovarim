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
import { upsertClubAction } from "@/actions/adminClubs";
import {
  clubFormSchema,
  DEFAULT_BENEFIT_SCRAPE_LIMIT,
  type ClubFormValues,
} from "@/lib/validation/club";
import type { AdminClub } from "@/lib/services/adminClubs";

const EMPTY: ClubFormValues = {
  id: "",
  name: "",
  description: "",
  website: "",
  color: "#0ea5e9",
  sortOrder: 1,
  isActive: true,
  benefitScrapeLimit: DEFAULT_BENEFIT_SCRAPE_LIMIT,
};

// Create and edit share one dialog: the underlying write is an upsert keyed by
// the slug, so the only real difference is whether the id is editable. It is
// locked on edit because changing it would not rename the club — it would
// create a second one and strand every clubMembership pointing at the tiers of
// the first.
export function ClubFormDialog({
  club,
  open,
  onOpenChange,
}: {
  club: AdminClub | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = club !== null;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClubFormValues>({
    resolver: zodResolver(clubFormSchema),
    defaultValues: EMPTY,
  });

  // The dialog stays mounted while the row behind it changes, so the form has
  // to be re-seeded whenever it is reopened for a different club.
  useEffect(() => {
    if (!open) return;
    reset(
      club
        ? {
            id: club.id,
            name: club.name,
            description: club.description ?? "",
            website: club.website ?? "",
            color: club.color,
            sortOrder: club.sortOrder,
            isActive: club.isActive,
            benefitScrapeLimit: club.benefitScrapeLimit,
          }
        : EMPTY
    );
  }, [open, club, reset]);

  async function onSubmit(values: ClubFormValues) {
    try {
      const result = await upsertClubAction(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "המועדון עודכן" : "המועדון נוצר");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      reportActionError(error, "שמירת המועדון נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `עריכת ${club.name}` : "מועדון חדש"}</DialogTitle>
          <DialogDescription>
            השינוי נכנס לתוקף מיד בעמוד המועדונים של כל המשתמשים.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="club-id">מזהה</Label>
            <Input
              id="club-id"
              dir="ltr"
              readOnly={isEdit}
              placeholder="mifal-hapais"
              {...register("id")}
              aria-describedby={isEdit ? "club-id-locked" : errors.id ? "club-id-error" : undefined}
            />
            {isEdit ? (
              <p id="club-id-locked" className="text-xs text-muted-foreground">
                מזהה קבוע — שינוי שלו היה יוצר מועדון שני ומנתק את מי שכבר סימן כרטיס.
              </p>
            ) : (
              errors.id && (
                <p id="club-id-error" role="alert" className="text-sm text-destructive">
                  {errors.id.message}
                </p>
              )
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="club-name">שם</Label>
            <Input
              id="club-name"
              {...register("name")}
              aria-describedby={errors.name ? "club-name-error" : undefined}
            />
            {errors.name && (
              <p id="club-name-error" role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="club-description">תיאור</Label>
            <Textarea
              id="club-description"
              rows={2}
              {...register("description")}
              aria-describedby={errors.description ? "club-description-error" : undefined}
            />
            {errors.description && (
              <p id="club-description-error" role="alert" className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="club-website">אתר המועדון</Label>
            <Input
              id="club-website"
              dir="ltr"
              placeholder="https://example.co.il"
              {...register("website")}
              aria-describedby="club-website-hint"
            />
            <p id="club-website-hint" className="text-xs text-muted-foreground">
              אפשר להשאיר ריק — אז לא יוצג קישור כלל.
            </p>
            {errors.website && (
              <p role="alert" className="text-sm text-destructive">
                {errors.website.message}
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="club-color">צבע</Label>
              <div className="flex items-center gap-2">
                {/* type=color for the picker, plus the hex in a text field: the
                    native picker cannot be typed into, and an admin pasting a
                    brand hex is the common case. Both drive the same field. */}
                <Controller
                  control={control}
                  name="color"
                  render={({ field }) => (
                    <>
                      <input
                        id="club-color"
                        type="color"
                        // The picker cannot represent an in-progress value like
                        // "#0ea" — fall back rather than let React warn.
                        value={/^#[0-9a-fA-F]{6}$/.test(field.value) ? field.value : "#000000"}
                        onChange={(event) => field.onChange(event.target.value)}
                        className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                        aria-label="בחירת צבע המועדון"
                      />
                      <Input
                        dir="ltr"
                        className="w-28"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        aria-label="צבע בפורמט hex"
                      />
                    </>
                  )}
                />
              </div>
              {errors.color && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.color.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="club-sort">סדר תצוגה</Label>
              <Input
                id="club-sort"
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

            <div className="space-y-1.5">
              <Label htmlFor="club-benefit-limit">מקסימום הטבות</Label>
              <Input
                id="club-benefit-limit"
                type="number"
                min={0}
                max={10000}
                className="w-24"
                {...register("benefitScrapeLimit", { valueAsNumber: true })}
                aria-describedby={
                  errors.benefitScrapeLimit ? "club-benefit-limit-error" : "club-benefit-limit-hint"
                }
              />
              <p id="club-benefit-limit-hint" className="text-xs text-muted-foreground">
                כמה הטבות לשמור מהמועדון בכל סריקה. 0 = ללא הגבלה.
              </p>
              {errors.benefitScrapeLimit && (
                <p id="club-benefit-limit-error" role="alert" className="text-sm text-destructive">
                  {errors.benefitScrapeLimit.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Checkbox
                  id="club-active"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <Label htmlFor="club-active" className="font-normal">
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
