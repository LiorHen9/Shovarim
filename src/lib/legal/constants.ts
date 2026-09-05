// Bump this whenever the privacy policy changes materially — it forces
// ConsentBanner to re-prompt users who already consented to an older version.
// 2026-09-05 (ADR #59): added the browser-storage and third-party-transfer sections.
// Bumped rather than edited silently because the policy now names two recipients it never
// named before — Anthropic and Meta — and both were already live in production. A new
// recipient is a material change, so every existing user is asked to accept again.
export const PRIVACY_POLICY_VERSION = "2026-09-05";

// Bump when the accessibility statement is re-reviewed. Unlike the privacy version this
// does not re-prompt anyone — it is the "date of last accessibility review" that the
// statement itself is required to disclose, so it must reflect a real review.
export const ACCESSIBILITY_STATEMENT_VERSION = "2026-09-05";

// Published on /accessibility as the channel for reporting an accessibility problem.
// Deliberately a constant and not inlined: it appears in the statement and will appear in
// the accessibility toolbar, and the two must never drift apart.
export const ACCESSIBILITY_CONTACT_EMAIL = "liorhen9@gmail.com";
