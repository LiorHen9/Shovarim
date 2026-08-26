"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/firebase/client";
import { createCardListSchema, type CreateCardListInput } from "@/lib/validation/cardList";

export function CreateListDialog({
  uid,
  open,
  onOpenChange,
  onCreated,
}: {
  uid: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (listId: string) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCardListInput>({
    resolver: zodResolver(createCardListSchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: CreateCardListInput) {
    try {
      const docRef = await addDoc(collection(db, "cardLists"), {
        ownerId: uid,
        name: values.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("הרשימה נוצרה");
      reset({ name: "" });
      onOpenChange(false);
      onCreated(docRef.id);
    } catch {
      toast.error("יצירת הרשימה נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>רשימה חדשה</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-list-name">שם הרשימה</Label>
            <Input
              id="new-list-name"
              {...register("name")}
              aria-describedby={errors.name ? "new-list-name-error" : undefined}
            />
            {errors.name && (
              <p id="new-list-name-error" role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "יוצר..." : "יצירה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
