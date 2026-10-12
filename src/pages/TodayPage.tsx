import { Bell, CalendarClock, ListChecks } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { getListsWithReminders, getUpcomingReminderItems } from '../services/database'
import type { Task, TaskList } from '../types'

type TodayTab = 'today' | 'upcoming'

type ReminderEntry =
  | { type: 'task'; task: Task; list: TaskList; at: number }
  | { type: 'list'; list: TaskList; at: number }

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function endOfLocalDay(date: Date): number {
  return startOfLocalDay(date) + 24 * 60 * 60 * 1000 - 1
}

function formatReminderTime(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('es', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp))
  } catch {
    return new Date(timestamp).toLocaleString()
  }
}

export function TodayPage() {
  const [tab, setTab] = useState<TodayTab>('today')
  const [entries, setEntries] = useState<ReminderEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const [taskItems, lists] = await Promise.all([
          getUpcomingReminderItems(),
          getListsWithReminders(),
        ])
        const next: ReminderEntry[] = [
          ...taskItems.map(({ task, list }) => ({
            type: 'task' as const,
            task,
            list,
            at: task.reminderAt as number,
          })),
          ...lists.map((list) => ({
            type: 'list' as const,
            list,
            at: list.reminderAt as number,
          })),
        ].sort((a, b) => a.at - b.at)
        setEntries(next)
        setError(null)
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : 'No se pudieron cargar los recordatorios.'
        setError(message)
      } finally {
        setIsReady(true)
      }
    })()
  }, [])

  const { todayItems, upcomingItems } = useMemo(() => {
    const now = new Date()
    const dayStart = startOfLocalDay(now)
    const dayEnd = endOfLocalDay(now)

    const today: ReminderEntry[] = []
    const upcoming: ReminderEntry[] = []

    for (const item of entries) {
      if (item.at >= dayStart && item.at <= dayEnd) {
        today.push(item)
      } else if (item.at > dayEnd) {
        upcoming.push(item)
      }
    }

    return { todayItems: today, upcomingItems: upcoming }
  }, [entries])

  const visible = tab === 'today' ? todayItems : upcomingItems

  return (
    <section className="page">
      <AppHeader
        title="Hoy y próximos"
        subtitle="Tareas y listas con recordatorio"
        backTo="/app"
      />

      <div className="backup-tabs today-tabs" role="tablist" aria-label="Periodo">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'today'}
          className={`backup-tab${tab === 'today' ? ' is-active' : ''}`}
          onClick={() => setTab('today')}
        >
          <CalendarClock size={18} strokeWidth={2.2} aria-hidden="true" />
          <span>Hoy ({todayItems.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upcoming'}
          className={`backup-tab${tab === 'upcoming' ? ' is-active' : ''}`}
          onClick={() => setTab('upcoming')}
        >
          <Bell size={18} strokeWidth={2.2} aria-hidden="true" />
          <span>Próximos ({upcomingItems.length})</span>
        </button>
      </div>

      {error ? <p className="banner error">{error}</p> : null}

      {isReady && visible.length === 0 ? (
        <div className="empty-state">
          <CalendarClock size={42} strokeWidth={1.7} aria-hidden="true" />
          <h2>{tab === 'today' ? 'Nada para hoy' : 'Nada próximo'}</h2>
          <p>
            {tab === 'today'
              ? 'No hay recordatorios programados para hoy.'
              : 'No hay recordatorios futuros después de hoy.'}
          </p>
        </div>
      ) : (
        <div className="today-list">
          {visible.map((item) =>
            item.type === 'task' ? (
              <Link
                key={`task-${item.task.id}`}
                to={`/lista/${item.list.id}`}
                className="today-item"
              >
                <div className="today-item-body">
                  <strong>{item.task.text}</strong>
                  <span>{item.list.name}</span>
                </div>
                <time dateTime={new Date(item.at).toISOString()}>
                  {formatReminderTime(item.at)}
                </time>
              </Link>
            ) : (
              <Link
                key={`list-${item.list.id}`}
                to={`/lista/${item.list.id}`}
                className="today-item today-item-list"
              >
                <div className="today-item-body">
                  <strong>
                    <ListChecks size={16} strokeWidth={2.2} aria-hidden="true" />{' '}
                    {item.list.name}
                  </strong>
                  <span>Recordatorio de lista</span>
                </div>
                <time dateTime={new Date(item.at).toISOString()}>
                  {formatReminderTime(item.at)}
                </time>
              </Link>
            ),
          )}
        </div>
      )}
    </section>
  )
}
