import "server-only";

// Never import this module from a Client Component. Standalone Node scripts
// and the service layer (src/lib/services/, mcp-server/) import
// ./errorsCore directly instead, same split as src/lib/firebase/admin.ts vs
// adminApp.ts.
export { ActionError, toActionResult, type ActionResult } from "./errorsCore";
