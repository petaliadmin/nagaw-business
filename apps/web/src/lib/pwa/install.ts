/**
 * Installing the application on the phone's home screen (PWA, ADR-020).
 *
 * Chrome and Edge (Android, computers) fire `beforeinstallprompt`: the
 * event is kept so that our own dialog, then a button of the menu, can
 * open the browser's installation. Safari on iPhone has no such event:
 * the person is shown the two taps to do (Partager, Sur l'écran
 * d'accueil). Once installed, nothing is proposed any more.
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
  /** iPhone or iPad Safari: install by hand from « Partager ». */
  | 'ios'
  /** Nothing to offer (browser without installation, or not yet ready). */
  | 'unavailable';

export function installState(environment: {
  standalone: boolean;
  installed: boolean;
  hasPrompt: boolean;
  userAgent: string;
}): InstallState {
  if (environment.standalone || environment.installed) return 'installed';
  if (environment.hasPrompt) return 'prompt';
  if (isIosSafari(environment.userAgent)) return 'ios';
  return 'unavailable';
}

/** Safari on iPhone or iPad (other iOS browsers cannot install a PWA). */
export function isIosSafari(userAgent: string): boolean {
  const ios =
    /iPhone|iPad|iPod/.test(userAgent) ||
    // iPadOS presents itself as a Mac with a touch screen.
    (/Macintosh/.test(userAgent) && /Mobile\//.test(userAgent));
  return (
    ios && /Safari\//.test(userAgent) && !/CriOS|FxiOS|EdgiOS/.test(userAgent)
  );
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
  });
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
