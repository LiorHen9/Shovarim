# Pins the Server Actions encryption key (docs/DEPLOYMENT.md "מפתח ה-Server
# Actions", docs/DECISIONS.md ADR #32). Without it every rollout rotates every
# Server Action id and every already-open tab starts getting 404s.
#
# MUST run (and succeed) BEFORE the apphosting.yaml `secret:` entry reaches
# main: a rollout that references a secret which does not exist fails and does
# not retry on its own (the Phase 4.3 outage, see the postmortem in
# docs/DEPLOYMENT.md).
#
# The value is a base64-encoded 32-byte AES-256 key — the same shape Next
# generates itself (crypto.subtle.generateKey AES-GCM 256, exported raw and
# base64'd). Generate one with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
#
# Generate it ONCE and keep it. Rotating it has the exact effect of not having
# it at all: every id changes and every open client breaks until it reloads.
#
# Answer the two prompts from `secrets:set` as: grant access = Yes, add to
# apphosting.yaml = **No** — the entry is already there by hand, with the
# [BUILD, RUNTIME] availability and the comment explaining why BUILD matters.

cd "c:\Users\liorh\Documents\Shovarim"

npx firebase apphosting:secrets:set next-server-actions-encryption-key --project shovarim-prod
npx firebase apphosting:secrets:grantaccess next-server-actions-encryption-key --backend shovarim-web --project shovarim-prod
