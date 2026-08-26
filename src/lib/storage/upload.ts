import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { storage } from "@/lib/firebase/client";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "יש להעלות קובץ תמונה בלבד";
  if (file.size >= MAX_IMAGE_BYTES) return "התמונה גדולה מדי (מקסימום 10MB)";
  return null;
}

async function uploadImage(path: string, file: File): Promise<string> {
  const error = validateImageFile(file);
  if (error) throw new Error(error);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

export function uploadCardImage(uid: string, cardId: string, file: File): Promise<string> {
  return uploadImage(`users/${uid}/cards/${cardId}/cardImage`, file);
}

export function uploadReceiptImage(
  uid: string,
  cardId: string,
  entryId: string,
  file: File
): Promise<string> {
  return uploadImage(`users/${uid}/cards/${cardId}/receipts/${entryId}`, file);
}
