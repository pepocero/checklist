export interface PushSubscriptionJSON {
  endpoint: string
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

export interface StoredReminder {
  taskId: string
  listId: string
  text: string
  reminderAt: number
  subscription: PushSubscriptionJSON
}

export interface Env {
  REMINDERS: KVNamespace
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') ?? '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request),
    },
  })
}

export async function hashEndpoint(endpoint: string): Promise<string> {
  const data = new TextEncoder().encode(endpoint)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

export function subscriptionKey(hash: string): string {
  return `sub:${hash}`
}

export function reminderKey(taskId: string, hash: string): string {
  return `rem:${taskId}:${hash}`
}

export function isValidSubscription(
  value: unknown,
): value is PushSubscriptionJSON {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as PushSubscriptionJSON
  return (
    typeof candidate.endpoint === 'string' &&
    candidate.endpoint.length > 0 &&
    typeof candidate.keys?.p256dh === 'string' &&
    typeof candidate.keys?.auth === 'string'
  )
}
