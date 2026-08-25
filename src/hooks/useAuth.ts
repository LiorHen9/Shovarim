"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";

import { onAuthChange } from "@/lib/auth/authService";

interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    return onAuthChange((user) => setState({ user, loading: false }));
  }, []);

  return state;
}
