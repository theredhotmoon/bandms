<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { bookingRequest, clearBookingRequest, type BookingRequest } from '@/stores/booking'

/**
 * Copy is passed in from Astro rather than held here, so the island ships one
 * language instead of both and the strings stay editable from the CMS.
 */
export interface ContactFormCopy {
  title: string
  subtitle: string
  reasonLabel: string
  reasons: { value: Reason; label: string }[]
  name: string
  namePlaceholder: string
  email: string
  emailPlaceholder: string
  subject: string
  subjectPlaceholder: string
  message: string
  messagePlaceholder: string
  send: string
  sending: string
  sent: string
  sendAnother: string
  error: string
  replyNote: string
  /**
   * Subject pre-filled when a date is picked in the availability calendar.
   * `{date}` is replaced with the formatted date.
   *
   * A template string rather than a formatter function: Astro serialises island
   * props to JSON, so a function prop throws at build time.
   */
  bookingSubject: string
  /**
   * Used instead of `bookingSubject` when the visitor confirmed a date the
   * calendar had marked booked or held, so the clash is visible in the band's
   * inbox without opening the message.
   */
  bookingSubjectUnavailable: string
  /** BCP-47 tag used to format that date. */
  locale: string
}

type Reason = 'general' | 'booking' | 'press' | 'other'

const props = defineProps<{ copy: ContactFormCopy }>()

const reason = ref<Reason>('general')
const form = reactive({ name: '', email: '', subject: '', message: '' })
// Bots fill a hidden field humans never see; the API treats a filled `website`
// as spam and fakes success rather than telling the bot it was caught.
const honeypot = ref('')

const status = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')
const errorMsg = ref('')

async function submit() {
  if (status.value === 'sending') return

  if (!form.name.trim() || !form.email.includes('@') || !form.message.trim()) {
    status.value = 'error'
    errorMsg.value = props.copy.error
    return
  }

  status.value = 'sending'
  errorMsg.value = ''

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      // `reason` and `website` are both required by ContactController. Omitting
      // reason is what made every submission from this page 422 — the field was
      // added to the API and never to this form, and no type system spans the
      // gap between a fetch body and a Laravel validate() array.
      body: JSON.stringify({
        reason: reason.value,
        name: form.name,
        email: form.email,
        subject: form.subject,
        message: form.message,
        website: honeypot.value,
      }),
    })

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      throw new Error(data.message ?? props.copy.error)
    }

    status.value = 'sent'
  } catch (e) {
    status.value = 'error'
    errorMsg.value = e instanceof Error ? e.message : props.copy.error
  }
}

// ── Availability calendar handoff ─────────────────────────────────────────────

let unsubscribe: (() => void) | null = null

/**
 * The calendar is a separate island, so it hands the picked date over through a
 * nanostore rather than a prop. Picking a date pre-fills this form instead of
 * submitting anything: the calendar collects no name or email, and a one-click
 * anonymous enquiry would be unanswerable and trivially spammable.
 */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  try {
    return new Intl.DateTimeFormat(props.copy.locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(y, m - 1, d))
  } catch {
    // An unknown locale tag throws rather than falling back; the ISO date is
    // still a perfectly readable subject line.
    return iso
  }
}

function applyBooking(request: BookingRequest | null) {
  if (!request) return
  const { date, unavailable } = request

  reason.value = 'booking'
  const template = unavailable
    ? props.copy.bookingSubjectUnavailable
    : props.copy.bookingSubject
  form.subject = template.replace('{date}', formatDate(date))
  // Consume it, so picking the same date twice fires again.
  clearBookingRequest()

  if (status.value === 'sent') status.value = 'idle'

  void nextTick(() => {
    const name = document.getElementById('cf-name') as HTMLInputElement | null
    name?.focus({ preventScroll: true })
  })
}

onMounted(() => {
  unsubscribe = bookingRequest.subscribe(applyBooking)
})

onUnmounted(() => {
  unsubscribe?.()
})

function reset() {
  form.name = ''
  form.email = ''
  form.subject = ''
  form.message = ''
  reason.value = 'general'
  status.value = 'idle'
  errorMsg.value = ''
}
</script>

<template>
  <div class="cf">
    <div class="cf-head">
      <div class="cf-mark" aria-hidden="true" />
      <div>
        <h2 class="cf-title">{{ copy.title }}</h2>
        <p class="cf-sub">{{ copy.subtitle }}</p>
      </div>
    </div>

    <div v-if="status === 'sent'" class="cf-done">
      <div class="cf-tick" aria-hidden="true">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12l4.5 4.5L19 6" />
        </svg>
      </div>
      <p class="cf-done-msg" role="status">{{ copy.sent }}</p>
      <button type="button" class="cf-again" @click="reset">{{ copy.sendAnother }}</button>
    </div>

    <form v-else class="cf-body" novalidate @submit.prevent="submit">
      <div>
        <span class="cf-label" id="cf-reason-label">{{ copy.reasonLabel }}</span>
        <div class="cf-reasons" role="group" aria-labelledby="cf-reason-label">
          <button
            v-for="r in copy.reasons"
            :key="r.value"
            type="button"
            class="cf-reason"
            :class="{ 'is-on': reason === r.value }"
            :aria-pressed="reason === r.value"
            @click="reason = r.value"
          >{{ r.label }}</button>
        </div>
      </div>

      <div class="cf-pair">
        <div>
          <label class="cf-label" for="cf-name">{{ copy.name }}</label>
          <input id="cf-name" v-model="form.name" class="cf-input" type="text"
                 autocomplete="name" :placeholder="copy.namePlaceholder" />
        </div>
        <div>
          <label class="cf-label" for="cf-email">{{ copy.email }}</label>
          <input id="cf-email" v-model="form.email" class="cf-input" type="email"
                 autocomplete="email" :placeholder="copy.emailPlaceholder" />
        </div>
      </div>

      <div>
        <label class="cf-label" for="cf-subject">{{ copy.subject }}</label>
        <input id="cf-subject" v-model="form.subject" class="cf-input" type="text"
               :placeholder="copy.subjectPlaceholder" />
      </div>

      <div>
        <label class="cf-label" for="cf-message">{{ copy.message }}</label>
        <textarea id="cf-message" v-model="form.message" class="cf-input cf-textarea"
                  rows="6" :placeholder="copy.messagePlaceholder" />
      </div>

      <!-- Off-screen rather than display:none — some bots skip hidden fields. -->
      <div class="cf-hp" aria-hidden="true">
        <label for="cf-website">Website</label>
        <input id="cf-website" v-model="honeypot" type="text" tabindex="-1" autocomplete="off" />
      </div>

      <p v-if="status === 'error'" class="cf-error" role="alert">
        <span class="cf-error-mark" aria-hidden="true" />{{ errorMsg || copy.error }}
      </p>

      <div class="cf-foot">
        <span class="cf-reply">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)"
               stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M4 7l8 6 8-6" />
          </svg>
          {{ copy.replyNote }}
        </span>
        <button type="submit" class="cf-send" :disabled="status === 'sending'">
          {{ status === 'sending' ? copy.sending : copy.send }}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.cf {
  border: var(--border-width-emphasis) solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-emphasis);
}

.cf-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 22px 28px;
  background: var(--color-inverse);
  color: var(--color-on-inverse);
}

/* The card-mark ornament, inlined rather than slotted: it sits inside an island
   that Astro cannot render server components into. */
.cf-mark {
  width: 30px;
  height: 30px;
  flex: none;
  border: 2px solid var(--color-on-inverse);
  background-image: repeating-conic-gradient(var(--color-accent) 0% 25%, var(--color-on-inverse) 0% 50%);
  background-size: 10px 10px;
}

.cf-title {
  margin: 0;
  font: var(--display-weight) 30px/1 var(--font-display);
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
}
.cf-sub {
  margin: 6px 0 0;
  font: 500 13px/1.4 var(--font-body);
  color: color-mix(in oklab, var(--color-on-inverse) 70%, transparent);
}

.cf-body { display: flex; flex-direction: column; gap: 22px; padding: 28px 28px 30px; }

.cf-label {
  display: block;
  margin-bottom: 9px;
  font: 800 11px/1 var(--font-body);
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.cf-reasons { display: flex; flex-wrap: wrap; gap: 9px; }
.cf-reason {
  border: 2.5px solid var(--color-border);
  background: transparent;
  color: var(--color-body);
  font: 800 12px/1 var(--font-body);
  letter-spacing: .06em;
  text-transform: uppercase;
  padding: 11px 16px;
  cursor: pointer;
  transition: box-shadow .12s, background .12s, color .12s;
}
.cf-reason.is-on {
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  box-shadow: 4px 4px 0 var(--color-accent);
}

.cf-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }

.cf-input {
  width: 100%;
  box-sizing: border-box;
  border: var(--border-width-card) solid var(--color-border);
  background: var(--color-surface-2);
  padding: 14px 16px;
  font: 600 16px/1.3 var(--font-body);
  color: var(--color-body);
  outline: none;
  border-radius: var(--radius-card);
}
.cf-input::placeholder { color: var(--color-subtle); }
.cf-input:focus-visible { box-shadow: 0 0 0 3px var(--color-accent); }
.cf-textarea { resize: vertical; min-height: 130px; line-height: 1.5; }

/* Visually gone but still focusable and submitted, unlike display:none. */
.cf-hp {
  position: absolute;
  width: 1px; height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.cf-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font: 600 14px/1.4 var(--font-body);
  color: var(--color-danger);
}
.cf-error-mark { width: 8px; height: 8px; flex: none; background: var(--color-danger); }

.cf-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.cf-reply {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: 600 13px/1.3 var(--font-body);
  color: var(--color-muted);
}

.cf-send {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: var(--color-accent);
  color: var(--color-on-accent);
  border: none;
  font: var(--display-weight) 20px/1 var(--font-display);
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
  padding: 16px 28px;
  cursor: pointer;
  box-shadow: var(--shadow-card);
}
.cf-send:disabled { opacity: .6; cursor: default; }

.cf-done { padding: 56px 36px; text-align: center; }
.cf-tick {
  width: 70px; height: 70px;
  margin: 0 auto 24px;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-on-accent);
  display: grid;
  place-items: center;
  box-shadow: 5px 5px 0 var(--color-ink);
}
.cf-done-msg {
  margin: 0 auto 22px;
  max-width: 460px;
  font: var(--display-weight) 30px/1.05 var(--font-display);
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
}
.cf-again {
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  border: none;
  font: var(--display-weight) 16px/1 var(--font-display);
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
  padding: 13px 22px;
  cursor: pointer;
  box-shadow: 5px 5px 0 var(--color-accent);
}

@media (max-width: 700px) {
  .cf-pair { grid-template-columns: 1fr; }
  .cf-head, .cf-body { padding-inline: 18px; }
}
</style>
