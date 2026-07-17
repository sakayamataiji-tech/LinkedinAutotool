import { MockLinkedInProvider } from "./mock";
import { PlaywrightLinkedInProvider } from "./playwright";
import type { LinkedInProvider } from "./provider";

export * from "./provider";

let cached: LinkedInProvider | null = null;

/**
 * Resolve the active provider (cached). Select with LINKEDIN_PROVIDER:
 *   - "mock" (default): deterministic simulation, no real account needed
 *   - "playwright": real LinkedIn browser automation (requires LINKEDIN_LI_AT)
 *
 * The Playwright provider only imports `playwright-core` lazily (inside its
 * browser manager), so selecting it here does not pull the browser into
 * non-node bundles.
 */
export function getProvider(): LinkedInProvider {
  if (cached) return cached;
  cached =
    process.env.LINKEDIN_PROVIDER === "playwright"
      ? new PlaywrightLinkedInProvider()
      : new MockLinkedInProvider();
  return cached;
}
