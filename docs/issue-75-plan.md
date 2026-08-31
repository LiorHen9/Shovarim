# תוכנית מימוש — Issue #75

https://github.com/LiorHen9/Shovarim/issues/75

> מסמך תכנון (טרם מומש). נכתב לפני פתיחת branch נפרד למימוש בפועל — ראו כלל
> העבודה הקבוע ב-`docs/ISSUES_SPRINT.md`. מחקו/העבירו למקום אחר אחרי שה-issue נסגר.

## Context

היום, כשמשתמש שולח לבוט קוד קישור תקין, `redeemLinkCode`
(`src/lib/services/channelLinks.ts:114-179`) דורס בלי שום אזהרה כל קישור קיים
לאותו `channelKey` — גם אם המספר מקושר כרגע לחשבון **אחר** לגמרי. ההיסטוריה
של החשבון הקודם נמחקת (`deleteChannelHistory`), ואף אחד לא מקבל שום עדכון.
זו בדיוק הבעיה ש-issue #75 מבקש לסגור: לפני שמחליפים בעלות על מספר, לוודא
מול מי שכותב לבוט (בטקסט "כן"/"לא" **וגם** בכפתורי CTA אמיתיים), ולהראות לו
איזה חשבון מקושר כרגע (מייל+טלפון עם מיסוך כוכביות) — הכל בשכבה דטרמיניסטית
לחלוטין, **לפני** שההודעה מגיעה ל-LLM (אותו עיקרון שכבר קיים היום ל-`linkCodeSchema`
ב-`channelChat.ts:92`).

הוחלט בפאזת ההבהרה: לממש כפתורי **reply** אמיתיים של WhatsApp
(`interactive.type: "button"`, עם `id`/`title` שחוזרים ב-webhook) — לא רק
`cta_url` שכבר קיים (issue #66) — עם fallback לטקסט חופשי "כן"/"לא", ששני
המסלולים מתאחדים לאותו matcher דטרמיניסטי.

## עיצוב

### 1. `redeemLinkCode` מזהה קונפליקט בתוך אותה טרנזקציה (לא peek נפרד)

ב-`src/lib/services/channelLinks.ts`, בתוך הטרנזקציה הקיימת (114-179) שכבר
קוראת את `codeSnap`, מוסיפים קריאה ל-`linkRef` (Firestore מחייב את כל ה-reads
לפני כל write, אז זה חינם מבחינת round-trips). אם יש קישור קיים ל-uid **שונה**
מ-`codeDoc.uid` ולא הועבר `confirmed: true` — זורקים שגיאה ייעודית חדשה
במקום לדרוס:

```ts
export class RelinkConfirmationRequiredError extends Error {
  constructor(public readonly existingUid: string) { super("relink confirmation required"); }
}

export async function redeemLinkCode(
  channel: ChannelKind,
  externalId: string,
  code: string,
  options?: { confirmed?: boolean }
): Promise<ChannelLinkSummary> { ... }
```

קריאה ל-`tx.get(linkRef)` מתווספת לפני ה-`tx.set`; ההשוואה `existingLink.uid !== codeDoc.uid`
קובעת אם צריך אישור. `options.confirmed` הוא הדלת היחידה לעקוף — נקראת רק
מהמסלול הפנימי אחרי שהמשתמש כבר ענה "כן" (סעיף 3). אין peek נפרד לפני
הטרנזקציה, כדי לא לפתוח חלון race בין קריאה לכתיבה.

### 2. אחסון מצב-ביניים: `channelRelinkConfirmations/{channelKey}`

קובץ שירות חדש `src/lib/services/channelRelinkConfirmations.ts`, באותה רוח כמו
`chatSessions.ts` (Admin SDK בלבד, אימפורטים יחסיים, בלי `server-only` כדי
שסקריפטים ירוצו תחת tsx):

```ts
interface ChannelRelinkConfirmation {
  channelKey: string;
  channel: ChannelKind;
  externalId: string;
  code: string;        // הקוד שטרם מומש, ממתין לאישור
  existingUid: string; // הבעלים הנוכחי שעומד להיות מוחלף (למיסוך בהודעה + audit)
  createdAt: Timestamp;
  expiresAt: Timestamp; // createdAt + LINK_CODE_TTL_MS (10 דקות, אותה קבוע קיים)
}
```

`createPendingRelink` / `getPendingRelink` (מחזיר `null` אם אין מסמך או שפג
תוקפו — אותו דפוס כמו `loadChannelHistory`'s staleness check) / `deletePendingRelink`.
doc id = `channelKey`, בדיוק כמו `channelLinks` — יש לכל היותר אישור ממתין
אחד למספר בכל רגע.

**Firestore rules**: `match /channelRelinkConfirmations/{channelKey} { allow read, write: if false; }`
ב-`firestore.rules`, מיד ליד הבלוק של `channelLinks`/`channelLinkCodes` (שורה ~204-218) —
אותו נימוק בדיוק (מסמך פנימי, Admin SDK בלבד).

### 3. `handleInboundChannelMessage` — שני שינויים ב-`src/lib/services/channelChat.ts`

**(א) ענף חדש בראש הפונקציה**, אחרי צריכת ה-rate limit (שורה 84) ולפני בדיקת
`linkCodeSchema` (שורה 92) — אם יש אישור ממתין לערוץ הזה, **כל** ההודעה
הנכנסת מתפרשת רק כ"כן"/"לא"/כלום, ולא ממשיכה הלאה (לא לבדיקת קוד, לא ל-LLM):

```ts
const pending = await getPendingRelink(channelKey);
if (pending) {
  const verdict = parseYesNo(text); // "כן" -> "confirm", "לא" -> "cancel", אחרת null
  if (verdict === "confirm") {
    await deletePendingRelink(channelKey);
    try {
      await redeemLinkCode(pending.channel, pending.externalId, pending.code, { confirmed: true });
      return { text: REPLY_LINKED };
    } catch (error) {
      if (error instanceof ActionError) return { text: error.message }; // למשל הקוד פג בינתיים
      throw error;
    }
  }
  if (verdict === "cancel") {
    await deletePendingRelink(channelKey);
    return { text: REPLY_RELINK_CANCELLED };
  }
  return { text: REPLY_RELINK_REPROMPT, buttons: RELINK_BUTTONS };
}
```

`parseYesNo` פונקציה טהורה חדשה (קובץ קטן, `src/lib/services/channelChat.ts`
או `src/lib/whatsapp/`) — השוואת מחרוזת מדויקת (`trim()`) מול `"כן"`/`"לא"`
בלבד. שום fuzzy matching, שום LLM.

**(ב) ענף הקוד הקיים (שורות 92-101)** תופס את השגיאה החדשה:

```ts
const code = linkCodeSchema.safeParse(text);
if (code.success) {
  try {
    await redeemLinkCode(channel, externalId, code.data);
    return { text: REPLY_LINKED };
  } catch (error) {
    if (error instanceof RelinkConfirmationRequiredError) {
      await createPendingRelink(channelKey, channel, externalId, code.data, error.existingUid);
      const user = await adminAuth.getUser(error.existingUid);
      const text = buildRelinkConfirmText(maskEmail(user.email ?? ""), maskPhone(externalId));
      return { text, buttons: RELINK_BUTTONS };
    }
    if (!(error instanceof ActionError)) throw error;
    if (!uid) return { text: error.message };
  }
}
```

`RELINK_BUTTONS = [{ id: "relink_confirm", title: "כן" }, { id: "relink_cancel", title: "לא" }]`
— הכותרות **הן בדיוק** "כן"/"לא", כדי שלחיצה על כפתור ותשובה מוקלדת יעברו
דרך אותו `parseYesNo` בדיוק (ראו סעיף 5).

### 4. מיסוך — `src/lib/utils/mask.ts` חדש (טהור, לא קיים כלום דומה היום)

`toPhoneHint` ב-`listInvites.ts:78-84` מציג רק 4 ספרות אחרונות בלי כוכביות,
למטרה אחרת (תצוגת מספר-שהוזמן לבעליו). כאן צריך כוכביות מפורשות על גם מייל
וגם טלפון:

```ts
export function maskEmail(email: string): string   // "li***9@gmail.com" style
export function maskPhone(e164: string): string     // "+972-5*-***-**67" style
```

מימוש דטרמיניסטי פשוט: לשמור תו ראשון+אחרון של החלק שלפני ה-`@`
(fallback לכל המחרוזת ממוסכת אם קצרה מדי) ולהחליף את האמצע ב-`*`; לטלפון —
לשמור קידומת מדינה + 2 ספרות אחרונות ולמסך את האמצע. יחידת בדיקה קטנה
(`tests/unit/mask.test.ts`) מכסה מיילים/מספרים קצרים בקצה.

### 5. כפתורי reply אמיתיים ב-WhatsApp

**Outbound** — `sendWhatsAppReplyButtons` חדש ב-`src/lib/whatsapp/graph.ts`,
לצד `sendWhatsAppCtaUrl` הקיים (שורות 64-102), אותו contract (מחזיר `false`
כש-outbound לא מוגדר, זורק `WhatsAppSendError`):

```ts
export async function sendWhatsAppReplyButtons(
  to: string,
  body: string,
  buttons: { id: string; title: string }[] // עד 3, title ≤20 תווים
): Promise<boolean>
```
גוף הבקשה: `interactive.type: "button"`, `action.buttons: [{ type: "reply", reply: { id, title } }]`.

**`ChannelReply`** (`channelChat.ts:34-40`) מקבל שדה שלישי `buttons?: { id: string; title: string }[]`
לצד `cta` הקיים (הדדית בלעדי — ענף אחד מחזיר אחד מהשניים, אף פעם לא שניהם).

**Webhook dispatch** ב-`src/app/api/whatsapp/webhook/route.ts:105-110` מתרחב:
```ts
if (reply.buttons) await sendWhatsAppReplyButtons(message.from, reply.text, reply.buttons);
else if (reply.cta) await sendWhatsAppCtaUrl(message.from, reply.text, reply.cta);
else await sendWhatsAppText(message.from, reply.text);
```

**Inbound parsing** — `src/lib/validation/whatsapp.ts`: `messageSchema` (16-21)
מקבל שדה `interactive` אופציונלי:
```ts
interactive: z.object({
  type: z.string().optional(),
  button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
}).optional(),
```
וב-`extractInboundMessages` (52-84), חישוב ה-`body` (שורה 72) מתרחב:
```ts
const body =
  message.type === "text"
    ? message.text?.body?.trim()
    : message.type === "interactive" && message.interactive?.type === "button_reply"
      ? message.interactive.button_reply?.title?.trim()
      : undefined;
```
כך שלחיצת כפתור הופכת ל-`text: "כן"` / `text: "לא"` בדיוק כמו הקלדה חופשית —
**נתיב אחד בלבד** ל-`handleInboundChannelMessage`, בלי כפילות לוגיקה. הודעות
אינטראקטיביות שאינן `button_reply` (כמו list replies עתידיים) ממשיכות ליפול
ל-`REPLY_UNSUPPORTED_TYPE` הקיים, ללא שינוי.

### 6. Audit log

`src/types/auditLog.ts` — הוספת `"channel_relink_requested"` ו-
`"channel_relink_cancelled"` ל-`AuditLogEventType`. אישור מוצלח ממשיך
להירשם כ-`"channel_linked"` הקיים (אין צורך באירוע נפרד — זו אותה פעולה
בדיוק, רק עם `confirmed: true`).

## קבצים לעדכן

| קובץ | שינוי |
|---|---|
| `src/lib/services/channelLinks.ts` | `RelinkConfirmationRequiredError`, בדיקת `linkRef` בתוך הטרנזקציה, `options.confirmed` |
| `src/lib/services/channelRelinkConfirmations.ts` (חדש) | CRUD למסמך הביניים |
| `src/types/channelLink.ts` | טיפוס `ChannelRelinkConfirmation` |
| `src/lib/services/channelChat.ts` | ענף pending-confirmation, טיפול ב-`RelinkConfirmationRequiredError`, `parseYesNo`, `RELINK_BUTTONS`, טקסטים חדשים (`REPLY_RELINK_CANCELLED`/`REPLY_RELINK_REPROMPT`/`buildRelinkConfirmText`) |
| `src/lib/utils/mask.ts` (חדש) | `maskEmail`, `maskPhone` |
| `src/lib/whatsapp/graph.ts` | `sendWhatsAppReplyButtons` |
| `src/lib/validation/whatsapp.ts` | סכימת `interactive`/`button_reply`, חילוץ ל-`text` |
| `src/app/api/whatsapp/webhook/route.ts` | dispatch לפי `reply.buttons` |
| `firestore.rules` | `channelRelinkConfirmations` — `if false` |
| `src/types/auditLog.ts` | שני event types חדשים |
| `docs/DATA_MODEL.md` | תיעוד collection חדש |
| `docs/CHATBOT.md` | תיעוד הענף הדטרמיניסטי החדש + סוג ההודעה האינטראקטיבית החדשה |
| `docs/DECISIONS.md` | ADR #40 — הרציונל (transaction-based conflict detection, למה לא peek נפרד, למה buttons+טקסט מתאחדים) |
| `docs/ROADMAP.md` / `docs/FEATURES.md` / `docs/ISSUES_SPRINT.md` | סטטוס issue #75 |

## בדיקות/אימות

1. `npm run typecheck` + `npm run lint`.
2. יחידה: `tests/unit/mask.test.ts` חדש; הרחבת `tests/unit/whatsappWebhook.test.ts`
   ל-payload עם `interactive.button_reply`.
3. סימולציה קצה-לקצה מול האמולטורים (`npm run whatsapp:sim`):
   - `code <uidA>` → `send <phone> <codeA>` — מקשר את `<phone>` ל-A כרגיל.
   - `code <uidB>` → `send <phone> <codeB>` — מאותו `<phone>` בדיוק: מצפים
     להודעת אישור עם מייל/טלפון ממוסכים של A + כפתורי כן/לא, **בלי** שהקישור
     השתנה (`channelLinks/whatsapp:<phone>` עדיין מצביע ל-A).
   - `send <phone> "כן"` — מצפים ל-`REPLY_LINKED`, הקישור עובר ל-B, ה-pending
     doc נמחק, `chatSessions` הישן נמחק (כמו היום).
   - חוזרים על אותו תרחיש עם "לא" — מצפים לביטול, הקישור נשאר אצל A.
4. `npm run test:rules` אחרי עדכון `firestore.rules` (מריץ מול Firestore emulator).
5. אם `tests/e2e/whatsapp.spec.ts` נוגע ב-webhook parsing/dedup ברמה הזו —
   להוסיף שם מקרה ל-`interactive` payload; לבדוק תוך כדי מימוש אם רלוונטי.
