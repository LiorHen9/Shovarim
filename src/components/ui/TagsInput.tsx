"use client";

import { useId, useState } from "react";
import { XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TagsInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setAnnouncement(`נוספה תגית ${tag}`);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
    setAnnouncement(`הוסרה תגית ${tag}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      const lastTag = value[value.length - 1];
      if (lastTag) removeTag(lastTag);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag}>
              <Badge variant="secondary" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`הסר תגית ${tag}`}
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={inputId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(draft)}
        placeholder="הקלידו תגית ולחצו Enter"
      />
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
