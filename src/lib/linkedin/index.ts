import { MockLinkedInProvider } from "./mock";
import type { LinkedInProvider } from "./provider";

export * from "./provider";

/**
 * Resolve the active provider. Swap this out (env-driven) to plug in a real
 * LinkedIn integration without changing any callers.
 */
export function getProvider(): LinkedInProvider {
  // Future: switch on process.env.LINKEDIN_PROVIDER
  return new MockLinkedInProvider();
}
