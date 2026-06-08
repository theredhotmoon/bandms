<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { useBandProfile } from '@/composables/useBandProfile'
import { useReleases } from '@/composables/useReleases'
import { useConcerts } from '@/composables/useConcerts'
import { useAuthors } from '@/composables/useAuthors'
import type { AuthorSummary } from '@/types/author'

const { query: profileQ } = useBandProfile()
const { query: releasesQ } = useReleases()
const { query: concertsQ } = useConcerts()
const { query: authorsQ } = useAuthors()

const VALID_TYPES = ['venue', 'blog', 'playlist', 'sync', 'festival', 'band'] as const
type PitchType = typeof VALID_TYPES[number]

const route = useRoute()

function isValidType(v: unknown): v is PitchType {
  return VALID_TYPES.includes(v as PitchType)
}

const qType = route.query.type
const selectedType = ref<PitchType>(isValidType(qType) ? qType : 'venue')
const recipientName = ref(typeof route.query.band === 'string' ? route.query.band : '')
const bandLastGig = ref<string>(typeof route.query.lastGig === 'string' ? route.query.lastGig : '')
const customNote = ref('')
const copied = ref(false)

const matchedAuthor = computed(() => {
  const q = recipientName.value.trim().toLowerCase()
  if (!q || !authorsQ.data.value?.length) return null
  return authorsQ.data.value.find((a: AuthorSummary) => a.name.toLowerCase().includes(q)) ?? null
})

const pitchTypes: { key: PitchType; label: string; icon: string }[] = [
  { key: 'venue',    label: 'Venue / Booker',  icon: '🎪' },
  { key: 'blog',     label: 'Music Blog / PR',  icon: '📰' },
  { key: 'playlist', label: 'Playlist Curator', icon: '🎧' },
  { key: 'sync',     label: 'Sync / Film & TV', icon: '🎬' },
  { key: 'festival', label: 'Festival',          icon: '🎸' },
  { key: 'band',     label: 'Band Contact',      icon: '🎵' },
]

const upcomingConcerts = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return concertsQ.data.value?.filter((c: { date: string }) => c.date >= today).slice(0, 3) ?? []
})

const latestRelease = computed(() =>
  releasesQ.data.value?.[0] ?? null,
)

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

function genreText(genres: string | null): string {
  if (!genres) return 'music'
  const list = genres.split(',').map((g) => g.trim()).filter(Boolean)
  if (list.length === 1) return list[0]
  if (list.length === 2) return list.join(' and ')
  return list.slice(0, -1).join(', ') + ' and ' + list.at(-1)
}

const pitch = computed((): string => {
  const p = profileQ.data.value
  if (!p) return ''

  const name    = p.name ?? 'the band'
  const bio     = p.bio_short ?? ''
  const genres  = genreText(p.genres)
  const similar = p.comparable_artists ? `\n\nFor fans of ${p.comparable_artists}.` : ''
  const stats   = p.stat_spotify_monthly ? `\n\n${name} currently has ${p.stat_spotify_monthly.toLocaleString()} monthly Spotify listeners.` : ''
  const release = latestRelease.value ? `\n\nTheir latest release "${latestRelease.value.title}" (${latestRelease.value.type.toUpperCase()}) is out now.` : ''
  const epk     = `\n\nFull EPK available at: [your domain]/epk`
  const contact = p.booking_email ? `\n\nBooking: ${p.booking_email}` : ''
  const sign    = `\n\nBest,\n[Your name]`

  const to = recipientName.value ? `Hi ${recipientName.value},\n\n` : 'Hi,\n\n'
  const note = customNote.value ? `\n\n${customNote.value}` : ''

  switch (selectedType.value) {
    case 'venue':
      return (
        to +
        `I'm reaching out on behalf of ${name}, a ${genres} act based in ${p.hometown ?? 'the area'}.` +
        (bio ? `\n\n${bio}` : '') + similar + stats + release +
        (upcomingConcerts.value.length
          ? `\n\nWe're actively touring and looking for the right venues to partner with.`
          : '') +
        note + epk + contact + sign
      )
    case 'blog':
      return (
        to +
        `I'm writing to share ${name}, a ${genres} artist ${p.hometown ? `from ${p.hometown}` : "worth your readers' time"}.` +
        (bio ? `\n\n${bio}` : '') + similar + stats + release +
        note + epk + (p.press_email ? `\n\nPress contact: ${p.press_email}` : '') + sign
      )
    case 'playlist':
      return (
        to +
        `I wanted to pitch ${name} for your playlist consideration.` +
        ` ${name} makes ${genres} music${similar ? ' — ' + (p.comparable_artists ?? '') : ''}.` +
        (bio ? `\n\n${bio}` : '') + stats + release +
        `\n\nWould love for you to give it a listen — Spotify link: [add link]` +
        note + sign
      )
    case 'sync':
      return (
        to +
        `I'd like to submit ${name}'s music for sync consideration.` +
        ` ${name} creates ${genres} tracks with a strong cinematic quality.` +
        (bio ? `\n\n${bio}` : '') +
        (latestRelease.value ? `\n\nLatest release: "${latestRelease.value.title}" — full stems and custom edits available on request.` : '') +
        note + epk + (p.booking_email ? `\n\nSync inquiries: ${p.booking_email}` : '') + sign
      )
    case 'festival':
      return (
        to +
        `I'm submitting ${name} for consideration for your festival lineup.` +
        ` ${name} is a ${genres} act ${p.hometown ? `based in ${p.hometown}` : ''} known for high-energy live performances.` +
        (bio ? `\n\n${bio}` : '') + similar + stats +
        (upcomingConcerts.value.length ? `\n\nThe band is currently on tour and available for festival slots.` : '') +
        note + epk + contact + sign
      )
    case 'band': {
      const lastGigText = bandLastGig.value
        ? `since ${fmtDate(bandLastGig.value)}`
        : 'in a while'
      return (
        to +
        `We haven't played a gig together ${lastGigText}. We have some news:\n\n[PASTE_RECENT_NEWS_LINKS_HERE]\n\nLet's play a gig!` +
        note + epk + contact + sign
      )
    }
    default:
      return ''
  }
})

async function copyPitch() {
  if (!pitch.value) return
  await navigator.clipboard.writeText(pitch.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <AdminLayout>
    <div class="pg-page">
      <div class="pg-header">
        <h1 class="pg-title">Pitch Generator</h1>
        <p class="pg-sub">Auto-fill outreach emails from your BandMS profile data.</p>
      </div>

      <div v-if="!profileQ.data.value" class="loading">Loading profile…</div>

      <div v-else class="pg-layout">
        <!-- Controls -->
        <div class="pg-controls">
          <div class="control-group">
            <label class="control-label">Pitch type</label>
            <div class="type-tabs">
              <button
                v-for="t in pitchTypes"
                :key="t.key"
                class="type-tab"
                :class="{ 'type-tab--active': selectedType === t.key }"
                @click="selectedType = t.key"
              >
                {{ t.icon }} {{ t.label }}
              </button>
            </div>
          </div>

          <div class="control-group">
            <label class="control-label">Recipient name <span class="hint">(optional)</span></label>
            <input v-model="recipientName" class="ctrl-input" placeholder="Jane, John, The team…" />
            <div v-if="recipientName.trim() && authorsQ.data.value" class="contact-status">
              <template v-if="matchedAuthor">
                <span class="contact-badge contact-badge--returning">Returning contact</span>
                <span class="contact-name">{{ matchedAuthor.name }}</span>
                <span v-if="matchedAuthor.email" class="contact-detail">{{ matchedAuthor.email }}</span>
                <span v-if="matchedAuthor.phone" class="contact-detail">{{ matchedAuthor.phone }}</span>
              </template>
              <template v-else>
                <span class="contact-badge contact-badge--new">First contact</span>
                <span class="contact-hint">Not in your contacts yet.</span>
              </template>
            </div>
          </div>

          <div v-if="selectedType === 'band'" class="control-group">
            <label class="control-label">Last gig together <span class="hint">(optional)</span></label>
            <input v-model="bandLastGig" type="date" class="ctrl-input" />
          </div>

          <div class="control-group">
            <label class="control-label">Custom note to insert <span class="hint">(optional)</span></label>
            <textarea v-model="customNote" rows="3" class="ctrl-input" placeholder="We played your venue last year and the crowd loved it…" style="resize:vertical;" />
          </div>

          <div v-if="!profileQ.data.value?.bio_short" class="warning-box">
            Add a short bio to Band Profile to improve generated pitches.
          </div>
        </div>

        <!-- Output -->
        <div class="pg-output">
          <div class="output-toolbar">
            <span class="output-label">Generated pitch</span>
            <button class="copy-btn" @click="copyPitch">{{ copied ? 'Copied!' : 'Copy' }}</button>
          </div>
          <pre class="pitch-text">{{ pitch }}</pre>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.pg-page   { padding: 1.5rem 2rem; max-width: 960px; }
.pg-header { margin-bottom: 1.5rem; }
.pg-title  { font-size: 1.25rem; font-weight: 700; color: #e2e8f0; margin: 0 0 0.25rem; }
.pg-sub    { font-size: 0.875rem; color: #475569; margin: 0; }
.loading   { color: #64748b; font-size: 0.875rem; }

.pg-layout { display: grid; grid-template-columns: 280px 1fr; gap: 1.5rem; align-items: start; }
@media (max-width: 768px) { .pg-layout { grid-template-columns: 1fr; } }

.pg-controls { display: flex; flex-direction: column; gap: 1rem; }
.control-group { display: flex; flex-direction: column; gap: 0.375rem; }
.control-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
.hint { font-weight: 400; text-transform: none; letter-spacing: 0; color: #334155; }
.type-tabs { display: flex; flex-direction: column; gap: 0.25rem; }
.type-tab {
  padding: 0.375rem 0.75rem; border-radius: 0.375rem; font-size: 0.8125rem; font-weight: 500;
  background: transparent; border: 1px solid #222222; color: #64748b; cursor: pointer;
  text-align: left; transition: background 100ms, border-color 100ms, color 100ms;
}
.type-tab:hover { background: #1a1a1a; color: #94a3b8; }
.type-tab--active { background: #2a2a2a; border-color: #444444; color: #d0d0d0; }
.ctrl-input {
  width: 100%; background: #111111; border: 1px solid #2a2a2a; border-radius: 0.375rem;
  color: #e2e8f0; font-size: 0.8125rem; padding: 0.4rem 0.625rem; outline: none; font-family: inherit;
  transition: border-color 150ms;
}
.ctrl-input:focus { border-color: #888888; }
.warning-box {
  font-size: 0.75rem; color: #fbbf24; background: #1a160a; border: 1px solid #433410;
  border-radius: 0.375rem; padding: 0.5rem 0.75rem;
}

.contact-status {
  display: flex; align-items: center; flex-wrap: wrap; gap: 0.375rem;
  padding: 0.375rem 0.5rem; border-radius: 0.375rem; background: #111111;
  border: 1px solid #222222;
}
.contact-badge {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  padding: 0.1rem 0.4rem; border-radius: 0.25rem;
}
.contact-badge--returning { background: #0f2a1e; color: #34d399; border: 1px solid #065f46; }
.contact-badge--new       { background: #222222; color: #64748b; border: 1px solid #333333; }
.contact-name   { font-size: 0.8rem; font-weight: 600; color: #e2e8f0; }
.contact-detail { font-size: 0.75rem; color: #475569; }
.contact-hint   { font-size: 0.75rem; color: #334155; }

.pg-output { display: flex; flex-direction: column; gap: 0; border: 1px solid #222222; border-radius: 0.5rem; overflow: hidden; }
.output-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 0.75rem; background: #141414; border-bottom: 1px solid #222222;
}
.output-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #555555; }
.copy-btn {
  padding: 0.2rem 0.625rem; border-radius: 0.3rem; font-size: 0.75rem; font-weight: 600;
  background: #2a2a2a; border: 1px solid #444444; color: #d0d0d0; cursor: pointer;
}
.copy-btn:hover { background: #333333; }
.pitch-text {
  background: #0d0d0d; color: #94a3b8; font-family: 'Courier New', monospace;
  font-size: 0.8rem; line-height: 1.7; padding: 1rem; margin: 0;
  white-space: pre-wrap; word-break: break-word; min-height: 320px;
}
</style>
