import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-admin';

webpush.setVapidDetails(
  'mailto:info@primerealops.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function sendPushToOrg(orgId, payload) {
  try {
    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('organization_id', orgId);

    if (!subscriptions || subscriptions.length === 0) return;

    const notifications = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          JSON.stringify(payload)
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired or invalid — clean it up
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        }
        console.error('Push send error:', err.statusCode || err.message);
      }
    });

    await Promise.allSettled(notifications);
  } catch (err) {
    console.error('sendPushToOrg error:', err);
  }
}

export async function sendPushToAdmin(payload) {
  try {
    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_type', 'admin');

    if (!subscriptions || subscriptions.length === 0) return;

    const notifications = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          JSON.stringify(payload)
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        }
        console.error('Push send error:', err.statusCode || err.message);
      }
    });

    await Promise.allSettled(notifications);
  } catch (err) {
    console.error('sendPushToAdmin error:', err);
  }
}
