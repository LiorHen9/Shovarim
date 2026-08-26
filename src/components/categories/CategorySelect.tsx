"use client";

import { useId, useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/hooks/useCategories";
import { CreateCategoryDialog } from "@/components/categories/CreateCategoryDialog";

const NONE_VALUE = "__none__";
const NEW_VALUE = "__new__";

export function CategorySelect({
  uid,
  value,
  onChange,
}: {
  uid: string;
  value: string | null;
  onChange: (categoryId: string | null) => void;
}) {
  const triggerId = useId();
  const { categories } = useCategories(uid);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={triggerId}>קטגוריה</Label>
      <Select
        value={value ?? NONE_VALUE}
        onValueChange={(val) => {
          if (val === NEW_VALUE) {
            setCreateOpen(true);
            return;
          }
          onChange(val === NONE_VALUE ? null : val);
        }}
      >
        <SelectTrigger id={triggerId} className="w-full">
          <SelectValue placeholder="בחרו קטגוריה" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>ללא קטגוריה</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
          <SelectItem value={NEW_VALUE}>+ קטגוריה חדשה</SelectItem>
        </SelectContent>
      </Select>
      <CreateCategoryDialog
        uid={uid}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onChange}
      />
    </div>
  );
}
