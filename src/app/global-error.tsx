"use client";

import { useEffect } from "react";

// Last-resort boundary: this fires when the root layout itself fails, so it *replaces*
// that layout and has to supply its own <html> and <body>.
//
// Deliberately dependency-free — no globals.css, no Tailwind classes, no shadcn Button,
// no Heebo font variable (which is defined on the <html> this replaces). Everything is
// inline so this page cannot itself fail for the same reason the app just did. It still
// keeps lang="he" dir="rtl", because the default Next error page is English and LTR.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] root layout failed", error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          background: "#ffffff",
          color: "#0a0a0a",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Arial, 'Noto Sans Hebrew', sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>משהו השתבש</h1>
        <p style={{ margin: 0, maxWidth: "28rem", color: "#525252" }}>
          האפליקציה נתקלה בתקלה בלתי צפויה. אפשר לנסות לטעון מחדש.
        </p>
        {error.digest && (
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#737373" }}>
            קוד שגיאה: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            font: "inherit",
            fontWeight: 500,
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#171717",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          טעינה מחדש
        </button>
      </body>
    </html>
  );
}
