import { Header } from "@/components/layout/Header";

// A route group, so none of these URLs move: /accessibility, /privacy and /terms stay
// exactly where they were.
//
// The group exists because these three pages had no header at all — they sit under
// (public), which has no layout, while <Header /> was mounted only in (protected). The
// footer link Phase 6.A added made that visible: an accessibility statement that has to
// be reachable from everywhere was reachable *only* one way, with no route back.
//
// "/" and /invite/[code] are deliberately left out. The landing page already renders
// "שוברים" as its <h1> with the sign-in buttons in the body, and the invite page is a
// focused conversion route with a single call to action.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header context="public" />
      {children}
    </>
  );
}
