"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { Category } from "@/types/category";

export function useCategories(uid: string | null) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "categories"), where("ownerId", "in", ["system", uid]));
    return onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category);
        docs.sort((a, b) => {
          if (a.isSystemDefault !== b.isSystemDefault) return a.isSystemDefault ? -1 : 1;
          return a.name.localeCompare(b.name, "he");
        });
        setCategories(docs);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setError(error);
        setLoading(false);
      }
    );
  }, [uid]);

  if (!uid) return { categories: [], loading: false, error: null };
  return { categories, loading, error };
}
