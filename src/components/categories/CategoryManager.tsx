"use client";

import { useState } from "react";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { CheckIcon, PencilIcon, TrashIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCategories } from "@/hooks/useCategories";
import { db } from "@/lib/firebase/client";
import { createCategorySchema } from "@/lib/validation/category";

export function CategoryManager({ uid }: { uid: string }) {
  const { categories, loading } = useCategories(uid);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function startEdit(id: string, currentName: string) {
    setEditingId(id);
    setEditValue(currentName);
  }

  async function saveEdit(id: string) {
    const parsed = createCategorySchema.shape.name.safeParse(editValue);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "שם לא תקין");
      return;
    }
    try {
      await updateDoc(doc(db, "categories", id), { name: parsed.data });
      toast.success("הקטגוריה עודכנה");
      setEditingId(null);
    } catch {
      toast.error("העדכון נכשל");
    }
  }

  async function removeCategory(id: string) {
    try {
      await deleteDoc(doc(db, "categories", id));
      toast.success("הקטגוריה נמחקה");
    } catch {
      toast.error("המחיקה נכשלה");
    }
  }

  if (loading) return null;

  return (
    <ul className="space-y-2">
      {categories.map((category) => (
        <li
          key={category.id}
          className="flex items-center justify-between gap-2 rounded-lg border p-3"
        >
          {editingId === category.id ? (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              aria-label={`שם חדש לקטגוריה ${category.name}`}
              autoFocus
              className="max-w-xs"
            />
          ) : (
            <span className="text-sm font-medium">{category.name}</span>
          )}

          <div className="flex items-center gap-1">
            {category.isSystemDefault ? (
              <span className="text-xs text-muted-foreground">ברירת מחדל</span>
            ) : editingId === category.id ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void saveEdit(category.id)}
                  aria-label="שמירת שם הקטגוריה"
                >
                  <CheckIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditingId(null)}
                  aria-label="ביטול עריכה"
                >
                  <XIcon className="size-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => startEdit(category.id, category.name)}
                  aria-label={`עריכת שם הקטגוריה ${category.name}`}
                >
                  <PencilIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void removeCategory(category.id)}
                  aria-label={`מחיקת הקטגוריה ${category.name}`}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
