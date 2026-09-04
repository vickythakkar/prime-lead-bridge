'use client';
import { useEffect, useState } from 'react';

export default function PushNotificationManager({ userType = 'broker', organizationId = null, authToken = null }) {
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermission(Notification.permission);
    
    async function registerAndSubscribe() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
  
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          await syncSubscription(existingSub);
          setSubscribed(true);
          return;
        }
  
        if (Notification.permission === 'default') {
          const perm = await Notification.requestPermission();
          setPermission(perm);
          if (perm !== 'granted') return;
        }
  
        if (Notification.permission === 'granted') {
          const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          const sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
          });
          await syncSubscription(sub);
          setSubscribed(true);
        }
      } catch (err) {
        console.error('Push registration error:', err);
      }
    }
    
    registerAndSubscribe();
  }, [organizationId, authToken, userType]);

  async function syncSubscription(sub) {
    const subJson = sub.toJSON();
    const headers = { 'Content-Type': 'application/json' };

    if (userType === 'admin') {
      headers['Authorization'] = `Bearer ${authToken || localStorage.getItem('admin_token')}`;
    } else {
      // For broker, get the supabase session token
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        if (session) headers['Authorization'] = `Bearer ${session.access_token}`;
      } catch (e) {
        console.error('Failed to get broker auth:', e);
      }
    }

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subscription: {
          endpoint: subJson.endpoint,
          keys: subJson.keys
        },
        user_type: userType,
        organization_id: organizationId
      })
    });
  }

  // Render nothing — this is a background-only component
  return null;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
