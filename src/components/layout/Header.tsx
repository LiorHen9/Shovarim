"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { signOut as signOutClient } from "@/lib/auth/authService";
import { clearSession } from "@/actions/auth";

const NAV_LINKS = [
  { href: "/dashboard", label: "ראשי" },
  { href: "/cards", label: "כרטיסים" },
];

export function Header() {
  const { user } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOutClient();
    await clearSession();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 p-4">
        <Link href="/dashboard" className="text-lg font-bold">
          שוברים
        </Link>
        <nav className="flex gap-4 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="תפריט משתמש" className="rounded-full">
              <Avatar>
                <AvatarImage src={user?.photoURL ?? undefined} alt="" />
                <AvatarFallback>{user?.displayName?.charAt(0) ?? "?"}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/settings">הגדרות</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleSignOut()}>
              התנתקות
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
