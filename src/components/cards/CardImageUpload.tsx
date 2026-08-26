"use client";

import { useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";

import { ImageDropInput } from "@/components/ui/ImageDropInput";
import { db } from "@/lib/firebase/client";
import { uploadCardImage } from "@/lib/storage/upload";

export function CardImageUpload({
  uid,
  cardId,
  cardName,
  currentUrl,
}: {
  uid: string;
  cardId: string;
  cardName: string;
  currentUrl: string | null;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const cardImageUrl = await uploadCardImage(uid, cardId, file);
      await updateDoc(doc(db, "cards", cardId), {
        cardImageUrl,
        updatedAt: serverTimestamp(),
      });
      toast.success("תמונת הכרטיס עודכנה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "העלאת התמונה נכשלה");
    } finally {
      setUploading(false);
    }
  }

  return (
    <ImageDropInput
      label={uploading ? "מעלה תמונה..." : "תמונת כרטיס"}
      previewAlt={`תמונת הכרטיס ${cardName}`}
      currentUrl={currentUrl}
      onFileSelected={(file) => void handleFile(file)}
    />
  );
}
