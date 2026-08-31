// Manual verification for the WhatsApp channel (docs/ROADMAP.md Phase 5.5.b).
// Drives the real handleInboundChannelMessage — the same function the webhook
// route calls — with Meta taken out of the picture, so the linking flow, the
// agent turn, the per-turn rate limit and the server-side history can all be
// exercised before a Meta app exists (5.5.c) and afterwards when debugging.
//
// What it deliberately does NOT cover, because it starts *after* those: the
// X-Hub-Signature-256 check, payload parsing, and dedup. Those are covered by
// tests/unit/whatsappWebhook.test.ts and tests/e2e/whatsapp.spec.ts.
//
//   npm run whatsapp:sim -- code <uid>            issue a link code for that user
//   npm run whatsapp:sim -- send <phone> <text>   deliver one message from that number
//
// Runs against whatever .env.local points at — normally the emulators. `send`
// makes a real Claude call once the number is linked.
import { createLinkCodeForUid } from "../src/lib/services/channelLinks";
import { handleInboundChannelMessage } from "../src/lib/services/channelChat";
import { e164Schema } from "../src/lib/validation/channelLink";

function usage(): never {
  console.error("usage: whatsapp:sim -- code <uid> | send <phone> <text...>");
  process.exit(1);
}

async function main() {
  const [, , command, target, ...rest] = process.argv;
  if (!command || !target) usage();

  console.log(`project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}, emulator: ${process.env.FIREBASE_USE_EMULATOR}`);

  if (command === "code") {
    const { code, expiresAt } = await createLinkCodeForUid(target, "whatsapp");
    console.log(`code: ${code} (expires ${expiresAt})`);
    return;
  }

  if (command !== "send") usage();

  const text = rest.join(" ").trim();
  if (!text) usage();

  const externalId = e164Schema.parse(target);
  const reply = await handleInboundChannelMessage({ channel: "whatsapp", externalId, text });
  const cta = reply.cta ? ` [button: ${reply.cta.label} -> ${reply.cta.url}]` : "";
  console.log(`\n>>> ${text}\n<<< ${reply.text}${cta}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
