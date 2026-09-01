"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// One free-text field, not separate email/uid fields — /admin/users/page.tsx
// decides which lookup to run by shape (contains "@" → email). A GET
// navigation (router.push with a query string), not a Server Action: this is
// a read, and it keeps the result page linkable/bookmarkable/back-button-able
// like every other search-by-URL page in the app.
export function UserSearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    router.push(trimmed ? `/admin/users?q=${encodeURIComponent(trimmed)}` : "/admin/users");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="חיפוש לפי אימייל או uid"
        aria-label="חיפוש משתמש"
        className="max-w-xs"
      />
      <Button type="submit" variant="outline">
        חיפוש
      </Button>
      {initialQuery && (
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/users")}>
          נקה
        </Button>
      )}
    </form>
  );
}
