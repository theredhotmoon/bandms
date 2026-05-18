<script setup lang="ts">
import { ref } from 'vue'
import { API_BASE, jsonHeaders } from '@/api/client'

interface BusyMember { id: number; name: string; role: string | null }

interface AvailabilityResult {
  date: string
  available: boolean
  total_members: number
  busy_count: number
  busy_members: BusyMember[]
}

const date    = ref('')
const result  = ref<AvailabilityResult | null>(null)
const loading = ref(false)
const error   = ref<string | null>(null)

async function checkAvailability() {
  if (!date.value) return
  loading.value = true
  error.value   = null
  result.value  = null
  try {
    const res = await fetch(
      `${API_BASE}/api/band-profile/calendar/availability?date=${date.value}`,
      { headers: jsonHeaders }
    )
    if (!res.ok) throw new Error('Failed to check availability.')
    const json = await res.json() as { data: AvailabilityResult }
    result.value = json.data
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}
</script>

<template>
  <div class="booking-page">
    <header class="booking-header">
      <p class="booking-eyebrow">Booking</p>
      <h1 class="booking-title">Check Availability</h1>
      <p class="booking-sub">
        Enter a date to instantly see whether the band is available for a show or event.
      </p>
    </header>

    <div class="booking-body">
      <!-- Form -->
      <div class="booking-card">
        <label class="field-label">Select a date</label>
        <div class="date-row">
          <input
            v-model="date"
            type="date"
            class="date-input"
            :min="new Date().toISOString().slice(0,10)"
            @keyup.enter="checkAvailability"
          />
          <button
            class="btn-check"
            :disabled="!date || loading"
            @click="checkAvailability"
          >
            {{ loading ? 'Checking…' : 'Check' }}
          </button>
        </div>
        <p v-if="error" class="field-error">{{ error }}</p>
      </div>

      <!-- Result -->
      <Transition name="slide-up">
        <div v-if="result" class="result-card" :class="result.available ? 'result-ok' : 'result-busy'">
          <div class="result-icon">{{ result.available ? '✓' : '✕' }}</div>
          <div class="result-content">
            <div class="result-date">{{ formatDate(result.date) }}</div>
            <div class="result-status">
              {{ result.available ? 'Band is available' : 'Band is not available' }}
            </div>
            <div v-if="!result.available" class="result-detail">
              <span v-if="result.total_members === result.busy_count">
                All {{ result.total_members }} members are busy.
              </span>
              <span v-else>
                {{ result.busy_count }} of {{ result.total_members }} members are busy.
              </span>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Booking contact hint -->
      <div v-if="result?.available" class="booking-contact">
        <p class="contact-text">Great — the band appears to be free on this date.</p>
        <p class="contact-sub">Reach out to confirm and get a quote:</p>
        <a href="mailto:booking@example.com" class="contact-link">booking@example.com</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.booking-page {
  min-height: calc(100vh - 56px);
  background: #fff;
  color: #111;
}

/* ── Header ──────────────────────────────────────────────── */
.booking-header {
  padding: 4rem 1.5rem 3rem;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  max-width: 600px;
  margin: 0 auto;
}

.booking-eyebrow {
  font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: #888; margin-bottom: 0.75rem;
}

.booking-title {
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  font-weight: 700; color: #111; margin-bottom: 0.75rem; line-height: 1.2;
}

.booking-sub {
  font-size: 1rem; color: #555; line-height: 1.6;
}

/* ── Body ────────────────────────────────────────────────── */
.booking-body {
  max-width: 600px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.booking-card {
  background: #fafafa;
  border: 1px solid #e0e0e0;
  border-radius: 0.875rem;
  padding: 1.5rem;
}

.field-label {
  display: block;
  font-size: 0.75rem; font-weight: 600; letter-spacing: 0.05em;
  text-transform: uppercase; color: #888; margin-bottom: 0.75rem;
}

.date-row {
  display: flex; gap: 0.75rem; align-items: center;
}

.date-input {
  flex: 1;
  background: #fff; border: 1px solid #ddd; border-radius: 0.5rem;
  color: #111; padding: 0.625rem 0.875rem;
  font-size: 0.9375rem; outline: none;
  transition: border-color 150ms;
}
.date-input:focus { border-color: #888; }

.btn-check {
  padding: 0.625rem 1.375rem; border-radius: 0.5rem;
  font-size: 0.9375rem; font-weight: 600;
  background: #111; color: #fff; border: none; cursor: pointer;
  transition: background 150ms; white-space: nowrap;
}
.btn-check:hover:not(:disabled) { background: #333; }
.btn-check:disabled { opacity: 0.5; cursor: not-allowed; }

.field-error { margin-top: 0.5rem; font-size: 0.8125rem; color: #555; }

/* ── Result card ─────────────────────────────────────────── */
.result-card {
  border-radius: 0.875rem; padding: 1.5rem;
  display: flex; align-items: flex-start; gap: 1.25rem;
  border: 1px solid;
}
.result-ok   { background: #f0faf0; border-color: #bbb; }
.result-busy { background: #fdf0f0; border-color: #bbb; }

.result-icon {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.125rem; font-weight: 700; flex-shrink: 0;
}
.result-ok   .result-icon { background: #ddd; color: #111; }
.result-busy .result-icon { background: #ddd; color: #111; }

.result-date   { font-size: 0.8125rem; color: #888; margin-bottom: 0.25rem; }
.result-status { font-size: 1.0625rem; font-weight: 700; color: #111; }
.result-detail { font-size: 0.8125rem; color: #555; margin-top: 0.25rem; }

/* ── Contact hint ────────────────────────────────────────── */
.booking-contact {
  background: #fafafa; border: 1px solid #e0e0e0;
  border-radius: 0.875rem; padding: 1.5rem;
  text-align: center;
}
.contact-text { font-size: 0.9375rem; color: #111; margin-bottom: 0.25rem; }
.contact-sub  { font-size: 0.8125rem; color: #888; margin-bottom: 0.875rem; }
.contact-link {
  display: inline-block; padding: 0.5rem 1.25rem; border-radius: 0.5rem;
  font-size: 0.9375rem; font-weight: 600;
  background: #111; color: #fff; text-decoration: none;
  transition: background 150ms;
}
.contact-link:hover { background: #333; }

/* ── Transition ──────────────────────────────────────────── */
.slide-up-enter-active { transition: opacity 250ms, transform 250ms; }
.slide-up-enter-from  { opacity: 0; transform: translateY(8px); }
</style>
