# WhatsApp Cloud API secrets (docs/DEPLOYMENT.md "ערוץ WhatsApp", Phase 5.5.c).
# Each `secrets:set` prompts for the value — paste it at the prompt so the
# secret never lands in a file, in shell history, or in this repo.
#
# MUST run (and succeed) BEFORE the apphosting.yaml `secret:` entries reach
# main: a rollout that references a secret which does not exist fails and does
# not retry on its own. That is the Phase 4.3 outage, see the postmortem in
# docs/DEPLOYMENT.md.
#
# WHATSAPP_PHONE_NUMBER_ID is deliberately absent — it is an identifier, not a
# secret, and lives as a plain `value:` in apphosting.yaml.
#
# Answer the two prompts from `secrets:set` as: grant access = Yes, add to
# apphosting.yaml = **No** — the entries are already there by hand, with the
# RUNTIME-only availability and the comments explaining each one. Letting the
# CLI append its own would duplicate the variable.
#
# `grantaccess` needs --backend (or --emails) on current CLI versions; without
# it the command exits with "Missing required flag". The older bare form in
# Set-AppHosting-AdminKey.ps1 / Set-AppHosting-CardEncryptionKey.ps1 has the
# same problem and would fail if re-run today.

cd "c:\Users\liorh\Documents\Shovarim"

# App settings -> Basic -> App secret. Verifies X-Hub-Signature-256 on inbound
# deliveries (src/lib/whatsapp/signature.ts).
npx firebase apphosting:secrets:set whatsapp-app-secret --project shovarim-prod
npx firebase apphosting:secrets:grantaccess whatsapp-app-secret --backend shovarim-web --project shovarim-prod

# Business portfolio -> System users -> Generate new token, expiration "Never",
# scopes whatsapp_business_messaging + whatsapp_business_management. NOT the
# 24-hour temporary token from the API Setup screen — that one expires and the
# bot then answers nothing while still running tools.
npx firebase apphosting:secrets:set whatsapp-access-token --project shovarim-prod
npx firebase apphosting:secrets:grantaccess whatsapp-access-token --backend shovarim-web --project shovarim-prod

# A random string we choose. The SAME value must be pasted into Meta ->
# WhatsApp -> Configuration -> Webhook -> "Verify token"; the GET handshake
# compares them and returns 403 on any mismatch. Generate with:
#   [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
npx firebase apphosting:secrets:set whatsapp-verify-token --project shovarim-prod
npx firebase apphosting:secrets:grantaccess whatsapp-verify-token --backend shovarim-web --project shovarim-prod
