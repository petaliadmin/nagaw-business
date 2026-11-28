/**
 * Installing the application on the phone's home screen (PWA, ADR-020).
 *
 * Chrome and Edge (Android, computers) fire `beforeinstallprompt`: the
 * event is kept so that our own dialog, then a button of the menu, can
 * open the browser's installation. An iPhone has no such event: the
 * person is shown the taps to do for its browser (`iosGuide`). Once
 * installed, nothing is proposed any more.
 */

/** The non-standard event Chrome fires when the app can be installed. */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState =
  /** Opened from the home screen, or just installed. */
  | 'installed'
  /** The browser can install it at a tap. */
  | 'prompt'
  /** iPhone or iPad: install by hand from « Partager » (see `iosGuide`). */
  | 'ios'
  /** Nothing to offer (browser without installation, or not yet ready). */
  | 'unavailable';

/**
 * How to put the app on the home screen of an iPhone or iPad, which has no
 * installation event:
 * - `safari-26`: Safari of iOS 26 and later, « Partager » is under « … »;
 * - `safari`: older Safari, « Partager » in the bar at the bottom;
 * - `browser`: Chrome, Edge or Firefox, which add to the home screen too
 *   since iOS 17.4, from their own « Partager »;
 * - `in-app`: a page opened inside Facebook, Instagram, TikTok…, where the
 *   home screen is out of reach: open it in Safari first.
 */
export type IosGuide = 'safari-26' | 'safari' | 'browser' | 'in-app';

export function installState(environment: {
  standalone: boolean;
  installed: boolean;
  hasPrompt: boolean;
  userAgent: string;
  /** Touch points: an iPad presents itself as a Mac with a touch screen. */
  touchPoints?: number;
}): InstallState {
  if (environment.standalone || environment.installed) return 'installed';
  if (environment.hasPrompt) return 'prompt';
  if (iosGuide(environment.userAgent, environment.touchPoints ?? 0))
    return 'ios';
  return 'unavailable';
}

/** An iPhone, iPod or iPad, whatever the browser. */
export function isIos(userAgent: string, touchPoints = 0): boolean {
  return (
    /iPhone|iPad|iPod/.test(userAgent) ||
    // iPadOS presents itself as a Mac, with a touch screen.
    (/Macintosh/.test(userAgent) &&
      (touchPoints > 1 || /Mobile\//.test(userAgent)))
  );
}

/** The steps to show on this iPhone or iPad; null elsewhere. */
export function iosGuide(userAgent: string, touchPoints = 0): IosGuide | null {
  if (!isIos(userAgent, touchPoints)) return null;
  // Apps that open links in their own browser, with no home screen.
  if (
    /FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|BytedanceWebview|Snapchat|Line\/|LinkedInApp|Twitter|GSA\//.test(
      userAgent,
    )
  )
    return 'in-app';
  if (/CriOS|EdgiOS|FxiOS|OPiOS|DuckDuckGo|Brave/.test(userAgent))
    return 'browser';
  if (!/Safari\//.test(userAgent)) return 'in-app';
  // Since iOS 26 the system version is frozen in the user agent: Safari's
  // own version (`Version/26.0`) says which bar it has.
  const version = Number(/Version\/(\d+)/.exec(userAgent)?.[1] ?? 0);
  return version >= 26 ? 'safari-26' : 'safari';
}

/** Safari on iPhone or iPad. */
export function isIosSafari(userAgent: string, touchPoints = 0): boolean {
  const guide = iosGuide(userAgent, touchPoints);
  return guide === 'safari' || guide === 'safari-26';
}

// ---------------------------------------------------------------------------
// Browser state, shared by the dialog and the menu button
// ---------------------------------------------------------------------------

const DISMISSED_KEY = 'nagaw:install-dismissed';

let deferred: InstallPromptEvent | null = null;
let justInstalled = false;
let capturing = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

/**
 * Starts listening as early as possible (root layout): Chrome fires the
 * event once per page load, possibly before the space's code is loaded.
 */
export function captureInstallPrompt(): void {
  if (capturing || typeof window === 'undefined') return;
  capturing = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    // Our dialog asks first; the browser's mini-bar is not shown.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    justInstalled = true;
    changed();
  });
}

export function subscribeInstall(listener: () => void): () => void {
  captureInstallPrompt();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function standalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari on iPhone.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function currentInstallState(): InstallState {
  if (typeof window === 'undefined') return 'unavailable';
  return installState({
    standalone: standalone(),
    installed: justInstalled,
    hasPrompt: deferred !== null,
    userAgent: navigator.userAgent,
    touchPoints: navigator.maxTouchPoints,
  });
}

/** The steps for this iPhone or iPad, in the browser; null elsewhere. */
export function currentIosGuide(): IosGuide | null {
  if (typeof window === 'undefined') return null;
  return iosGuide(navigator.userAgent, navigator.maxTouchPoints);
}

/** Opens the browser's installation; true when the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  // The event can be used once: a refusal needs a new one from Chrome.
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  changed();
  return outcome === 'accepted';
}

/** The person closed our dialog: the menu button takes over. */
export function installDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch (error) {
    console.warn('Choix d’installation illisible', error);
    return false;
  }
}

export function dismissInstall(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch (error) {
    console.warn('Choix d’installation non conservé', error);
  }
  changed();
}
