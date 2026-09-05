"use client";

import { useId, useState } from "react";

import { Label } from "@/components/ui/label";
import { validateImageFile } from "@/lib/storage/upload";

export function ImageDropInput({
  label,
  previewAlt,
  currentUrl,
  onFileSelected,
}: {
  label: string;
  previewAlt: string;
  currentUrl?: string | null;
  onFileSelected: (file: File | null) => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setPreview(null);
      setError(null);
      onFileSelected(null);
      return;
    }
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      setPreview(null);
      onFileSelected(null);
      e.target.value = "";
      return;
    }
    setError(null);
    setPreview(URL.createObjectURL(file));
    onFileSelected(file);
  }

  const shownImage = preview ?? currentUrl;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      {shownImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shownImage}
          alt={previewAlt}
          width={96}
          height={96}
          decoding="async"
          className="h-24 w-24 rounded-md border object-cover"
        />
      )}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        onChange={handleChange}
        aria-describedby={error ? errorId : undefined}
        className="block w-full text-sm text-muted-foreground file:me-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
      />
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
