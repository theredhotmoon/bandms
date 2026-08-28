<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ModalShell from '@/components/ModalShell.vue'
import { useModalTrigger } from '@/composables/useModalTrigger'
import { requestBookingFor } from '@/stores/booking'

export interface AvailabilityCopy {
  title: string
  subtitle: string
  open: string
  booked: string
  held: string
  request: string
  pickPrompt: string
  close: string
  loadError: string
  // readonly, because Astro passes these straight from an `as const` object.
  months: readonly string[]
  weekdays: readonly string[]
}

const props = defineProps<{ copy: AvailabilityCopy; maxMonthsAhead?: number }>()

type Status = 'open' | 'held' | 'booked'

const MAX_AHEAD = props.maxMonthsAhead ?? 5

const { isOpen, close } = useModalTrigger('data-open-availability')

const monthOffset = ref(0)
const picked = ref<string | null>(null)
const loading = ref(false)
const failed = ref(false)

/** `YYYY-MM` → per-day status. Cached so re-visiting a month costs nothing. */
const cache = ref<Record<string, Record<string, Status>>>({})

// ── Date helpers ──────────────────────────────────────────────────────────────

// Midnight today, so "past" compares by day rather than by clock time.
const today = new Date()
today.setHours(0, 0, 0, 0)

const shown = computed(() => {
  const d = new Date(today.getFullYear(), today.getMonth() + monthOffset.value, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
})

const monthKey = computed(
  () => `${shown.value.year}-${String(shown.value.month + 1).padStart(2, '0')}`,
)

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const daysInMonth = computed(() =>
  new Date(shown.value.year, shown.value.month + 1, 0).getDate(),
)

/** Monday-first offset for the 1st of the shown month. */
const leadingBlanks = computed(
  () => (new Date(shown.value.year, shown.value.month, 1).getDay() + 6) % 7,
)

const statuses = computed(() => cache.value[monthKey.value] ?? {})

function statusFor(day: number): Status | 'past' | 'unknown' {
  const date = new Date(shown.value.year, shown.value.month, day)
  if (date < today) return 'past'
  // A failed fetch must not read as "free". Presenting every day as open and
  // letting it be picked is the same defect as the endpoint reporting dates it
  // never checked — the banner explains, and the grid stays unselectable.
  if (failed.value) return 'unknown'
  return statuses.value[iso(shown.value.year, shown.value.month, day)] ?? 'open'
}

const pickedLabel = computed(() => {
  if (!picked.value) return ''
  const [y, m, d] = picked.value.split('-').map(Number)
  return `${d} ${props.copy.months[m - 1]} ${y}`
})

// ── Data ──────────────────────────────────────────────────────────────────────

async function load() {
  if (cache.value[monthKey.value]) return

  loading.value = true
  failed.value = false

  const start = iso(shown.value.year, shown.value.month, 1)
  const end = iso(shown.value.year, shown.value.month, daysInMonth.value)

  try {
    const res = await fetch(
      `/api/band-profile/calendar/availability-range?start=${start}&end=${end}`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) throw new Error(String(res.status))

    const json = (await res.json()) as { data?: { date: string; status: Status }[] }
    const map: Record<string, Status> = {}
    for (const day of json.data ?? []) map[day.date] = day.status
    cache.value = { ...cache.value, [monthKey.value]: map }
  } catch {
    // The grid still renders — every day falls back to `open`, which is the
    // honest default when we cannot say otherwise. The banner says so.
    failed.value = true
  } finally {
    loading.value = false
  }
}

watch([isOpen, monthKey], () => {
  if (isOpen.value) void load()
})

// ── Actions ───────────────────────────────────────────────────────────────────

function pick(day: number) {
  if (statusFor(day) !== 'open') return
  picked.value = iso(shown.value.year, shown.value.month, day)
}

function submit() {
  if (!picked.value) return
  requestBookingFor(picked.value)
  close()
  document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <ModalShell
    :open="isOpen"
    :title="copy.title"
    :close-label="copy.close"
    :width="560"
    @close="close"
  >
    <p class="am-sub">{{ copy.subtitle }}</p>

    <p v-if="failed" class="am-warn" role="status">{{ copy.loadError }}</p>

    <div class="am-nav">
      <button
        type="button"
        class="am-arrow"
        :disabled="monthOffset <= 0"
        aria-label="Previous month"
        @click="monthOffset--"
      >‹</button>
      <span class="am-month" aria-live="polite">
        {{ copy.months[shown.month] }} {{ shown.year }}
      </span>
      <button
        type="button"
        class="am-arrow"
        :disabled="monthOffset >= MAX_AHEAD"
        aria-label="Next month"
        @click="monthOffset++"
      >›</button>
    </div>

    <div class="am-weekdays" aria-hidden="true">
      <span v-for="w in copy.weekdays" :key="w">{{ w }}</span>
    </div>

    <div class="am-grid" :class="{ 'is-loading': loading }">
      <span v-for="n in leadingBlanks" :key="`b${n}`" />
      <button
        v-for="d in daysInMonth"
        :key="d"
        type="button"
        class="am-day"
        :class="[`is-${statusFor(d)}`, { 'is-picked': picked === iso(shown.year, shown.month, d) }]"
        :disabled="statusFor(d) !== 'open'"
        :aria-pressed="picked === iso(shown.year, shown.month, d)"
        @click="pick(d)"
      >{{ d }}</button>
    </div>

    <div class="am-legend">
      <span><i class="am-key am-key--open" />{{ copy.open }}</span>
      <span><i class="am-key am-key--held" />{{ copy.held }}</span>
      <span><i class="am-key am-key--booked" />{{ copy.booked }}</span>
    </div>

    <div class="am-foot">
      <span class="am-picked" :class="{ 'is-empty': !picked }">
        {{ picked ? pickedLabel : copy.pickPrompt }}
      </span>
      <button type="button" class="am-request" :disabled="!picked" @click="submit">
        {{ copy.request }} →
      </button>
    </div>
  </ModalShell>
</template>

<style scoped>




.am-warn {
  margin: 0 0 16px;
  padding: 10px 12px;
  border: 2px solid var(--color-danger);
  font: 600 13px/1.4 var(--font-body);
  color: var(--color-danger);
}

.am-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.am-arrow {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-body);
  font-size: 18px;
  cursor: pointer;
}
.am-arrow:disabled {
  border-color: color-mix(in oklab, var(--color-ink) 20%, transparent);
  color: color-mix(in oklab, var(--color-ink) 20%, transparent);
  cursor: default;
}
.am-month {
  font: var(--display-weight) 30px/1 var(--font-display);
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
  white-space: nowrap;
}

.am-weekdays,
.am-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.am-weekdays {
  margin-bottom: 6px;
  text-align: center;
  font: 800 11px/1 var(--font-body);
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--color-subtle);
}

.am-grid.is-loading { opacity: .5; }

.am-day {
  height: 44px;
  display: grid;
  place-items: center;
  border: 2px solid transparent;
  background: none;
  font: 700 15px/1 var(--font-body);
  color: var(--color-body);
}
.am-day.is-open { border-color: var(--color-accent); cursor: pointer; }
.am-day.is-picked { background: var(--color-accent); color: var(--color-on-accent); }
.am-day.is-booked {
  background: var(--color-inverse);
  color: color-mix(in oklab, var(--color-on-inverse) 45%, transparent);
  text-decoration: line-through;
}
.am-day.is-held {
  background-image: repeating-linear-gradient(
    45deg,
    color-mix(in oklab, var(--color-ink) 16%, transparent) 0 4px,
    transparent 4px 8px
  );
  color: color-mix(in oklab, var(--color-ink) 55%, transparent);
}
.am-day.is-past { color: color-mix(in oklab, var(--color-ink) 20%, transparent); }
/* Availability could not be fetched — legible, but plainly not selectable. */
.am-day.is-unknown { color: color-mix(in oklab, var(--color-ink) 30%, transparent); }

.am-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin: 18px 0 6px;
  font: 700 12px/1 var(--font-body);
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--color-muted);
}
.am-legend span { display: inline-flex; align-items: center; gap: 7px; }
.am-key { width: 16px; height: 16px; display: block; }
.am-key--open { border: 2px solid var(--color-accent); }
.am-key--booked { background: var(--color-inverse); }
.am-key--held {
  border: 1px solid color-mix(in oklab, var(--color-ink) 30%, transparent);
  background-image: repeating-linear-gradient(
    45deg,
    color-mix(in oklab, var(--color-ink) 16%, transparent) 0 4px,
    transparent 4px 8px
  );
}

.am-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  border-top: var(--border-width-card) solid var(--color-border);
  margin-top: 14px;
  padding-top: 18px;
}
.am-picked { font: 600 16px/1.3 var(--font-body); color: var(--color-body); }
.am-picked.is-empty { color: var(--color-subtle); }

.am-request {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  border: none;
  font: var(--display-weight) 17px/1 var(--font-display);
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
  padding: 14px 22px;
  cursor: pointer;
  box-shadow: 5px 5px 0 var(--color-accent);
}
.am-request:disabled {
  background: color-mix(in oklab, var(--color-ink) 15%, transparent);
  color: color-mix(in oklab, var(--color-ink) 40%, transparent);
  box-shadow: none;
  cursor: default;
}

@media (max-width: 600px) {
  .am-month { font-size: 22px; }
  .am-day { height: 38px; font-size: 13px; }
}
</style>
