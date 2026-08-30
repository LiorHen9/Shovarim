"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

// חיווי אחיד לכל שלבי העיבוד — שמות ה-tools הם פרט מימוש פנימי
// ולא מוצגים למשתמש/ת (issue #43).
const THINKING_STATUS = "חושב/ת...";

type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string }
  | { type: "done"; history: unknown[] }
  | { type: "error"; message: string };

// Raw Anthropic BetaMessageParam[] round-tripped opaquely to/from
// /api/chat — the browser has no server-side chat session, so the full
// history travels with every request (see docs/DECISIONS.md ADR #22).
export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const historyRef = useRef<unknown[]>([]);

  function appendToLastAssistantMessage(chunk: string) {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === "assistant") {
        next[next.length - 1] = { ...last, text: last.text + chunk };
      }
      return next;
    });
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || pending) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }, { role: "assistant", text: "" }]);
    setInput("");
    setPending(true);
    setStatusText(THINKING_STATUS);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: historyRef.current }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "השליחה נכשלה");
        setPending(false);
        setStatusText(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as ChatStreamEvent;
          if (event.type === "text") {
            setStatusText(null);
            appendToLastAssistantMessage(event.text);
          } else if (event.type === "tool_call") {
            setStatusText(THINKING_STATUS);
          } else if (event.type === "done") {
            historyRef.current = event.history;
          } else if (event.type === "error") {
            toast.error(event.message);
          }
        }
      }
    } catch {
      toast.error("השליחה נכשלה — בדוק/י את החיבור ונסה/י שוב");
    } finally {
      setPending(false);
      setStatusText(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-[50vh] flex-col gap-3 rounded-lg border p-4" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">שאל/י על הכרטיסים שלך, או בקש/י לרשום שימוש, לעדכן יתרה, ועוד.</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                : "self-start rounded-lg bg-muted px-3 py-2 text-sm"
            }
          >
            {m.text || (m.role === "assistant" && pending ? "..." : "")}
          </div>
        ))}
        {statusText && <p className="text-xs text-muted-foreground">{statusText}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage();
        }}
        className="flex gap-2"
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="chat-message" className="sr-only">
            הודעה
          </Label>
          <Textarea
            id="chat-message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="הקלד/י הודעה..."
            disabled={pending}
            rows={2}
          />
        </div>
        <Button type="submit" disabled={pending || !input.trim()}>
          {pending ? "שולח..." : "שליחה"}
        </Button>
      </form>
    </div>
  );
}
