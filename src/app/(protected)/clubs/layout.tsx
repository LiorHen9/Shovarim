import type { Metadata } from "next";

export const metadata: Metadata = { title: "מועדוני חברות" };

// Same reason as settings/layout.tsx: the page in this segment is a Client
// Component and cannot export metadata, and WCAG 2.4.2 Page Titled (Level A)
// wants each page to announce its own title. Renders children unchanged.
export default function ClubsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
