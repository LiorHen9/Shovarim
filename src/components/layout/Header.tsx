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
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { signOut as signOutClient } from "@/lib/auth/authService";
import { clearSession } from "@/actions/auth";

const NAV_LINKS = [
  { href: "/dashboard", label: "ראשי" },
  { href: "/cards", label: "כרטיסים" },
  { href: "/chat", label: "צ'אט" },
];

// Two contexts, one component.
//
// "app" is the signed-in area, where (protected)/layout.tsx has already redirected anyone
// without a session — so there is always a user and the markup never branches. It renders
// exactly what it rendered before this prop existed.
//
// "public" is the legal pages under (public)/(legal). Until now they had no header at all,
// which meant the footer link Phase 6.A added ("הצהרת נגישות", reachable from everywhere
// as תקנה 35 requires) dropped the visitor onto a page with no way back except the browser
// button. That variant resolves the session on the client rather than the server on
// purpose — see the note on <PublicNav /> below.
export function Header({ context = "app" }: { context?: "app" | "public" }) {
  return (
    <HeaderShell homeHref={context === "app" ? "/dashboard" : "/"}>
      {context === "app" ? (
        <>
          <MainNav />
          <UserMenu />
        </>
      ) : (
        <PublicNav />
      )}
    </HeaderShell>
  );
}

function HeaderShell({
  homeHref,
  children,
}: {
  homeHref: string;
  children: React.ReactNode;
}) {
  return (
    // Sticky, so the navigation stays reachable while reading a long page — but only when
    // there is vertical room for it. A fixed-height bar is a real cost at 400% zoom or at
    // --a11y-font-scale: 1.5, and losing content to it is precisely the reflow item
    // docs/ACCESSIBILITY.md tracks; below 480px of viewport height it falls back to static.
    //
    // bg-background is not decoration: the header was transparent, and content scrolling
    // underneath it would otherwise be legible through it. It is a token rather than a
    // literal so that the toolbar's high-contrast mode overrides it along with everything
    // else. z-40 keeps it under the floating toolbar (z-50) and the skip link (z-100).
    <header className="bg-background static top-0 z-40 border-b [@media(min-height:480px)]:sticky">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 p-4">
        <Link href={homeHref} className="text-lg font-bold">
          שוברים
        </Link>
        {children}
      </div>
    </header>
  );
}

function MainNav() {
  return (
    // Named, because there are now two navigation landmarks on the same page — this one
    // and "קישורים משפטיים" in SiteFooter.
    <nav aria-label="ניווט ראשי" className="flex gap-4 text-sm">
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
  );
}

// Resolved on the client, not from getSessionUid(): that helper reads cookies(), which
// would turn the three legal pages dynamic and add an adminAuth.verifySessionCookie
// round trip (checkRevoked: true) to every request for them, on a cpu:1 / memoryMiB:512 /
// maxInstances:2 backend — and these are exactly the pages external crawlers pull. What
// this branch decides is cosmetic; the real gate is src/proxy.ts and firestore.rules.
function PublicNav() {
  const { user, loading } = useAuth();

  // Deliberately renders neither branch while auth is still restoring. Showing
  // "התחברות" first would flash the wrong state at a signed-in visitor, and the
  // placeholder keeps the header from changing height when it resolves.
  if (loading) return <div className="h-8" aria-hidden="true" />;

  if (!user) {
    return (
      <Link href="/" className="text-sm underline underline-offset-2">
        התחברות
      </Link>
    );
  }

  return (
    <>
      <MainNav />
      <UserMenu />
    </>
  );
}

function UserMenu() {
  const { user } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOutClient();
    await clearSession();
    router.push("/");
    router.refresh();
  }

  return (
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
        <ThemeToggle />
        <DropdownMenuItem onClick={() => void handleSignOut()}>
          התנתקות
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
