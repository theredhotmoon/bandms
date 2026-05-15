<script setup lang="ts">
import { computed } from 'vue'
import type { BandProfile } from '@/types/bandProfile'
import type { Concert } from '@/types/concert'
import type { ReleaseSummary } from '@/types/release'

interface Props {
  profile: BandProfile
  concerts: Concert[]
  releases: ReleaseSummary[]
  pressCount: number
  postsCount: number
  musicVideosCount: number
  membersCount: number
  techRiderActive: boolean
  epkPublished: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:level': [level: 1 | 2 | 3 | 4] }>()

// ── Data types ────────────────────────────────────────────────────────────────

interface CheckItem {
  id: string
  label: string
  done: boolean
  link: string
  tip: string
}

interface Section {
  name: string
  items: CheckItem[]
}

interface LevelDef {
  level: 1 | 2 | 3 | 4
  name: string
  tagline: string
  emoji: string
  color: string
  sections: Section[]
  /** Level 4 only — signals this level is a user-customisable placeholder */
  isCustom?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasUpcoming() {
  const today = new Date().toISOString().slice(0, 10)
  return props.concerts.some((c) => (c as { date: string }).date >= today)
}

// ── Level definitions ─────────────────────────────────────────────────────────

const LEVELS = computed((): LevelDef[] => {
  const p = props.profile

  return [
    // ── Level 1 – Garage Band ──────────────────────────────────────────────
    {
      level: 1,
      name: 'Garage Band',
      tagline: 'Establish your identity — who are you as a band?',
      emoji: '🎸',
      color: '#34d399',
      sections: [
        {
          name: 'Identity',
          items: [
            {
              id: 'name-bio',
              label: 'Band name & short bio',
              done: !!(p.name && p.bio_short),
              link: '/admin/band-profile',
              tip: 'Fill in your name and at least a 280-char short bio',
            },
            {
              id: 'hometown',
              label: 'Hometown & formation year',
              done: !!(p.hometown && p.formation_year),
              link: '/admin/band-profile',
              tip: 'Venues and press always ask where you are from',
            },
            {
              id: 'genres',
              label: 'Genre tags set',
              done: !!(p.genres),
              link: '/admin/band-profile',
              tip: 'Tag your genre so fans and algorithms can find you',
            },
          ],
        },
        {
          name: 'Band',
          items: [
            {
              id: 'members',
              label: 'At least 2 band members listed',
              done: props.membersCount >= 2,
              link: '/admin/band-members',
              tip: 'Add member profiles so booking agents know your lineup',
            },
          ],
        },
        {
          name: 'First Music',
          items: [
            {
              id: 'first-release',
              label: 'First release uploaded',
              done: props.releases.length >= 1,
              link: '/admin/releases',
              tip: 'Upload your first album, EP or single',
            },
            {
              id: 'cover-art',
              label: 'Cover artwork on a release',
              done: props.releases.some((r) => !!r.cover_image),
              link: '/admin/releases',
              tip: 'Streaming platforms require cover art',
            },
          ],
        },
        {
          name: 'Online Presence',
          items: [
            {
              id: 'social-links',
              label: '2+ social media links',
              done: !!(p.social_links?.length && p.social_links.length >= 2),
              link: '/admin/band-profile',
              tip: 'Instagram, Spotify, YouTube — minimum 2 platforms',
            },
            {
              id: 'booking-email',
              label: 'Booking contact email',
              done: !!(p.booking_email),
              link: '/admin/band-profile',
              tip: 'Direct email — not a social handle or contact form',
            },
          ],
        },
      ],
    },

    // ── Level 2 – Local Band ───────────────────────────────────────────────
    {
      level: 2,
      name: 'Local Band',
      tagline: 'Build your audience — releases, shows, content & first press',
      emoji: '🌿',
      color: '#60a5fa',
      sections: [
        {
          name: 'Releases & Music',
          items: [
            {
              id: 'multi-releases',
              label: '3+ releases in catalogue',
              done: props.releases.length >= 3,
              link: '/admin/releases',
              tip: 'Build a back-catalogue fans can discover',
            },
            {
              id: 'music-video',
              label: 'Music video added',
              done: props.musicVideosCount >= 1,
              link: '/admin/music-videos',
              tip: '"Live video is non-negotiable" — EPK checklist 2026',
            },
          ],
        },
        {
          name: 'Live Activity',
          items: [
            {
              id: 'concerts',
              label: '3+ concerts on record',
              done: props.concerts.length >= 3,
              link: '/admin/concerts',
              tip: 'Build a show history for your EPK and booking pitches',
            },
            {
              id: 'upcoming-show',
              label: 'Upcoming show listed',
              done: hasUpcoming(),
              link: '/admin/concerts',
              tip: 'Active touring artists book more shows',
            },
          ],
        },
        {
          name: 'Content & Press',
          items: [
            {
              id: 'first-press',
              label: 'First press article / feature',
              done: props.pressCount >= 1,
              link: '/admin/press-releases',
              tip: 'Any blog post, review or interview that mentions you',
            },
            {
              id: 'news-posts',
              label: '3+ news posts published',
              done: props.postsCount >= 3,
              link: '/admin/posts',
              tip: 'Regular content signals an active band to Google and fans',
            },
          ],
        },
        {
          name: 'Discovery',
          items: [
            {
              id: 'bio-variants',
              label: 'Short & medium bio written',
              done: !!(p.bio_short && p.bio_medium),
              link: '/admin/band-profile',
              tip: 'Booking agents copy-paste the short bio into listings',
            },
            {
              id: 'comparable',
              label: 'Comparable artists set',
              done: !!(p.comparable_artists),
              link: '/admin/band-profile',
              tip: '"For fans of X" is the most-read line on any EPK',
            },
          ],
        },
      ],
    },

    // ── Level 3 – Pro Band ─────────────────────────────────────────────────
    {
      level: 3,
      name: 'Pro Band',
      tagline: 'Establish your industry presence — EPK, agents, sync, media',
      emoji: '🏆',
      color: '#f472b6',
      sections: [
        {
          name: 'EPK & Promo',
          items: [
            {
              id: 'full-epk',
              label: 'Full EPK published (versioned)',
              done: props.epkPublished,
              link: '/admin/band-profile',
              tip: 'Create and publish a versioned EPK snapshot',
            },
            {
              id: 'featured-release',
              label: 'Featured release set on EPK',
              done: !!(p.epk_release_id),
              link: '/admin/band-profile',
              tip: 'Choose your best release to headline the EPK',
            },
            {
              id: 'tech-rider',
              label: 'Active tech rider built',
              done: props.techRiderActive,
              link: '/admin/tech-rider',
              tip: 'Professionals judge you by your rider — be specific',
            },
          ],
        },
        {
          name: 'Contacts & Industry',
          items: [
            {
              id: 'press-email',
              label: 'Press email set',
              done: !!(p.press_email),
              link: '/admin/band-profile',
              tip: 'Separate press contact for journalists and bloggers',
            },
            {
              id: 'tech-email',
              label: 'Tech contact email set',
              done: !!(p.tech_contact_email),
              link: '/admin/band-profile',
              tip: 'Venues need a dedicated tech contact for production',
            },
          ],
        },
        {
          name: 'Reach',
          items: [
            {
              id: 'ten-concerts',
              label: '10+ shows on record',
              done: props.concerts.length >= 10,
              link: '/admin/concerts',
              tip: 'Venues want to see your live history before booking',
            },
            {
              id: 'multi-press',
              label: '3+ press articles / media features',
              done: props.pressCount >= 3,
              link: '/admin/press-releases',
              tip: 'Media coverage builds credibility for festival applications',
            },
            {
              id: 'stats',
              label: 'Streaming / social stats entered',
              done: !!(p.stat_spotify_monthly || p.stat_instagram_followers),
              link: '/admin/band-profile',
              tip: 'Numbers make your EPK scannable in 10 seconds',
            },
          ],
        },
        {
          name: 'Content',
          items: [
            {
              id: 'full-bio',
              label: 'Full bio written (2–3 paragraphs)',
              done: !!(p.bio_long),
              link: '/admin/band-profile',
              tip: 'Required for festival programmes and booking agencies',
            },
            {
              id: 'statement',
              label: 'Artistic statement written',
              done: !!(p.artistic_statement),
              link: '/admin/band-profile',
              tip: 'Required for grant applications and premium festival programmers',
            },
          ],
        },
      ],
    },

    // ── Level 4 – Custom ──────────────────────────────────────────────────
    {
      level: 4,
      name: 'Custom',
      tagline: 'Define your own goals — personalised checklist for your band',
      emoji: '⚙️',
      color: '#fbbf24',
      isCustom: true,
      sections: [
        {
          name: 'Your Goals',
          items: [
            { id: 'custom-1', label: 'Goal 1 (placeholder)', done: false, link: '#', tip: 'Define your own milestone' },
            { id: 'custom-2', label: 'Goal 2 (placeholder)', done: false, link: '#', tip: 'Define your own milestone' },
            { id: 'custom-3', label: 'Goal 3 (placeholder)', done: false, link: '#', tip: 'Define your own milestone' },
          ],
        },
      ],
    },
  ]
})

// ── Computed state ────────────────────────────────────────────────────────────

const currentLevel   = computed(() => props.profile.career_level ?? 1)
const currentDef     = computed(() => LEVELS.value.find((l) => l.level === currentLevel.value)!)
const nextDef        = computed(() => LEVELS.value.find((l) => l.level === (currentLevel.value as number) + 1) ?? null)

const allItems       = computed(() => currentDef.value.sections.flatMap((s) => s.items))
const doneCount      = computed(() => allItems.value.filter((i) => i.done).length)
const totalItems     = computed(() => allItems.value.length)
const pct            = computed(() => Math.round((doneCount.value / totalItems.value) * 100))

const readyToAdvance = computed(
  () => !currentDef.value.isCustom && nextDef.value !== null && doneCount.value === totalItems.value
)

function advanceLevel() {
  if (!nextDef.value) return
  emit('update:level', nextDef.value.level as 1 | 2 | 3 | 4)
}
</script>

<template>
  <div class="clw">
    <!-- Level selector tabs -->
    <div class="clw-header">
      <div class="clw-tabs">
        <button
          v-for="lvl in LEVELS"
          :key="lvl.level"
          type="button"
          class="clw-tab"
          :class="{
            'clw-tab--active': lvl.level === currentLevel,
            'clw-tab--past':   lvl.level < currentLevel,
          }"
          @click="$emit('update:level', lvl.level)"
        >
          <span class="clw-tab-emoji">{{ lvl.emoji }}</span>
          <span class="clw-tab-name">{{ lvl.name }}</span>
          <span class="clw-tab-num">Level {{ lvl.level }}</span>
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="clw-body">

      <!-- Level meta + progress -->
      <div class="clw-meta">
        <div class="clw-meta-left">
          <div class="clw-tagline">{{ currentDef.emoji }} {{ currentDef.name }} — {{ currentDef.tagline }}</div>
          <div v-if="!currentDef.isCustom" class="clw-progress-row">
            <div class="clw-prog-wrap">
              <div class="clw-prog-bar" :style="`width:${pct}%; background:${currentDef.color}`" />
            </div>
            <span class="clw-prog-label" :style="`color:${currentDef.color}`">
              {{ doneCount }}/{{ totalItems }} complete
            </span>
          </div>
        </div>
        <div v-if="readyToAdvance" class="clw-advance-box">
          <div class="clw-advance-title">🎉 Level {{ currentLevel }} complete!</div>
          <div class="clw-advance-sub">You're ready for {{ nextDef!.emoji }} {{ nextDef!.name }}</div>
          <button type="button" class="clw-advance-btn" @click="advanceLevel">
            Advance to Level {{ nextDef!.level }} →
          </button>
        </div>
      </div>

      <!-- Custom level placeholder -->
      <div v-if="currentDef.isCustom" class="clw-custom-placeholder">
        <div class="clw-custom-icon">⚙️</div>
        <div class="clw-custom-title">Custom goals — coming soon</div>
        <div class="clw-custom-sub">
          Define your own milestones and targets. This level lets you build a personalised
          checklist matching your band's unique path — sync licensing, booking agency
          targets, streaming thresholds, and more.
        </div>
        <div class="clw-custom-preview">
          <div class="clw-custom-item" v-for="n in 4" :key="n">
            <span class="clw-custom-check">○</span>
            <span class="clw-custom-label">Custom goal {{ n }} — click to define</span>
          </div>
        </div>
      </div>

      <!-- Sectioned checklist -->
      <template v-else>
        <div
          v-for="section in currentDef.sections"
          :key="section.name"
          class="clw-section"
        >
          <div class="clw-section-title">{{ section.name }}</div>
          <div class="clw-checklist">
            <RouterLink
              v-for="item in section.items"
              :key="item.id"
              :to="item.link"
              class="clw-item"
              :class="item.done ? 'clw-item--done' : 'clw-item--todo'"
            >
              <span class="clw-check" :style="item.done ? `color:${currentDef.color}` : ''">
                {{ item.done ? '✓' : '○' }}
              </span>
              <span class="clw-label">{{ item.label }}</span>
              <span v-if="!item.done" class="clw-tip">{{ item.tip }}</span>
            </RouterLink>
          </div>
        </div>
      </template>

      <!-- Next level peek -->
      <div v-if="nextDef && !readyToAdvance && !currentDef.isCustom" class="clw-next-peek">
        <span class="clw-next-label">Next: {{ nextDef.emoji }} Level {{ nextDef.level }} — {{ nextDef.name }}</span>
        <span class="clw-next-sub">{{ nextDef.tagline }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.clw {
  background: #0d0d22; border: 1px solid #1a1a38; border-radius: 0.75rem; overflow: hidden;
}

/* ── Tab bar ──────────────────────────────────────────── */
.clw-header { border-bottom: 1px solid #1a1a38; }
.clw-tabs { display: flex; }

.clw-tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.1rem;
  padding: 0.625rem 0.5rem;
  background: transparent; border: none; cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: background 120ms, border-color 120ms;
}
.clw-tab:hover      { background: #111128; }
.clw-tab--active    { background: #111130; border-bottom-color: #6366f1; }
.clw-tab--past      { opacity: 0.6; }
.clw-tab-emoji      { font-size: 1.1rem; line-height: 1; }
.clw-tab-name       { font-size: 0.72rem; font-weight: 700; color: #e2e8f0; }
.clw-tab-num        { font-size: 0.6rem; color: #334155; text-transform: uppercase; letter-spacing: 0.06em; }
.clw-tab--active .clw-tab-name { color: #a5b4fc; }
.clw-tab--active .clw-tab-num  { color: #4338ca; }

/* ── Body ────────────────────────────────────────────── */
.clw-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }

.clw-meta { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.clw-meta-left { flex: 1; min-width: 0; }

.clw-tagline { font-size: 0.8125rem; font-weight: 600; color: #94a3b8; margin-bottom: 0.5rem; }

.clw-progress-row { display: flex; align-items: center; gap: 0.75rem; }
.clw-prog-wrap { width: 10rem; height: 5px; background: #1a1a38; border-radius: 3px; overflow: hidden; }
.clw-prog-bar { height: 100%; border-radius: 3px; transition: width 400ms; }
.clw-prog-label { font-size: 0.75rem; font-weight: 700; }

.clw-advance-box {
  display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-end;
  padding: 0.625rem 0.875rem; background: #0a0a1e; border: 1px solid #1e2040;
  border-radius: 0.5rem; border-left: 3px solid #34d399; flex-shrink: 0;
}
.clw-advance-title { font-size: 0.8rem; font-weight: 700; color: #34d399; }
.clw-advance-sub   { font-size: 0.7rem; color: #475569; }
.clw-advance-btn {
  margin-top: 0.25rem; padding: 0.3rem 0.875rem; border-radius: 0.375rem;
  font-size: 0.78rem; font-weight: 600; cursor: pointer;
  background: #14532d; border: 1px solid #15803d; color: #34d399;
  transition: background 100ms;
}
.clw-advance-btn:hover { background: #166534; }

/* ── Sections ────────────────────────────────────────── */
.clw-section {}
.clw-section-title {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: #334155; margin-bottom: 0.375rem; padding-left: 0.25rem;
}

.clw-checklist { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.25rem; }
.clw-item {
  display: flex; align-items: baseline; gap: 0.5rem; padding: 0.3rem 0.5rem;
  border-radius: 0.375rem; text-decoration: none; font-size: 0.8125rem;
  transition: background 100ms;
}
.clw-item:hover { background: #111128; }
.clw-check { font-size: 0.75rem; flex-shrink: 0; color: #334155; }
.clw-item--done .clw-label { color: #64748b; text-decoration: line-through; }
.clw-item--todo .clw-label { color: #94a3b8; }
.clw-tip { font-size: 0.68rem; color: #334155; margin-left: auto; text-align: right; max-width: 11rem; line-height: 1.4; }

/* ── Custom level placeholder ────────────────────────── */
.clw-custom-placeholder {
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
  padding: 1.5rem 1rem; text-align: center;
}
.clw-custom-icon  { font-size: 2rem; line-height: 1; }
.clw-custom-title { font-size: 0.875rem; font-weight: 700; color: #fbbf24; }
.clw-custom-sub   { font-size: 0.8rem; color: #475569; max-width: 32rem; line-height: 1.6; }
.clw-custom-preview {
  width: 100%; max-width: 28rem; display: flex; flex-direction: column; gap: 0.25rem;
  margin-top: 0.5rem;
}
.clw-custom-item {
  display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.75rem;
  background: #0a0a1e; border: 1px dashed #1e1b4b; border-radius: 0.375rem; opacity: 0.5;
}
.clw-custom-check { font-size: 0.75rem; color: #334155; }
.clw-custom-label { font-size: 0.8rem; color: #64748b; font-style: italic; }

/* ── Next level peek ─────────────────────────────────── */
.clw-next-peek {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.5rem 0.75rem; background: #0a0a1a; border: 1px solid #15152a;
  border-radius: 0.375rem;
}
.clw-next-label { font-size: 0.78rem; font-weight: 600; color: #334155; }
.clw-next-sub   { font-size: 0.72rem; color: #1e293b; }
</style>
