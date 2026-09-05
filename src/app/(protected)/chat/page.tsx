import type { Metadata } from "next";
import { ChatPanel } from "@/components/chat/ChatPanel";

// Per-page <title> (WCAG 2.4.2, Level A) — see the note in src/app/layout.tsx.
export const metadata: Metadata = { title: "צ'אט" };

export default function ChatPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">צ&apos;אט</h1>
      <ChatPanel />
    </div>
  );
}
