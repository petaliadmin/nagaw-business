import type { BrowserContext } from '@playwright/test';

const BACKEND = 'http://localhost:54400';

export type FakeUser = 'awa' | 'moussa' | 'binta' | 'broken';

/** Signs the browser context in as a fake user with a real signed JWT. */
export async function signInAs(
  context: BrowserContext,
  user: FakeUser,
  baseURL: string,
) {
  const response = await fetch(`${BACKEND}/__test/session?user=${user}`);
  const cookie = (await response.json()) as { name: string; value: string };
  await context.addCookies([{ ...cookie, url: baseURL }]);
}

export async function resetBackend() {
  await fetch(`${BACKEND}/__test/reset`);
}
