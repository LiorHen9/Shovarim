import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";

const heebo = Heebo({
  variable: "--font-sans",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "שוברים",
  description: "ניהול שוברים וכרטיסי מתנה",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
