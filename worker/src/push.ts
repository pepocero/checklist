import { ApplicationServerKeys, generatePushHTTPRequest } from 'webpush-webcrypto'
import type { Env, PushSubscriptionJSON } from './types'

export async function sendWebPush(
  env: Env,
  subscription: PushSubscriptionJSON,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; gone: boolean }> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    throw new Error('VAPID keys missing')
  }

  const applicationServerKeys = await ApplicationServerKeys.fromJSON({
    publicKey: env.VAPID_PUBLIC_KEY.trim(),
    privateKey: env.VAPID_PRIVATE_KEY.trim(),
  })

  const { headers, body, endpoint } = await generatePushHTTPRequest({
    applicationServerKeys,
    payload: JSON.stringify(payload),
    target: {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    },
    adminContact: env.VAPID_SUBJECT || 'mailto:contacto@carlinitools.com',
    ttl: 60 * 60,
    urgency: 'high',
  })

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body,
  })

  return {
    ok: response.ok,
    status: response.status,
    gone: response.status === 404 || response.status === 410,
  }
}
