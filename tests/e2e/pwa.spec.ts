import { test, expect } from "@playwright/test";

// Installability surface (Phase 6.1, docs/DECISIONS.md ADR #51). All of this is public
// and static, so unlike the rest of tests/e2e/ these need no signed-in user.

test("manifest is served with the RTL/Hebrew identity the installed app needs", async ({
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/manifest+json");

  const manifest = await response.json();

  // dir/lang are what make Android render the app name and shortcut labels right-to-left.
  expect(manifest.lang).toBe("he");
  expect(manifest.dir).toBe("rtl");
  expect(manifest.short_name).toBe("שוברים");

  // `id` must stay pinned: derived from start_url instead, any future change to
  // start_url would read as a different app and leave a second home-screen icon.
  expect(manifest.id).toBe("/");
  // An installed app is a returning user; src/proxy.ts handles the expired-cookie case
  // by redirecting to /?next=/dashboard.
  expect(manifest.start_url).toBe("/dashboard");
  // Must stay "/" so signInWithRedirect's /__/auth/** round-trip (ADR #34/#35) stays
  // inside the installed window.
  expect(manifest.scope).toBe("/");
  expect(manifest.display).toBe("standalone");

  // Android downgrades the install prompt without a maskable icon.
  const purposes = manifest.icons.map((icon: { purpose?: string }) => icon.purpose);
  expect(purposes).toContain("any");
  expect(purposes).toContain("maskable");
});

test("every icon the manifest advertises actually resolves", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();

  for (const icon of manifest.icons as Array<{ src: string; type: string }>) {
    const response = await request.get(icon.src);
    expect(response.status(), `${icon.src} should resolve`).toBe(200);
    expect(response.headers()["content-type"]).toContain(icon.type);
  }
});

test("the shortcut targets are real routes, not 404s", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.shortcuts).toHaveLength(3);

  for (const shortcut of manifest.shortcuts as Array<{ url: string }>) {
    // Signed out, src/proxy.ts redirects these to /?next=… — a 404 would mean the
    // shortcut points at a route that no longer exists.
    const response = await request.get(shortcut.url, { maxRedirects: 0 });
    expect([200, 307, 308], `${shortcut.url} should not 404`).toContain(response.status());
  }
});

test("the document head carries the install and link-preview tags", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);

  // Both halves of the theme-aware pair, so the installed window's chrome matches the
  // --background token in either colour scheme.
  await expect(page.locator('meta[name="theme-color"][media*="light"]')).toHaveAttribute(
    "content",
    "#ffffff",
  );
  await expect(page.locator('meta[name="theme-color"][media*="dark"]')).toHaveAttribute(
    "content",
    "#0a0a0a",
  );

  // WhatsApp is the app's primary sharing channel (ADR #37/#39) and scrapes these.
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "he_IL");
});

test("zoom is not locked", async ({ page }) => {
  // Guards the accessibility requirement in docs/ACCESSIBILITY.md ("תפקוד תקין עד zoom
  // 200%"). Adding maximum-scale/user-scalable=no is the standard way a PWA regresses it,
  // and the accessibility toolbar planned in Phase 6.A needs pinch-zoom to keep working.
  await page.goto("/");
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).not.toContain("maximum-scale");
  expect(viewport).not.toContain("user-scalable");
});
