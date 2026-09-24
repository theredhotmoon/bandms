<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { adminUrl } from '@/config/admin'
import type { BandProfile } from '@/types/bandProfile'
import type { Concert } from '@/types/concert'
import type { ReleaseSummary } from '@/types/release'

const { t } = useI18n()

// CSS, not copy — kept out of the template so the string lint is not asked
// to judge `width:%; background:` as a sentence.
const progressStyle = computed(() => ({ width: `${pct.value}%`, background: currentDef.value.color })) // i18n-ignore: CSS

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
      name: t('band.career.levels.l1.name'),
      tagline: t('band.career.levels.l1.tagline'),
      emoji: '🎸',
      color: '#34d399',
      sections: [
        {
          name: t('band.career.sections.identity'),
          items: [
            {
              id: 'name-bio',
              label: t('band.career.items.nameBio.label'),
              done: !!(p.name && p.bio_short),
              link: adminUrl('band-profile'),
              tip: t('band.career.items.nameBio.tip'),
            },
            {
              id: 'hometown',
              label: t('band.career.items.hometown.label'),
              done: !!(p.hometown && p.formation_year),
              link: adminUrl('band-profile'),
              tip: t('band.career.items.hometown.tip'),
            },
            {
              id: 'genres',
              label: t('band.career.items.genres.label'),
              done: !!(p.genres),
              link: adminUrl('band-profile'),
              tip: t('band.career.items.genres.tip'),
            },
          ],
        },
        {
          name: t('band.career.sections.band'),
          items: [
            {
              id: 'members',
              label: t('band.career.items.members.label'),
              done: props.membersCount >= 2,
              link: adminUrl('band-members'),
              tip: t('band.career.items.members.tip'),
            },
          ],
        },
        {
          name: t('band.career.sections.firstMusic'),
          items: [
            {
              id: 'first-release',
              label: t('band.career.items.firstRelease.label'),
              done: props.releases.length >= 1,
              link: adminUrl('releases'),
              tip: t('band.career.items.firstRelease.tip'),
            },
            {
              id: 'cover-art',
              label: t('band.career.items.coverArt.label'),
              done: props.releases.some((r) => !!r.cover_image),
              link: adminUrl('releases'),
              tip: t('band.career.items.coverArt.tip'),
            },
          ],
        },
        {
          name: t('band.career.sections.onlinePresence'),
          items: [
            {
              id: 'social-links',
              label: t('band.career.items.socialLinks.label'),
              done: !!(p.social_links?.length && p.social_links.length >= 2),
              link: adminUrl('band-profile'),
              tip: t('band.career.items.socialLinks.tip'),
            },
            {
              id: 'booking-email',
              label: t('band.career.items.bookingEmail.label'),
              done: !!(p.booking_email),
              link: adminUrl('band-profile'),
              tip: t('band.career.items.bookingEmail.tip'),
            },
          ],
        },
      ],
    },

    // ── Level 2 – Local Band ───────────────────────────────────────────────
    {
      level: 2,
      name: t('band.career.levels.l2.name'),
      tagline: t('band.career.levels.l2.tagline'),
      emoji: '🌿',
      color: '#60a5fa',
      sections: [
        {
          name: t('band.career.sections.releasesMusic'),
          items: [
            {
              id: 'multi-releases',
              label: t('band.career.items.multiReleases.label'),
              done: props.releases.length >= 3,
              link: adminUrl('releases'),
              tip: t('band.career.items.multiReleases.tip'),
            },
            {
              id: 'music-video',
              label: t('band.career.items.musicVideo.label'),
              done: props.musicVideosCount >= 1,
              link: adminUrl('music-videos'),
              tip: t('band.career.items.musicVideo.tip'),
            },
          ],
        },
        {
          name: t('band.career.sections.liveActivity'),
          items: [
            {
              id: 'concerts',
              label: t('band.career.items.concerts.label'),
              done: props.concerts.length >= 3,
              link: adminUrl('concerts'),
              tip: t('band.career.items.concerts.tip'),
            },
            {
              id: 'upcoming-show',
              label: t('band.career.items.upcomingShow.label'),
              done: hasUpcoming(),
              link: adminUrl('concerts'),
              tip: t('band.career.items.upcomingShow.tip'),
            },
          ],
        },
        {
          name: t('band.career.sections.contentPress'),
          items: [
            {
              id: 'first-press',
              label: t('band.career.items.firstPress.label'),
              done: props.pressCount >= 1,
              link: adminUrl('press-releases'),
              tip: t('band.career.items.firstPress.tip'),
            },
            {
              id: 'news-posts',
              label: t('band.career.items.newsPosts.label'),
              done: props.postsCount >= 3,
              link: adminUrl('posts'),
              tip: t('band.career.items.newsPosts.tip'),
            },
          ],
        },
        {
          name: t('band.career.sections.discovery'),
          items: [
            {
              id: 'bio-variants',
              label: t('band.career.items.bioVariants.label'),
              done: !!(p.bio_short && p.bio_medium),
              link: adminUrl('band-profile'),
              tip: t('band.career.items.bioVariants.tip'),
            },
            {
              id: 'comparable',
              label: t('band.career.items.comparable.label'),
              done: !!(p.comparable_artists),
              link: adminUrl('band-profile'),
              tip: t('band.career.items.comparable.tip'),
            },
          ],
        },
      ],
    },

    // ── Level 3 – Pro Band ─────────────────────────────────────────────────
    {
      level: 3,
      name: t('band.career.levels.l3.name'),
      tagline: t('band.career.levels.l3.tagline'),
      emoji: '🏆',
      color: '#f472b6',
      sections: [
        {
          name: t('band.career.sections.ePKPromo'),
          items: [
            {
              id: 'full-epk',
              label: t('band.career.items.fullEpk.label'),
              done: props.epkPublished,
              link: adminUrl('band-profile'),
              tip: t('band.career.items.fullEpk.tip'),
            },
            {
              id: 'featured-release',
              label: t('band.career.items.featuredRelease.label'),
              done: !!(p.epk_release_id),
              link: adminUrl('band-profile'),
              tip: t('band.career.items.featuredRelease.tip'),
            },
            {
              id: 'tech-rider',
              label: t('band.career.items.techRider.label'),
              done: props.techRiderActive,
              link: adminUrl('tech-rider'),
              tip: t('band.career.items.techRider.tip'),
            },
          ],
        },
        {
          name: t('band.career.sections.contactsIndustry'),
          items: [
            {
              id: 'press-email',
              label: t('band.career.items.pressEmail.label'),
              done: !!(p.press_email),
              link: adminUrl('band-profile'),
              tip: t('band.career.items.pressEmail.tip'),
            },
            {
              id: 'tech-email',
              label: t('band.career.items.techEmail.label'),
              done: !!(p.tech_contact_email),
              link: adminUrl('band-profile'),
              tip: t('band.career.items.techEmail.tip'),
            },
          ],
        },
        {
          name: t('band.career.sections.reach'),
          items: [
            {
              id: 'ten-concerts',
              label: t('band.career.items.tenConcerts.label'),
              done: props.concerts.length >= 10,
              link: adminUrl('concerts'),
              tip: t('band.career.items.tenConcerts.tip'),
            },
            {
              id: 'multi-press',
              label: t('band.career.items.multiPress.label'),
              done: props.pressCount >= 3,
              link: adminUrl('press-releases'),
              tip: t('band.career.items.multiPress.tip'),
            },
            {
              id: 'stats',
              label: t('band.career.items.stats.label'),
              done: !!(p.stat_spotify_monthly || p.stat_instagram_followers),
              link: adminUrl('band-profile'),
              tip: t('band.career.items.stats.tip'),
            },
          ],
        },
        {
          name: t('band.career.sections.content'),
          items: [
            {
              id: 'full-bio',
              label: t('band.career.items.fullBio.label'),
              done: !!(p.bio_long),
              link: adminUrl('band-profile'),
              tip: t('band.career.items.fullBio.tip'),
            },
            {
              id: 'statement',
              label: t('band.career.items.statement.label'),
              done: !!(p.artistic_statement),
              link: adminUrl('band-profile'),
              tip: t('band.career.items.statement.tip'),
            },
          ],
        },
      ],
    },

    // ── Level 4 – Custom ──────────────────────────────────────────────────
    {
      level: 4,
      name: t('band.career.levels.l4.name'),
      tagline: t('band.career.levels.l4.tagline'),
      emoji: '⚙️',
      color: '#fbbf24',
      isCustom: true,
      sections: [
        {
          name: t('band.career.sections.yourGoals'),
          items: [
            { id: 'custom-1', label: t('band.career.customGoal.label', { n: 1 }), done: false, link: '#', tip: t('band.career.customGoal.tip') },
            { id: 'custom-2', label: t('band.career.customGoal.label', { n: 2 }), done: false, link: '#', tip: t('band.career.customGoal.tip') },
            { id: 'custom-3', label: t('band.career.customGoal.label', { n: 3 }), done: false, link: '#', tip: t('band.career.customGoal.tip') },
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
              <div class="clw-prog-bar" :style="progressStyle" />
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
  background: #141414; border: 1px solid #222222; border-radius: 0.75rem; overflow: hidden;
}

/* ── Tab bar ──────────────────────────────────────────── */
.clw-header { border-bottom: 1px solid #222222; }
.clw-tabs { display: flex; }

.clw-tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.1rem;
  padding: 0.625rem 0.5rem;
  background: transparent; border: none; cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: background 120ms, border-color 120ms;
}
.clw-tab:hover      { background: #1a1a1a; }
.clw-tab--active    { background: #1f1f1f; border-bottom-color: #ffffff; }
.clw-tab--past      { opacity: 0.6; }
.clw-tab-emoji      { font-size: 1.1rem; line-height: 1; }
.clw-tab-name       { font-size: 0.72rem; font-weight: 700; color: #e2e8f0; }
.clw-tab-num        { font-size: 0.6rem; color: #555555; text-transform: uppercase; letter-spacing: 0.06em; }
.clw-tab--active .clw-tab-name { color: #ffffff; }
.clw-tab--active .clw-tab-num  { color: #aaaaaa; }

/* ── Body ────────────────────────────────────────────── */
.clw-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }

.clw-meta { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.clw-meta-left { flex: 1; min-width: 0; }

.clw-tagline { font-size: 0.8125rem; font-weight: 600; color: #94a3b8; margin-bottom: 0.5rem; }

.clw-progress-row { display: flex; align-items: center; gap: 0.75rem; }
.clw-prog-wrap { width: 10rem; height: 5px; background: #222222; border-radius: 3px; overflow: hidden; }
.clw-prog-bar { height: 100%; border-radius: 3px; transition: width 400ms; }
.clw-prog-label { font-size: 0.75rem; font-weight: 700; }

.clw-advance-box {
  display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-end;
  padding: 0.625rem 0.875rem; background: #111111; border: 1px solid #2a2a2a;
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
.clw-item:hover { background: #1a1a1a; }
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
  background: #111111; border: 1px dashed #2a2a2a; border-radius: 0.375rem; opacity: 0.5;
}
.clw-custom-check { font-size: 0.75rem; color: #334155; }
.clw-custom-label { font-size: 0.8rem; color: #64748b; font-style: italic; }

/* ── Next level peek ─────────────────────────────────── */
.clw-next-peek {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.5rem 0.75rem; background: #111111; border: 1px solid #1f1f1f;
  border-radius: 0.375rem;
}
.clw-next-label { font-size: 0.78rem; font-weight: 600; color: #334155; }
.clw-next-sub   { font-size: 0.72rem; color: #555555; }
</style>
