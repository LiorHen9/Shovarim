export type AuthProviderId = "google" | "apple";

export interface AuthProviderConfig {
  id: AuthProviderId;
  labelHe: string;
}

// Apple Sign-In requires a paid Apple Developer account and its own Firebase
// provider config. The `authService` and UI already handle any provider in
// this list generically — enabling Apple later means: implement
// `appleProvider.ts`, add its entry here, and configure it in the Firebase
// console. No other code changes. See docs/DECISIONS.md.
export const SUPPORTED_PROVIDERS: readonly AuthProviderConfig[] = [
  { id: "google", labelHe: "המשך עם Google" },
];
