import type { Metadata } from "next";

export const metadata: Metadata = { title: "הגדרות" };

// The page in this segment is a Client Component, and a Client Component cannot export
// metadata. This layout exists for one reason: to give the segment its own <title>.
// Before this, every page in the app rendered the same title, "שוברים" — WCAG 2.4.2
// Page Titled is Level A, and the title is the first thing a screen reader announces
// after a navigation. It renders children unchanged and adds no markup.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
