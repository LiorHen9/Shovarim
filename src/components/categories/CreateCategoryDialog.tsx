"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDoc, collection } from "firebase/firestore";
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
import { createCategorySchema, type CreateCategoryInput } from "@/lib/validation/category";

export function CreateCategoryDialog({
  uid,
  open,
  onOpenChange,
  onCreated,
}: {
  uid: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (categoryId: string) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: "", icon: null, color: null },
  });

  async function onSubmit(values: CreateCategoryInput) {
    try {
      const docRef = await addDoc(collection(db, "categories"), {
        ownerId: uid,
        name: values.name,
        icon: values.icon,
        color: values.color,
        isSystemDefault: false,
      });
      toast.success("הקטגוריה נוצרה");
      reset({ name: "", icon: null, color: null });
      onOpenChange(false);
      onCreated(docRef.id);
    } catch {
      toast.error("יצירת הקטגוריה נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>קטגוריה חדשה</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-category-name">שם הקטגוריה</Label>
            <Input
              id="new-category-name"
              {...register("name")}
              aria-describedby={errors.name ? "new-category-name-error" : undefined}
            />
            {errors.name && (
              <p id="new-category-name-error" role="alert" className="text-sm text-destructive">
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
