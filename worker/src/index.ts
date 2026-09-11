import { sendWebPush } from './push'
import {
  corsHeaders,
  hashEndpoint,
  isValidSubscription,
  jsonResponse,
  reminderKey,
  subscriptionKey,
  type Env,
  type StoredReminder,
} from './types'

async function removeSubscriptionData(
  env: Env,
  endpoint: string,
): Promise<void> {
  const hash = await hashEndpoint(endpoint)
  await env.REMINDERS.delete(subscriptionKey(hash))

  const listed = await env.REMINDERS.list({ prefix: `rem:` })
  for (const key of listed.keys) {
    if (!key.name.endsWith(`:${hash}`)) {
      continue
    }
    await env.REMINDERS.delete(key.name)
  }
}

async function processDueReminders(env: Env): Promise<{ sent: number; failed: number }> {
  const now = Date.now()
  const listed = await env.REMINDERS.list({ prefix: 'rem:' })
  let sent = 0
  let failed = 0

  for (const entry of listed.keys) {
    const raw = await env.REMINDERS.get(entry.name)
    if (!raw) {
      continue
    }

    let reminder: StoredReminder
    try {
      reminder = JSON.parse(raw) as StoredReminder
    } catch {
      await env.REMINDERS.delete(entry.name)
      continue
    }

    if (typeof reminder.reminderAt !== 'number' || reminder.reminderAt > now) {
      continue
    }

    try {
      const result = await sendWebPush(env, reminder.subscription, {
        title: 'Recordatorio de tarea',
        body: reminder.text,
        url: `/lista/${reminder.listId}`,
        taskId: reminder.taskId,
        listId: reminder.listId,
      })

      if (result.gone) {
        await env.REMINDERS.delete(entry.name)
        await removeSubscriptionData(env, reminder.subscription.endpoint)
        continue
      }

      if (!result.ok) {
        failed += 1
        console.error('Push failed', entry.name, result.status)
        continue
      }

      await env.REMINDERS.delete(entry.name)
      sent += 1
    } catch (cause) {
      failed += 1
      console.error('Push error', entry.name, cause)
    }
  }

  return { sent, failed }
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }

  const url = new URL(request.url)

  if (request.method === 'GET' && url.pathname === '/health') {
    const listed = await env.REMINDERS.list({ prefix: 'rem:' })
    return jsonResponse(request, {
      ok: true,
      pushConfigured: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
      pendingReminders: listed.keys.length,
    })
  }

  // Disparo manual del mismo proceso que el cron (útil tras deploy / diagnóstico).
  if (request.method === 'POST' && url.pathname === '/process-due') {
    const result = await processDueReminders(env)
    return jsonResponse(request, { ok: true, ...result })
  }

  if (request.method === 'GET' && url.pathname === '/vapid-public-key') {
    if (!env.VAPID_PUBLIC_KEY) {
      return jsonResponse(request, { error: 'VAPID no configurado' }, 503)
    }
    return jsonResponse(request, { publicKey: env.VAPID_PUBLIC_KEY })
  }

  if (request.method === 'POST' && url.pathname === '/subscribe') {
    const body = (await request.json().catch(() => null)) as {
      subscription?: unknown
    } | null

    if (!body || !isValidSubscription(body.subscription)) {
      return jsonResponse(request, { error: 'Suscripción no válida' }, 400)
    }

    const hash = await hashEndpoint(body.subscription.endpoint)
    await env.REMINDERS.put(subscriptionKey(hash), JSON.stringify(body.subscription))
    return jsonResponse(request, { ok: true })
  }

  if (request.method === 'POST' && url.pathname === '/reminders') {
    const body = (await request.json().catch(() => null)) as {
      taskId?: unknown
      listId?: unknown
      text?: unknown
      reminderAt?: unknown
      subscription?: unknown
    } | null

    if (
      !body ||
      typeof body.taskId !== 'string' ||
      typeof body.listId !== 'string' ||
      typeof body.text !== 'string' ||
      typeof body.reminderAt !== 'number' ||
      !Number.isFinite(body.reminderAt) ||
      !isValidSubscription(body.subscription)
    ) {
      return jsonResponse(request, { error: 'Datos de recordatorio no válidos' }, 400)
    }

    if (body.reminderAt <= Date.now() - 30_000) {
      return jsonResponse(request, { error: 'La fecha debe ser futura' }, 400)
    }

    const hash = await hashEndpoint(body.subscription.endpoint)
    await env.REMINDERS.put(
      subscriptionKey(hash),
      JSON.stringify(body.subscription),
    )

    const reminder: StoredReminder = {
      taskId: body.taskId,
      listId: body.listId,
      text: body.text.trim() || 'Tarea pendiente',
      reminderAt: body.reminderAt,
      subscription: body.subscription,
    }

    await env.REMINDERS.put(
      reminderKey(body.taskId, hash),
      JSON.stringify(reminder),
    )

    return jsonResponse(request, { ok: true })
  }

  if (request.method === 'DELETE' && url.pathname === '/reminders') {
    const body = (await request.json().catch(() => null)) as {
      taskId?: unknown
      endpoint?: unknown
    } | null

    if (
      !body ||
      typeof body.taskId !== 'string' ||
      typeof body.endpoint !== 'string'
    ) {
      return jsonResponse(request, { error: 'Datos no válidos' }, 400)
    }

    const hash = await hashEndpoint(body.endpoint)
    await env.REMINDERS.delete(reminderKey(body.taskId, hash))
    return jsonResponse(request, { ok: true })
  }

  return jsonResponse(request, { error: 'No encontrado' }, 404)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env)
    } catch (cause) {
      console.error('Worker error', cause)
      return jsonResponse(request, { error: 'Error interno' }, 500)
    }
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    try {
      const result = await processDueReminders(env)
      console.log(`Reminders sent: ${result.sent}, failed: ${result.failed}`)
    } catch (cause) {
      console.error('Scheduled reminder processing failed', cause)
      throw cause
    }
  },
}
