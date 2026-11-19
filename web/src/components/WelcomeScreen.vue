<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import NewsletterSignup from './NewsletterSignup.vue'
import { consentStatus, storedConsentStatus } from '@/stores/consent'
import { dropPastConcerts, isDue, isExcludedPath, readSeen, selectBlocks, shouldMarkSeen, storageWritable, writeSeen, type WelcomeBlock, type WelcomeConfig } from '@/lib/welcome'
import { trapTab } from '@/lib/trapTab'
import type { WelcomeConcert, WelcomePost } from '@/lib/welcomeProps'
import { rememberReturnPath, requestSignInLink } from '@/lib/comments'
import type { Locale } from '@/types/shared'

/** Shaped by `welcomeCopy()` in lib/copy.ts — an island has no siteConfig. */
export interface WelcomeCopy {
  heading: string
  intro: string
  gigsTitle: string
  gigsNearTitle: string
  newsTitle: string
  newsletterTitle: string
  newsletterBody: string
  newsletter: { placeholder: string; submitLabel: string; sendingLabel: string; doneLabel: string; errorLabel: string }
  accountTitle: string
  accountBody: string
  accountPlaceholder: string
  accountSubmit: string
  accountSending: string
  accountDone: string
  accountError: string
  enter: string
  close: string
}

interface Props {
  lang: Locale
  config: WelcomeConfig
  /** BaseLayout's GA id is set — the consent card then goes first. */
  gaConfigured: boolean
  /** Upcoming shows in date order: all (capped) with geo targeting on, else concert_count. */
  concerts: WelcomeConcert[]
  post: WelcomePost | null
  available: Record<WelcomeBlock, boolean>
  copy: WelcomeCopy
}
const props = defineProps<Props>()
const t = props.copy

// Teleport only after mount — see ModalShell.vue; a server-rendered teleport
// breaks hydration of the next island on the page.
const mounted = ref(false)
const open = ref(false)
const blocks = ref<WelcomeBlock[]>([])
const concertIds = ref<number[]>([])
const near = ref(false)
const dialog = ref<HTMLElement | null>(null)

const shownConcerts = computed(() =>
  concertIds.value
    .map(id => props.concerts.find(c => c.id === id))
    .filter((c): c is WelcomeConcert => c !== undefined),
)
const gigsHeading = computed(() => (near.value ? t.gigsNearTitle : t.gigsTitle))

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

// The key alone, not readFanSession(): a corrupt `fan` blob makes that null,
// but a stored token still means a signed-in fan, who never sees this.
function hasFanToken(): boolean {
  try {
    return !!browserStorage()?.getItem('fan_token')
  } catch {
    return false
  }
}

async function fetchNearby(): Promise<{ located: boolean; concertIds: number[] }> {
  try {
    const res = await fetch('/api/welcome/nearby', { headers: { Accept: 'application/json' } })
    if (!res.ok) return { located: false, concertIds: [] }
    const body = (await res.json()) as { located?: unknown; concert_ids?: unknown }
    const ids = Array.isArray(body.concert_ids) ? body.concert_ids.filter((n): n is number => typeof n === 'number') : []
    return { located: body.located === true, concertIds: ids }
  } catch {
    return { located: false, concertIds: [] }
  }
}

// ── Opening ────────────────────────────────────────────────────────────────

let stopConsentWatch: (() => void) | null = null

async function decideAndOpen(): Promise<void> {
  const cfg = props.config
  // Only now, when everything else says the screen is due — never per page view.
  const nearby = cfg.geo.enabled ? await fetchNearby() : null
  // The build's list can be days old: a show that has passed since is not offered.
  const upcomingIds = dropPastConcerts(props.concerts, new Date()).map(c => c.id)
  const picked = selectBlocks(cfg, props.available, nearby, upcomingIds)
  if (!picked) {
    // A lookup was made and there is nothing to show: decided, so the next page
    // view does not ask the server again.
    if (shouldMarkSeen(picked, nearby !== null)) writeSeen(browserStorage(), cfg.campaign, new Date())
    return
  }
  blocks.value = picked.blocks
  concertIds.value = picked.concertIds
  near.value = cfg.geo.enabled && nearby?.located === true
  // Written on open, not on close: navigating away through a gig link counts as seen.
  writeSeen(browserStorage(), cfg.campaign, new Date())
  show()
}

onMounted(() => {
  mounted.value = true
  if (isExcludedPath(window.location.pathname)) return
  if (hasFanToken()) return
  // No writable storage fails closed: a private window (or read-only storage)
  // must not get it on every page.
  if (!storageWritable(browserStorage())) return
  const seen = readSeen(browserStorage())
  if (seen === 'unavailable' || !isDue(seen, props.config, new Date())) return

  if (!props.gaConfigured) {
    void decideAndOpen()
    return
  }
  // The consent card goes first. The banner may hydrate after this island, so
  // the atom can still read 'unknown' for a visitor whose answer is stored —
  // check storage too, and only wait when neither has an answer.
  if (consentStatus.get() !== 'unknown' || storedConsentStatus() !== 'unknown') {
    void decideAndOpen()
    return
  }
  stopConsentWatch = consentStatus.listen(value => {
    if (value === 'unknown') return
    stopConsentWatch?.()
    stopConsentWatch = null
    void decideAndOpen()
  })
})

// ── Dialog behaviour ───────────────────────────────────────────────────────

let returnFocus: HTMLElement | null = null
let previousOverflow = ''

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  if (dialog.value) trapTab(dialog.value, e)
}

async function show(): Promise<void> {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  previousOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeydown)
  open.value = true
  await nextTick()
  dialog.value?.focus()
}

function close(): void {
  if (!open.value) return
  open.value = false
  document.removeEventListener('keydown', onKeydown)
  document.documentElement.style.overflow = previousOverflow
  if (returnFocus?.isConnected) returnFocus.focus()
  returnFocus = null
}

// A press that starts inside the card and ends on the scrim (a text selection
// dragged out of the email field) must not count as a backdrop click.
let pressStartedOnScrim = false
function onScrimPointerDown(e: PointerEvent): void {
  pressStartedOnScrim = e.target === e.currentTarget
}
function onScrimClick(e: MouseEvent): void {
  if (pressStartedOnScrim && e.target === e.currentTarget) close()
  pressStartedOnScrim = false
}

onBeforeUnmount(() => {
  stopConsentWatch?.()
  if (open.value) close()
})

// ── Account block ──────────────────────────────────────────────────────────

const email = ref('')
const accountStatus = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')

async function requestLink(): Promise<void> {
  if (accountStatus.value === 'sending' || !email.value) return
  accountStatus.value = 'sending'
  const path = window.location.pathname
  // Lets /account follow the link's return path in this browser only — see comments.ts.
  rememberReturnPath(path)
  try {
    await requestSignInLink(email.value, props.lang, path)
    accountStatus.value = 'sent'
  } catch {
    accountStatus.value = 'error'
  }
}
</script>

<template>
  <Teleport v-if="mounted && open" to="body">
    <div class="welcome-scrim" @pointerdown="onScrimPointerDown" @click="onScrimClick">
      <div
        ref="dialog"
        class="welcome-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        tabindex="-1"
        data-testid="welcome-dialog"
      >
        <button type="button" class="welcome-x" :aria-label="t.close" data-testid="welcome-close" @click="close">
          <span aria-hidden="true">✕</span>
        </button>

        <h2 id="welcome-title" class="welcome-title">{{ t.heading }}</h2>
        <p v-if="t.intro" class="welcome-intro">{{ t.intro }}</p>

        <template v-for="block in blocks" :key="block">
          <section v-if="block === 'concerts'" class="welcome-block" data-testid="welcome-block-concerts">
            <h3 class="welcome-block-title">{{ gigsHeading }}</h3>
            <ul class="welcome-gigs">
              <li v-for="c in shownConcerts" :key="c.id">
                <a :href="c.href" class="welcome-gig">
                  <span class="welcome-gig-date">{{ c.date }}</span>
                  <span class="welcome-gig-place">{{ [c.city, c.venue].filter(Boolean).join(' · ') }}</span>
                </a>
              </li>
            </ul>
          </section>

          <section v-else-if="block === 'news' && post" class="welcome-block" data-testid="welcome-block-news">
            <h3 class="welcome-block-title">{{ t.newsTitle }}</h3>
            <a :href="post.href" class="welcome-post">
              <img v-if="post.image" :src="post.image" alt="" class="welcome-post-img" loading="lazy" />
              <span class="welcome-post-text">
                <span class="welcome-post-title">{{ post.title }}</span>
                <span v-if="post.date" class="welcome-post-date">{{ post.date }}</span>
              </span>
            </a>
          </section>

          <section v-else-if="block === 'newsletter'" class="welcome-block" data-testid="welcome-block-newsletter">
            <h3 class="welcome-block-title">{{ t.newsletterTitle }}</h3>
            <p v-if="t.newsletterBody" class="welcome-text">{{ t.newsletterBody }}</p>
            <NewsletterSignup v-bind="t.newsletter" />
          </section>

          <section v-else-if="block === 'account'" class="welcome-block" data-testid="welcome-block-account">
            <h3 class="welcome-block-title">{{ t.accountTitle }}</h3>
            <p v-if="t.accountBody" class="welcome-text">{{ t.accountBody }}</p>
            <p v-if="accountStatus === 'sent'" class="welcome-done" role="status">{{ t.accountDone }}</p>
            <form v-else class="welcome-account" @submit.prevent="requestLink">
              <input
                v-model="email"
                type="email"
                required
                autocomplete="email"
                :placeholder="t.accountPlaceholder"
                :aria-label="t.accountPlaceholder"
                class="welcome-input"
                data-testid="welcome-account-email"
              />
              <button type="submit" class="welcome-btn" :disabled="accountStatus === 'sending'">
                {{ accountStatus === 'sending' ? t.accountSending : t.accountSubmit }}
              </button>
            </form>
            <p v-if="accountStatus === 'error'" class="welcome-error" role="alert">{{ t.accountError }}</p>
          </section>
        </template>

        <button type="button" class="welcome-enter" data-testid="welcome-enter" @click="close">{{ t.enter }}</button>
      </div>
    </div>
  </Teleport>
</template>

<style>
/* Unscoped: the dialog is teleported to <body>. Above the lightboxes (240)
   and the consent card (230), which it follows. */
.welcome-scrim {
  position: fixed;
  inset: 0;
  z-index: 250;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: color-mix(in oklab, var(--color-ink) 76%, transparent);
}
.welcome-card {
  position: relative;
  width: 100%;
  max-width: 34rem;
  max-height: calc(100vh - 40px);
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--color-page);
  color: var(--color-body);
  border: 3px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 1.75rem 1.5rem 1.5rem;
  outline: none;
  animation: welcome-in 0.2s ease-out;
}
.welcome-x {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 2.5rem;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-muted);
  font-size: 1.125rem;
  cursor: pointer;
  border-radius: var(--radius-card);
}
.welcome-x:hover { color: var(--color-body); background: var(--color-surface-2); }
.welcome-title {
  font: var(--display-weight) 1.75rem/1.1 var(--font-display);
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
  margin: 0 2.5rem 0.5rem 0;
}
.welcome-intro { margin: 0; font-size: 0.9375rem; color: var(--color-muted); }

.welcome-block { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border); }
.welcome-block-title {
  font: var(--display-weight) 1.125rem/1.2 var(--font-display);
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
  margin: 0 0 0.625rem;
}
.welcome-text { margin: 0 0 0.75rem; font-size: 0.875rem; color: var(--color-muted); }

.welcome-gigs { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
.welcome-gig,
.welcome-post {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.625rem 0.75rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-body);
  text-decoration: none;
  transition: background-color 0.15s;
}
.welcome-gig:hover,
.welcome-post:hover { background: var(--color-surface-2); }
.welcome-gig-date { font-weight: 700; font-size: 0.875rem; white-space: nowrap; }
.welcome-gig-place { font-size: 0.875rem; color: var(--color-muted); min-width: 0; }
.welcome-post-img { width: 4rem; height: 4rem; object-fit: cover; flex: none; border-radius: var(--radius-card); }
.welcome-post-text { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
.welcome-post-title { font-weight: 700; font-size: 0.9375rem; }
.welcome-post-date { font-size: 0.8125rem; color: var(--color-muted); }

.welcome-account { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.welcome-input {
  flex: 1 1 12rem;
  min-width: 0;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-2);
  color: var(--color-body);
  padding: 0.625rem 0.75rem;
  font: inherit;
  font-size: 0.9375rem;
}
.welcome-input::placeholder { color: var(--color-subtle); }
.welcome-btn,
.welcome-enter {
  border: 2px solid var(--color-border);
  border-radius: var(--radius-card);
  font-weight: 700;
  font-size: 0.875rem;
  line-height: 1.25;
  padding: 0.625rem 1rem;
  cursor: pointer;
  transition: background-color 0.15s;
}
.welcome-btn { background: var(--color-surface); color: var(--color-body); }
.welcome-btn:hover { background: var(--color-surface-2); }
.welcome-btn:disabled { opacity: 0.6; cursor: default; }
.welcome-enter {
  display: block;
  width: 100%;
  margin-top: 1.5rem;
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  border-color: var(--color-inverse);
}
.welcome-done { margin: 0; font-weight: 700; font-size: 0.9375rem; color: var(--color-accent); }
.welcome-error { margin: 0.5rem 0 0; font-size: 0.875rem; color: var(--color-danger); }

.welcome-x:focus-visible,
.welcome-gig:focus-visible,
.welcome-post:focus-visible,
.welcome-btn:focus-visible,
.welcome-enter:focus-visible,
.welcome-input:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }

@keyframes welcome-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .welcome-card { animation: none; }
  .welcome-gig, .welcome-post, .welcome-btn, .welcome-enter { transition: none; }
}
</style>
