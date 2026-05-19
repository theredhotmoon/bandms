<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { fetchEpk } from '@/api/bandProfile'
import { API_BASE, jsonHeaders } from '@/api/client'
import NewsletterSignup from '@/components/NewsletterSignup.vue'

const epkQuery = useQuery({ queryKey: ['epk'], queryFn: fetchEpk })
const epk      = computed(() => epkQuery.data.value ?? null)

const PLATFORM_COLORS: Record<string, string> = {
  spotify:    '#1db954',
  instagram:  '#e1306c',
  facebook:   '#1877f2',
  youtube:    '#ff0000',
  tiktok:     '#69c9d0',
  bandcamp:   '#1da0c3',
  soundcloud: '#ff5500',
  twitter:    '#6b7280',
  website:    '#6366f1',
}

const PLATFORM_LABELS: Record<string, string> = {
  spotify:    'Spotify',
  instagram:  'Instagram',
  facebook:   'Facebook',
  youtube:    'YouTube',
  tiktok:     'TikTok',
  bandcamp:   'Bandcamp',
  soundcloud: 'SoundCloud',
  twitter:    'Twitter / X',
  website:    'Website',
}

function genreList(genres: string | null): string[] {
  if (!genres) return []
  return genres.split(',').map(g => g.trim()).filter(Boolean)
}

// ── General contact form ──────────────────────────────────────
const cName    = ref('')
const cEmail   = ref('')
const cSubject = ref('')
const cMessage = ref('')

function submitContact() {
  const to   = epk.value?.booking_email ?? epk.value?.press_email ?? ''
  const sub  = encodeURIComponent(cSubject.value || 'Inquiry from website')
  const body = encodeURIComponent(`Name: ${cName.value}\nEmail: ${cEmail.value}\n\n${cMessage.value}`)
  window.open(`mailto:${to}?subject=${sub}&body=${body}`)
}

// ── Booking availability ──────────────────────────────────────
interface BusyMember { id: number; name: string; role: string | null }
interface AvailabilityResult {
  date: string
  available: boolean
  total_members: number
  busy_count: number
  busy_members: BusyMember[]
}

const bookDate    = ref('')
const bookResult  = ref<AvailabilityResult | null>(null)
const bookLoading = ref(false)
const bookError   = ref<string | null>(null)

async function checkAvailability() {
  if (!bookDate.value) return
  bookLoading.value = true
  bookError.value   = null
  bookResult.value  = null
  try {
    const res = await fetch(
      `${API_BASE}/api/band-profile/calendar/availability?date=${bookDate.value}`,
      { headers: jsonHeaders }
    )
    if (!res.ok) throw new Error('Failed to check availability.')
    const json = await res.json() as { data: AvailabilityResult }
    bookResult.value = json.data
  } catch (e) {
    bookError.value = (e as Error).message
  } finally {
    bookLoading.value = false
  }
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}
</script>

<template>
  <div class="contact-page">

    <!-- ── Page header ──────────────────────────────────────── -->
    <header class="page-header">
      <div class="page-header-inner">
        <p class="page-eyebrow">Contact</p>
        <h1 class="page-title">Get in Touch</h1>
        <p class="page-sub">
          Booking inquiries, press requests, or just want to say hello — we'd love to hear from you.
        </p>
      </div>
    </header>

    <div class="page-body">

      <!-- ── EPK card ────────────────────────────────────────── -->
      <section v-if="epk" class="epk-card">
        <div class="epk-card-inner">
          <div class="epk-card-text">
            <div class="epk-band-name">{{ epk.name }}</div>
            <div v-if="genreList(epk.genres).length" class="epk-genres">
              <span v-for="g in genreList(epk.genres)" :key="g" class="genre-badge">{{ g }}</span>
            </div>
            <p v-if="epk.bio_short" class="epk-bio">{{ epk.bio_short }}</p>
          </div>

          <!-- Press photo strip -->
          <div v-if="epk.press_photos?.length" class="epk-photos">
            <img
              v-for="p in epk.press_photos.slice(0, 4)"
              :key="p.id"
              :src="p.image_url ?? ''"
              :alt="p.caption ?? ''"
              class="epk-photo-thumb"
              @error="($event.target as HTMLImageElement).style.display='none'"
            />
          </div>
        </div>

        <div class="epk-card-actions">
          <RouterLink to="/epk" class="epk-btn-primary">
            Browse EPK
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </RouterLink>
          <a
            v-if="epk.tech_rider_url"
            :href="epk.tech_rider_url"
            target="_blank"
            rel="noopener noreferrer"
            class="epk-btn-ghost"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Tech Rider
          </a>
          <a
            v-if="epk.stage_plot_url"
            :href="epk.stage_plot_url"
            target="_blank"
            rel="noopener noreferrer"
            class="epk-btn-ghost"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Stage Plot
          </a>
        </div>
      </section>

      <!-- ── Social links ────────────────────────────────────── -->
      <section v-if="epk?.social_links?.length" class="social-section">
        <p class="section-label">Follow us</p>
        <div class="social-links">
          <a
            v-for="link in epk.social_links"
            :key="link.platform"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="social-pill"
            :style="`--platform-color: ${PLATFORM_COLORS[link.platform] ?? '#888'}`"
          >
            <span class="social-dot" />
            {{ link.label || PLATFORM_LABELS[link.platform] || link.platform }}
          </a>
        </div>
      </section>

      <!-- ── Newsletter signup ─────────────────────────────────── -->
      <NewsletterSignup source="contact" />

      <!-- ── Two-column forms ────────────────────────────────── -->
      <div class="forms-grid">

        <!-- General inquiry -->
        <div class="form-card">
          <p class="form-card-label">General Inquiry</p>
          <h2 class="form-card-title">Send us a message</h2>
          <p class="form-card-sub">Fills in your email client — no data is stored.</p>

          <form class="contact-form" @submit.prevent="submitContact">
            <div class="field-row">
              <div class="field">
                <label class="field-label">Your name</label>
                <input v-model="cName" required class="field-input" placeholder="Jane Smith" />
              </div>
              <div class="field">
                <label class="field-label">Your email</label>
                <input v-model="cEmail" type="email" required class="field-input" placeholder="you@example.com" />
              </div>
            </div>
            <div class="field">
              <label class="field-label">Subject</label>
              <input v-model="cSubject" class="field-input" placeholder="Collaboration, booking, press…" />
            </div>
            <div class="field">
              <label class="field-label">Message</label>
              <textarea v-model="cMessage" required rows="5" class="field-textarea" placeholder="Tell us more…" />
            </div>
            <button type="submit" class="btn-submit">
              Open email client
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>

            <div v-if="epk?.booking_email || epk?.press_email" class="direct-emails">
              <div v-if="epk.booking_email" class="email-row">
                <span class="email-type">Booking</span>
                <a :href="`mailto:${epk.booking_email}`" class="email-link">{{ epk.booking_email }}</a>
              </div>
              <div v-if="epk.press_email" class="email-row">
                <span class="email-type">Press / PR</span>
                <a :href="`mailto:${epk.press_email}`" class="email-link">{{ epk.press_email }}</a>
              </div>
            </div>
          </form>
        </div>

        <!-- Booking availability -->
        <div class="form-card">
          <p class="form-card-label">Booking</p>
          <h2 class="form-card-title">Check Availability</h2>
          <p class="form-card-sub">Pick a date to instantly see if we're free.</p>

          <div class="booking-form">
            <div class="field">
              <label class="field-label">Select a date</label>
              <div class="date-row">
                <input
                  v-model="bookDate"
                  type="date"
                  class="field-input"
                  :min="new Date().toISOString().slice(0,10)"
                  @keyup.enter="checkAvailability"
                />
                <button
                  class="btn-check"
                  :disabled="!bookDate || bookLoading"
                  @click="checkAvailability"
                >{{ bookLoading ? 'Checking…' : 'Check' }}</button>
              </div>
              <p v-if="bookError" class="field-error">{{ bookError }}</p>
            </div>

            <Transition name="slide-up">
              <div v-if="bookResult" class="result-card" :class="bookResult.available ? 'result-ok' : 'result-busy'">
                <div class="result-icon">{{ bookResult.available ? '✓' : '✕' }}</div>
                <div class="result-content">
                  <div class="result-date">{{ fmtDate(bookResult.date) }}</div>
                  <div class="result-status">
                    {{ bookResult.available ? 'Band is available' : 'Band is not available' }}
                  </div>
                  <div v-if="!bookResult.available" class="result-detail">
                    <span v-if="bookResult.total_members === bookResult.busy_count">
                      All {{ bookResult.total_members }} members are busy.
                    </span>
                    <span v-else>
                      {{ bookResult.busy_count }} of {{ bookResult.total_members }} members are busy.
                    </span>
                  </div>
                </div>
              </div>
            </Transition>

            <div v-if="bookResult?.available && epk?.booking_email" class="booking-hint">
              <p class="hint-text">We're free — reach out to confirm:</p>
              <a :href="`mailto:${epk.booking_email}`" class="btn-submit" style="display:inline-flex; text-decoration:none;">
                Email us to book
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.contact-page {
  background: #fff;
  color: #111;
  min-height: calc(100vh - 56px);
}

/* ── Page header ────────────────────────────────────────── */
.page-header { padding: 4rem 1.5rem 3rem; background: #fff; border-bottom: 1px solid #e0e0e0; }
.page-header-inner { max-width: 960px; margin: 0 auto; }
.page-eyebrow {
  font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: #888; margin-bottom: 0.75rem;
}
.page-title {
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  font-weight: 700; color: #111; line-height: 1.2; margin-bottom: 0.5rem;
}
.page-sub { font-size: 1rem; color: #888; }

/* ── Page body ──────────────────────────────────────────── */
.page-body {
  max-width: 860px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 5rem;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

/* ── EPK card ───────────────────────────────────────────── */
.epk-card {
  background: #111;
  border-radius: 1rem;
  color: #fff;
  overflow: hidden;
}
.epk-card-inner {
  padding: 2rem 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.epk-band-name {
  font-size: clamp(1.5rem, 4vw, 2.25rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
}
.epk-genres {
  display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.375rem;
}
.genre-badge {
  padding: 0.15rem 0.6rem; border-radius: 0.25rem;
  font-size: 0.7rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
  background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.8);
}
.epk-bio {
  font-size: 0.9375rem; color: rgba(255,255,255,0.65); line-height: 1.65;
  max-width: 560px; margin: 0;
}
.epk-photos {
  display: flex; gap: 0.5rem; flex-wrap: wrap;
}
.epk-photo-thumb {
  width: 80px; height: 60px; border-radius: 0.375rem; object-fit: cover;
  border: 1px solid rgba(255,255,255,0.12);
}
.epk-card-actions {
  display: flex; flex-wrap: wrap; gap: 0.625rem;
  padding: 0 2rem 2rem;
  align-items: center;
}
.epk-btn-primary {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.6rem 1.25rem; border-radius: 0.5rem;
  font-size: 0.875rem; font-weight: 600;
  background: #fff; color: #111;
  text-decoration: none; border: none;
  transition: background 120ms;
}
.epk-btn-primary:hover { background: #e8e8e8; }

.epk-btn-ghost {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.55rem 1rem; border-radius: 0.5rem;
  font-size: 0.8125rem; font-weight: 500;
  background: transparent; color: rgba(255,255,255,0.7);
  border: 1px solid rgba(255,255,255,0.2);
  text-decoration: none;
  transition: background 120ms, color 120ms, border-color 120ms;
}
.epk-btn-ghost:hover {
  background: rgba(255,255,255,0.08);
  color: #fff;
  border-color: rgba(255,255,255,0.4);
}

/* ── Social links ───────────────────────────────────────── */
.social-section {}
.section-label {
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: #888; margin-bottom: 0.75rem;
}
.social-links {
  display: flex; flex-wrap: wrap; gap: 0.5rem;
}
.social-pill {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.4rem 0.875rem; border-radius: 999px;
  font-size: 0.8125rem; font-weight: 500;
  background: #fff; color: #333;
  border: 1px solid #e0e0e0;
  text-decoration: none;
  transition: border-color 120ms, color 120ms, background 120ms;
}
.social-pill:hover {
  background: #f5f5f5;
  border-color: var(--platform-color, #888);
  color: #111;
}
.social-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--platform-color, #888);
  flex-shrink: 0;
}

/* ── Forms grid ─────────────────────────────────────────── */
.forms-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
}
@media (max-width: 640px) {
  .forms-grid { grid-template-columns: 1fr; }
}

.form-card {
  background: #fafafa;
  border: 1px solid #e8e8e8;
  border-radius: 0.875rem;
  padding: 1.75rem;
}
.form-card-label {
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: #888; margin-bottom: 0.375rem;
}
.form-card-title {
  font-size: 1.1875rem; font-weight: 700; color: #111; margin-bottom: 0.25rem;
}
.form-card-sub {
  font-size: 0.8125rem; color: #888; margin-bottom: 1.375rem; line-height: 1.5;
}

/* Fields */
.contact-form, .booking-form {
  display: flex; flex-direction: column; gap: 0.875rem;
}
.field-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;
}
@media (max-width: 480px) {
  .field-row { grid-template-columns: 1fr; }
}
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field-label {
  font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.05em; color: #888;
}
.field-input {
  width: 100%; padding: 0.5625rem 0.75rem; border-radius: 0.5rem;
  border: 1px solid #ddd; background: #fff; color: #111;
  font-size: 0.9rem; outline: none;
  transition: border-color 150ms;
  box-sizing: border-box;
}
.field-input:focus { border-color: #888; }
.field-textarea {
  width: 100%; padding: 0.5625rem 0.75rem; border-radius: 0.5rem;
  border: 1px solid #ddd; background: #fff; color: #111;
  font-size: 0.9rem; outline: none; resize: vertical; line-height: 1.5;
  font-family: inherit;
  transition: border-color 150ms;
  box-sizing: border-box;
}
.field-textarea:focus { border-color: #888; }
.field-error { font-size: 0.8rem; color: #e55; margin-top: 0.25rem; }

.btn-submit {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.625rem 1.25rem; border-radius: 0.5rem;
  font-size: 0.875rem; font-weight: 600;
  background: #111; color: #fff; border: none; cursor: pointer;
  transition: background 150ms; align-self: flex-start;
}
.btn-submit:hover { background: #333; }

/* Direct emails */
.direct-emails {
  border-top: 1px solid #e8e8e8;
  padding-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.email-row { display: flex; align-items: center; gap: 0.625rem; }
.email-type {
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: #aaa; min-width: 4.5rem;
}
.email-link { font-size: 0.875rem; color: #333; text-decoration: none; font-weight: 500; }
.email-link:hover { color: #111; text-decoration: underline; }

/* Booking */
.date-row { display: flex; gap: 0.625rem; }
.btn-check {
  padding: 0.5625rem 1.125rem; border-radius: 0.5rem;
  font-size: 0.875rem; font-weight: 600;
  background: #111; color: #fff; border: none; cursor: pointer;
  transition: background 150ms; white-space: nowrap;
}
.btn-check:hover:not(:disabled) { background: #333; }
.btn-check:disabled { opacity: 0.45; cursor: not-allowed; }

.result-card {
  border-radius: 0.75rem; padding: 1rem 1.125rem;
  display: flex; align-items: flex-start; gap: 1rem;
  border: 1px solid;
}
.result-ok   { background: #f6faf6; border-color: #c8e0c8; }
.result-busy { background: #fdf4f4; border-color: #e8c8c8; }
.result-icon {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; font-weight: 700; flex-shrink: 0;
  background: #e8e8e8; color: #111;
}
.result-date   { font-size: 0.78rem; color: #888; margin-bottom: 0.2rem; }
.result-status { font-size: 0.9375rem; font-weight: 700; color: #111; }
.result-detail { font-size: 0.8rem; color: #666; margin-top: 0.2rem; }

.booking-hint {
  padding-top: 0.5rem;
  border-top: 1px solid #e8e8e8;
}
.hint-text { font-size: 0.8125rem; color: #555; margin-bottom: 0.625rem; }

/* Transition */
.slide-up-enter-active { transition: opacity 220ms, transform 220ms; }
.slide-up-enter-from  { opacity: 0; transform: translateY(6px); }
</style>
