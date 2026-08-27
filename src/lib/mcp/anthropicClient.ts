// Builds the Anthropic client for the shared agent loop (docs/DECISIONS.md
// ADR #20). Relative imports, no "server-only"/"use server" - must run under
// plain tsx (scripts/mcp-cli.ts) as well as inside Next's bundler later, same
// constraint as src/lib/services/cards.ts.
//
// DEV (default): falls back to `new Anthropic()`, which resolves
// ANTHROPIC_API_KEY from the environment exactly as before. That key should
// belong to a separate "dev" workspace in the Anthropic Console (see
// .env.example) so local testing never counts against production usage.
//
// PROD (ANTHROPIC_FEDERATION_RULE_ID set, e.g. via apphosting.yaml):
// authenticates via Anthropic's native Workload Identity Federation instead
// of a static API key. The GCP service account attached to the Firebase App
// Hosting backend (Cloud Run under the hood) mints its own Google-signed
// identity token from the instance metadata server; Anthropic exchanges that
// token for a short-lived access token at POST /v1/oauth/token. This is
// unrelated to Firebase Admin SDK credentials and does not use Vertex AI -
// see the ADR for why both of those were considered and rejected for this.
//
// IMPORTANT: ANTHROPIC_API_KEY must be unset wherever ANTHROPIC_FEDERATION_RULE_ID
// is set - the SDK's credential precedence puts a static API key above
// federation, so a leftover key silently wins and WIF never activates.
import Anthropic from "@anthropic-ai/sdk";
import { oidcFederationProvider } from "@anthropic-ai/sdk/lib/credentials/oidc-federation";

const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";

// format=full is required so the response includes the `email` claim -
// Anthropic's own docs flag its absence as the most common WIF setup
// failure on Google Cloud.
function googleIdentityTokenUrl(): string {
  const audience = encodeURIComponent(ANTHROPIC_BASE_URL);
  return `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${audience}&format=full`;
}

async function fetchGoogleIdentityToken(): Promise<string> {
  const response = await fetch(googleIdentityTokenUrl(), {
    headers: { "Metadata-Flavor": "Google" },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch GCP identity token from the metadata server: ${response.status} ${await response.text()}`
    );
  }
  return response.text();
}

export function createAnthropicClient(): Anthropic {
  const federationRuleId = process.env.ANTHROPIC_FEDERATION_RULE_ID;
  if (!federationRuleId) {
    return new Anthropic();
  }

  const organizationId = process.env.ANTHROPIC_ORGANIZATION_ID;
  const serviceAccountId = process.env.ANTHROPIC_SERVICE_ACCOUNT_ID;
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  if (!organizationId || !serviceAccountId) {
    throw new Error(
      "ANTHROPIC_FEDERATION_RULE_ID is set but ANTHROPIC_ORGANIZATION_ID/ANTHROPIC_SERVICE_ACCOUNT_ID are missing."
    );
  }

  return new Anthropic({
    baseURL: ANTHROPIC_BASE_URL,
    credentials: oidcFederationProvider({
      identityTokenProvider: fetchGoogleIdentityToken,
      federationRuleId,
      organizationId,
      serviceAccountId,
      workspaceId,
      baseURL: ANTHROPIC_BASE_URL,
      fetch,
    }),
  });
}
