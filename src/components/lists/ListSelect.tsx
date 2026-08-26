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
import { useCardLists } from "@/hooks/useCardLists";
import { CreateListDialog } from "@/components/lists/CreateListDialog";

const NEW_VALUE = "__new__";

export function ListSelect({
  uid,
  value,
  onChange,
}: {
  uid: string;
  value: string | null;
  onChange: (listId: string) => void;
}) {
  const triggerId = useId();
  const { lists: allLists } = useCardLists(uid);
  const lists = allLists.filter((list) => list.role !== "viewer");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={triggerId}>רשימה</Label>
      <Select
        value={value ?? undefined}
        onValueChange={(val) => {
          if (val === NEW_VALUE) {
            setCreateOpen(true);
            return;
          }
          onChange(val);
        }}
      >
        <SelectTrigger id={triggerId} className="w-full">
          <SelectValue placeholder="בחרו רשימה" />
        </SelectTrigger>
        <SelectContent>
          {lists.map((list) => (
            <SelectItem key={list.id} value={list.id}>
              {list.name}
            </SelectItem>
          ))}
          <SelectItem value={NEW_VALUE}>+ רשימה חדשה</SelectItem>
        </SelectContent>
      </Select>
      <CreateListDialog uid={uid} open={createOpen} onOpenChange={setCreateOpen} onCreated={onChange} />
    </div>
  );
}
