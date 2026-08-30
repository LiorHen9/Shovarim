import {
  UNKNOWN_AUTH_ERROR_CODE,
  normalizeAuthErrorCode,
  type AuthErrorStage,
} from "@/lib/validation/clientError";

// Pulls the Firebase error code ("auth/popup-blocked") off an unknown thrown
// value. FirebaseError carries it on `.code`; anything else (a network
// TypeError, a Server Action rejection) has no code and reports as "unknown".
export function toAuthErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string" && code.length > 0) return normalizeAuthErrorCode(code);
  }
  return UNKNOWN_AUTH_ERROR_CODE;
}

// The user backing out of the Google account chooser mid-redirect is a
// normal interaction — not a failure worth an error toast or a Cloud
// Logging entry. Kept separate from the message map so both callers agree.
const CANCELLED_CODES = new Set(["auth/redirect-cancelled-by-user", "auth/user-cancelled"]);

export function isCancelledByUser(code: string): boolean {
  return CANCELLED_CODES.has(code);
}

// Actionable Hebrew text for the codes we can actually say something useful
// about. Everything else falls back to the generic message — but always with
// the raw code appended (see buildSignInErrorMessage), so a support question
// arrives with the one detail that makes it diagnosable.
const MESSAGES_BY_CODE: Record<string, string> = {
  "auth/unauthorized-domain": "הדומיין הזה לא מאושר להתחברות. פנו למנהל המערכת",
  "auth/network-request-failed": "בעיית רשת בזמן ההתחברות. בדקו את החיבור ונסו שוב",
  "auth/too-many-requests": "יותר מדי ניסיונות התחברות. המתינו רגע ונסו שוב",
  "auth/account-exists-with-different-credential":
    "קיים כבר חשבון עם האימייל הזה דרך ספק אחר",
  "auth/web-storage-unsupported":
    "הדפדפן חוסם אחסון מקומי הנדרש להתחברות. בטלו מצב גלישה פרטית ונסו שוב",
};

const STAGE_FALLBACK: Record<AuthErrorStage, string> = {
  "provider-sign-in": "ההתחברות נכשלה, נסו שוב",
  "create-session": "ההתחברות הצליחה אך יצירת ההפעלה נכשלה, נסו שוב",
};

export function buildSignInErrorMessage(stage: AuthErrorStage, code: string): string {
  const base = MESSAGES_BY_CODE[code] ?? STAGE_FALLBACK[stage];
  return code === UNKNOWN_AUTH_ERROR_CODE ? base : `${base} (${code})`;
}
