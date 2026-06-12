import { supabase } from './supabaseClient';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
};

export const isPushSupported = () =>
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window;

export const registerPartnerPush = async (bodyshopId: string): Promise<{ ok: boolean; error?: string }> => {
  if (!isPushSupported()) {
    return { ok: false, error: 'Push notifications are not supported in this browser.' };
  }

  const vapidPublicKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey) {
    return { ok: false, error: 'Push is not configured yet (missing VITE_VAPID_PUBLIC_KEY).' };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, error: 'Notification permission was denied.' };
  }

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, error: 'Could not read push subscription keys.' };
  }

  const { error } = await supabase.rpc('save_partner_push_subscription' as any, {
    p_bodyshop_id: bodyshopId,
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
};

export const unregisterPartnerPush = async (): Promise<void> => {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  await subscription?.unsubscribe();
};
