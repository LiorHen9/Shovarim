import "server-only";

// Never import this module from a Client Component. The service layer
// (src/lib/services/) and mcp-server/ import ./listAccessCore directly
// instead, same split as src/lib/firebase/admin.ts vs adminApp.ts.
export { assertCanManageCard, assertCanManageListAndGetOwner } from "./listAccessCore";
