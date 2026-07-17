import type { Browser, BrowserContext, Page } from "playwright-core";

/**
 * Headless browser + LinkedIn session manager for the Playwright provider.
 *
 * Auth uses the operator's own `li_at` session cookie (never a password). The
 * browser and context are singletons reused across actions. `playwright-core`
 * is imported dynamically so this module never lands in an edge bundle.
 *
 * ⚠️ Automating LinkedIn violates its User Agreement and can get the account
 * restricted or banned. Pace actions with the app's daily limits + working
 * hours and keep volumes conservative.
 */

let browserPromise: Promise<Browser> | null = null;
let contextPromise: Promise<BrowserContext> | null = null;

function liAt(): string {
  return process.env.LINKEDIN_LI_AT ?? "";
}

function chromiumPath(): string | undefined {
  return process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
}

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      // The specifier is assembled at runtime (non-literal) so that NO static
      // analyzer — webpack, Vercel's Edge validation, or @vercel/nft — can see
      // this node-only package. It never loads in the Edge middleware; it is
      // resolved from node_modules only when actually launching a browser (Node).
      const mod = ["playwright", "core"].join("-");
      const { chromium } = (await import(/* webpackIgnore: true */ mod)) as typeof import("playwright-core");
      return chromium.launch({
        headless: process.env.LINKEDIN_HEADFUL !== "true",
        executablePath: chromiumPath(),
      });
    })();
  }
  return browserPromise;
}

export async function getContext(): Promise<BrowserContext> {
  if (!contextPromise) {
    contextPromise = (async () => {
      const browser = await getBrowser();
      const context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: { width: 1280, height: 900 },
        locale: "ja-JP",
      });
      const cookie = liAt();
      if (cookie) {
        await context.addCookies([
          {
            name: "li_at",
            value: cookie,
            domain: ".linkedin.com",
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "None",
          },
        ]);
      }
      return context;
    })();
  }
  return contextPromise;
}

/** Run a task with a fresh page in the shared authenticated context. */
export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const context = await getContext();
  const page = await context.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}

/** Randomized pause to keep pacing human and stay well under rate limits. */
export function humanDelay(minMs = 900, maxMs = 2600): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((r) => setTimeout(r, ms));
}

export function isConfigured(): boolean {
  return Boolean(liAt());
}

/** Confirm the session cookie is still valid by loading the feed. */
export async function checkSession(): Promise<boolean> {
  return withPage(async (page) => {
    await page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    // Redirected to /login or /uas/login means the cookie is dead.
    return !/\/login|\/uas\/login|\/authwall/.test(page.url());
  });
}

export async function closeBrowser(): Promise<void> {
  try {
    const ctx = contextPromise ? await contextPromise : null;
    await ctx?.close();
    const br = browserPromise ? await browserPromise : null;
    await br?.close();
  } catch {
    /* ignore */
  } finally {
    contextPromise = null;
    browserPromise = null;
  }
}
