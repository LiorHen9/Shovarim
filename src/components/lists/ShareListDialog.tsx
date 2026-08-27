"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Share2, TrashIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListMembers } from "@/hooks/useListMembers";
import { db } from "@/lib/firebase/client";
import { inviteListMember } from "@/actions/listShare";
import { inviteListMemberSchema, type InviteListMemberInput } from "@/lib/validation/cardListMember";
import type { ListMemberRole } from "@/types/cardListMember";

const roleLabelHe: Record<ListMemberRole, string> = {
  manager: "מנהל",
  viewer: "צופה",
};

export function ShareListDialog({ listId, listName }: { listId: string; listName: string }) {
  const [open, setOpen] = useState(false);
  const { members } = useListMembers(open ? listId : null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteListMemberInput>({
    resolver: zodResolver(inviteListMemberSchema),
    defaultValues: { listId, email: "", role: "viewer" },
  });

  async function onInvite(values: InviteListMemberInput) {
    try {
      const result = await inviteListMember(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("ההזמנה נשלחה");
      reset({ listId, email: "", role: "viewer" });
    } catch {
      toast.error("שליחת ההזמנה נכשלה");
    }
  }

  async function changeRole(memberUid: string, role: ListMemberRole) {
    try {
      await updateDoc(doc(db, "cardLists", listId, "members", memberUid), {
        role,
        updatedAt: serverTimestamp(),
      });
      toast.success("ההרשאה עודכנה");
    } catch {
      toast.error("עדכון ההרשאה נכשל");
    }
  }

  async function removeMember(memberUid: string) {
    try {
      await deleteDoc(doc(db, "cardLists", listId, "members", memberUid));
      toast.success("השיתוף בוטל");
    } catch {
      toast.error("ביטול השיתוף נכשל");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="size-4" />
          שיתוף
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>שיתוף הרשימה &quot;{listName}&quot;</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onInvite)} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-email">כתובת אימייל</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="name@example.com"
                {...register("email")}
                aria-describedby={errors.email ? "invite-email-error" : undefined}
              />
              {errors.email && (
                <p id="invite-email-error" role="alert" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="w-28 space-y-1.5">
              <Label htmlFor="invite-role">הרשאה</Label>
              <select
                id="invite-role"
                {...register("role")}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="viewer">צופה</option>
                <option value="manager">מנהל</option>
              </select>
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "שולח..." : "שליחת הזמנה"}
          </Button>
        </form>

        {members.length > 0 && (
          <ul className="space-y-2 border-t pt-3">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-2 rounded-lg border p-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.email}</p>
                  <Badge variant={member.status === "accepted" ? "default" : "secondary"}>
                    {member.status === "accepted" ? "פעיל" : "ממתין לאישור"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Select
                    value={member.role}
                    onValueChange={(value) => void changeRole(member.memberUid, value as ListMemberRole)}
                  >
                    <SelectTrigger className="h-8 w-24" aria-label={`הרשאת ${member.email}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">{roleLabelHe.viewer}</SelectItem>
                      <SelectItem value="manager">{roleLabelHe.manager}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void removeMember(member.memberUid)}
                    aria-label={`ביטול שיתוף עם ${member.email}`}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            סגירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
