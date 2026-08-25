import "server-only";

// Never import this module from a Client Component. `server-only` makes any
// such accidental import fail the build instead of leaking credentials.
// Standalone Node scripts (scripts/) import ./adminApp directly instead.
export { adminAuth, adminDb, adminStorage } from "./adminApp";
