<script setup lang="ts">
import { computed, ref } from 'vue'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { CalendarOptions, EventClickArg } from '@fullcalendar/core'
import type { EventSourceFuncArg } from '@fullcalendar/core'
import { useAuth } from '@/composables/useAuth'
import { useBandMembers } from '@/composables/useBandMembers'
import { API_BASE, authHeaders } from '@/api/client'
import type { BandMember } from '@/types/bandMember'

const { token } = useAuth()
const { query: membersQuery } = useBandMembers()

// members that have a calendar_url
const calendarMembers = computed(() =>
  (membersQuery.data.value ?? []).filter((m: BandMember) => m.is_current && m.calendar_url)
)

const COLORS = ['#888888', '#f59e0b', '#10b981', '#f43f5e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

// ── Selected event popup ──────────────────────────────────────────
interface SelectedEvent {
  title: string
  start: string
  end: string | null
  allDay: boolean
  memberName: string
  memberRole: string | null
  description: string | null
  color: string
}
const selected = ref<SelectedEvent | null>(null)

function onEventClick(arg: EventClickArg) {
  const e = arg.event
  selected.value = {
    title:       e.title,
    start:       e.startStr,
    end:         e.endStr || null,
    allDay:      e.allDay,
    memberName:  e.extendedProps.memberName as string,
    memberRole:  e.extendedProps.memberRole as string | null,
    description: e.extendedProps.description as string | null,
    color:       (e.backgroundColor || '#888888'),
  }
}

function formatDateRange(start: string, end: string | null, allDay: boolean): string {
  const s = new Date(start)
  if (!end) return allDay ? s.toLocaleDateString() : s.toLocaleString()
  const e = new Date(end)
  if (allDay) {
    const adjustedEnd = new Date(e.getTime() - 86400000)
    return s.toDateString() === adjustedEnd.toDateString()
      ? s.toLocaleDateString()
      : `${s.toLocaleDateString()} – ${adjustedEnd.toLocaleDateString()}`
  }
  return `${s.toLocaleString()} – ${e.toLocaleTimeString()}`
}

// ── FullCalendar options ──────────────────────────────────────────
const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left:   'prev,next today',
    center: 'title',
    right:  'dayGridMonth,timeGridWeek,listMonth',
  },
  height: 'auto',
  nowIndicator: true,
  eventClick: onEventClick,
  events: async (info: EventSourceFuncArg, successCb: (e: object[]) => void, failureCb: (e: Error) => void) => {
    if (!token.value) return
    try {
      const start = info.startStr.slice(0, 10)
      const end   = info.endStr.slice(0, 10)
      const res   = await fetch(
        `${API_BASE}/api/band-profile/calendar/events?start=${start}&end=${end}`,
        { headers: authHeaders(token.value) }
      )
      const json = await res.json() as { data: object[] }
      successCb(json.data)
    } catch (e) {
      failureCb(e as Error)
    }
  },
  eventDisplay: 'block',
  displayEventTime: true,
  noEventsContent: 'No events – make sure members have a Calendar URL set in their profile.',
}))
</script>

<template>
  <AdminLayout>
  <div class="cal-page">
    <div class="cal-header">
      <div>
        <h1 class="cal-title">Band Calendar</h1>
        <p class="cal-sub">All active members' Google Calendars in one view.</p>
      </div>
    </div>

    <!-- Member legend -->
    <div v-if="calendarMembers.length" class="cal-legend">
      <div v-for="(m, i) in calendarMembers" :key="m.id" class="legend-item">
        <span class="legend-dot" :style="`background:${COLORS[i % COLORS.length]}`" />
        <span class="legend-name">{{ m.first_name }} {{ m.last_name }}</span>
        <span v-if="m.role" class="legend-role">{{ m.role }}</span>
      </div>
    </div>
    <div v-else-if="!membersQuery.isPending.value" class="cal-notice">
      No active members have a Calendar URL configured. Add one under <strong>Band Members</strong>.
    </div>

    <!-- Calendar -->
    <div class="cal-wrap">
      <FullCalendar :options="calendarOptions" />
    </div>

    <!-- Event detail modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="selected" class="ev-backdrop" @click.self="selected = null">
          <div class="ev-modal">
            <div class="ev-accent" :style="`background:${selected.color}`" />
            <div class="ev-body">
              <button class="ev-close" @click="selected = null">✕</button>
              <div class="ev-meta">
                <span class="ev-member" :style="`color:${selected.color}`">
                  {{ selected.memberName }}<span v-if="selected.memberRole"> · {{ selected.memberRole }}</span>
                </span>
              </div>
              <h3 class="ev-title">{{ selected.title }}</h3>
              <p class="ev-date">{{ formatDateRange(selected.start, selected.end, selected.allDay) }}</p>
              <p v-if="selected.description" class="ev-desc">{{ selected.description }}</p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
  </AdminLayout>
</template>

<style scoped>
.cal-page {
  padding: 1.75rem 2rem;
  max-width: 1100px;
}

.cal-header {
  margin-bottom: 1.25rem;
}

.cal-title { font-size: 1.375rem; font-weight: 700; color: #f1f5f9; margin-bottom: 0.25rem; }
.cal-sub   { font-size: 0.8125rem; color: #64748b; }

/* ── Legend ────────────────────────────────────────────────── */
.cal-legend {
  display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem;
  margin-bottom: 1.25rem;
}
.legend-item { display: flex; align-items: center; gap: 0.4rem; }
.legend-dot  { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.legend-name { font-size: 0.8125rem; font-weight: 600; color: #e2e8f0; }
.legend-role { font-size: 0.7rem; color: #64748b; }

.cal-notice {
  background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 0.5rem;
  padding: 1rem 1.25rem; font-size: 0.8125rem; color: #64748b;
  margin-bottom: 1.25rem;
}

/* ── Calendar wrap ─────────────────────────────────────────── */
.cal-wrap {
  background: #141414;
  border: 1px solid #2a2a2a;
  border-radius: 0.75rem;
  padding: 1rem;
  overflow: hidden;
}

/* ── FullCalendar theme overrides ──────────────────────────── */
:deep(.fc) {
  color: #e2e8f0;
  font-family: inherit;
}
:deep(.fc-theme-standard td),
:deep(.fc-theme-standard th),
:deep(.fc-theme-standard .fc-scrollgrid) {
  border-color: #2a2a2a;
}
:deep(.fc-col-header-cell-cushion),
:deep(.fc-daygrid-day-number) {
  color: #94a3b8;
  text-decoration: none;
}
:deep(.fc-daygrid-day-number:hover) { color: #e0e0e0; }
:deep(.fc-day-today) { background: #1a1a1a !important; }
:deep(.fc-day-today .fc-daygrid-day-number) { color: #d0d0d0; font-weight: 700; }
:deep(.fc-button-primary) {
  background: #2a2a2a !important; border-color: #444444 !important;
  color: #d0d0d0 !important; font-size: 0.8125rem !important;
  transition: background 150ms !important;
}
:deep(.fc-button-primary:hover) { background: #333333 !important; }
:deep(.fc-button-primary:not(:disabled).fc-button-active) {
  background: #888888 !important; border-color: #888888 !important;
}
:deep(.fc-toolbar-title) { font-size: 1.0625rem !important; font-weight: 700 !important; color: #f1f5f9 !important; }
:deep(.fc-event) { cursor: pointer; border-radius: 3px !important; border: none !important; font-size: 0.75rem !important; }
:deep(.fc-list-event:hover td) { background: #1a1a1a !important; }
:deep(.fc-list-day-cushion) { background: #141414 !important; }
:deep(.fc-list-day-text), :deep(.fc-list-day-side-text) { color: #94a3b8 !important; text-decoration: none; }
:deep(.fc-popover) { background: #141414 !important; border-color: #2a2a2a !important; }
:deep(.fc-popover-title) { background: #1a1a1a !important; color: #e2e8f0 !important; }
:deep(.fc-more-popover .fc-popover-body) { background: #141414 !important; }
:deep(.fc-daygrid-more-link) { color: #888888 !important; }
:deep(.fc-timegrid-slot) { border-color: #2a2a2a !important; height: 2rem !important; }
:deep(.fc-timegrid-axis-cushion) { color: #475569 !important; font-size: 0.7rem !important; }
:deep(.fc-now-indicator-line) { border-color: #f87171 !important; }

/* ── Event modal ───────────────────────────────────────────── */
.ev-backdrop {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}
.ev-modal {
  background: #141414; border: 1px solid #2a2a2a;
  border-radius: 0.875rem; width: 100%; max-width: 420px;
  overflow: hidden; display: flex; flex-direction: column;
}
.ev-accent { height: 4px; }
.ev-body { padding: 1.25rem 1.5rem 1.5rem; position: relative; }
.ev-close {
  position: absolute; top: 0.875rem; right: 1rem;
  background: none; border: none; color: #64748b;
  font-size: 0.875rem; cursor: pointer; padding: 0.25rem;
  transition: color 120ms;
}
.ev-close:hover { color: #f87171; }
.ev-meta   { margin-bottom: 0.5rem; }
.ev-member { font-size: 0.75rem; font-weight: 600; }
.ev-title  { font-size: 1.0625rem; font-weight: 700; color: #f1f5f9; margin-bottom: 0.375rem; }
.ev-date   { font-size: 0.8125rem; color: #64748b; margin-bottom: 0.75rem; }
.ev-desc   { font-size: 0.875rem; color: #94a3b8; line-height: 1.6; }

.fade-enter-active, .fade-leave-active { transition: opacity 150ms; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
