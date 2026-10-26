'use client';

import { useEffect, useState, useTransition } from 'react';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { subscribePush, unsubscribePush } from '../actions';

type Status = 'checking' | 'unsupported' | 'denied' | 'off' | 'on';

/** The VAPID public key, base64url, as PushManager wants it. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Where this browser stands: able to receive, allowed, subscribed. */
async function detect(): Promise<Status> {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const registration = await navigator.serviceWorker.ready;
    return (await registration.pushManager.getSubscription()) ? 'on' : 'off';
  } catch (error) {
    console.error('État des notifications du téléphone illisible', error);
    return 'off';
  }
}

/**
 * Turns push messages on or off for this browser (ADR-036). The browser
 * asks the person first; the subscription goes to the server, which only
 * sends what the person chose below.
 */
export function PushSwitch({ publicKey }: { publicKey: string | null }) {
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    void detect().then((found) => {
      if (!cancelled) setStatus(found);
    });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  if (!publicKey)
    return (
      <Alert>
        Les notifications sur le téléphone ne sont pas encore activées pour
        Nagaw Business. Vous les retrouvez ici, dans l’application.
      </Alert>
    );
  if (status === 'checking')
    return <p role="status">Vérification de ce téléphone…</p>;
  if (status === 'unsupported')
    return (
      <Alert tone="warning">
        Ce navigateur ne reçoit pas de notifications. Sur iPhone, ajoutez
        d’abord Nagaw Business à l’écran d’accueil, puis ouvrez-le depuis
        l’icône.
      </Alert>
    );
  if (status === 'denied')
    return (
      <Alert tone="warning">
        Les notifications sont bloquées pour ce site. Autorisez-les dans les
        réglages du navigateur, puis rechargez la page.
      </Alert>
    );

  function turnOn(key: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setStatus(permission === 'denied' ? 'denied' : 'off');
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyBytes(key),
          }));
        const json = subscription.toJSON();
        const saved = await subscribePush({
          endpoint: json.endpoint,
          keys: json.keys,
          label: navigator.userAgent.slice(0, 120),
        });
        if (!saved.ok) {
          await subscription.unsubscribe();
          setMessage(saved.message);
          return;
        }
        setStatus('on');
        setMessage('C’est fait : ce téléphone recevra vos notifications.');
      } catch (error) {
        console.error('Activation des notifications impossible', error);
        setMessage(
          'Activation impossible sur ce téléphone. Vérifiez la connexion et réessayez.',
        );
      }
    });
  }

  function turnOff() {
    setMessage(null);
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const removed = await unsubscribePush(subscription.endpoint);
          if (!removed.ok) {
            setMessage(removed.message);
            return;
          }
          await subscription.unsubscribe();
        }
        setStatus('off');
        setMessage('Ce téléphone ne recevra plus de notifications.');
      } catch (error) {
        console.error('Arrêt des notifications impossible', error);
        setMessage('Arrêt impossible. Réessayez avec une connexion.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p>
        {status === 'on'
          ? 'Ce téléphone reçoit vos notifications, même quand l’application est fermée.'
          : 'Recevez vos notifications sur ce téléphone, même quand l’application est fermée.'}
      </p>
      <div aria-live="polite">{message && <Alert>{message}</Alert>}</div>
      <button
        type="button"
        disabled={pending}
        onClick={() => (status === 'on' ? turnOff() : turnOn(publicKey))}
        className={`${buttonClasses(status === 'on' ? 'secondary' : 'primary')} self-start`}
      >
        {pending
          ? 'Un instant…'
          : status === 'on'
            ? 'Ne plus recevoir sur ce téléphone'
            : 'Recevoir sur ce téléphone'}
      </button>
    </div>
  );
}
