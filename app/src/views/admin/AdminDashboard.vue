<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import CareerLevelWidget from '@/components/admin/CareerLevelWidget.vue'
import { useBands } from '@/composables/useBands'
import { useVenues } from '@/composables/useVenues'
import { useConcerts } from '@/composables/useConcerts'
import { useCategories } from '@/composables/useCategories'
import { useTags } from '@/composables/useTags'
import { useReleases } from '@/composables/useReleases'
import { useTours } from '@/composables/useTours'
import { useAuth } from '@/composables/useAuth'
import { useBandProfile } from '@/composables/useBandProfile'
import { usePressReleases } from '@/composables/usePressReleases'
import { useMusicVideos } from '@/composables/useMusicVideos'
import { useEpkVersions } from '@/composables/useEpkVersions'
import { usePosts } from '@/composables/usePosts'
import { useTechRiders } from '@/composables/useTechRiders'

const { user } = useAuth()
const { query: epkVersionsQ, publish: publishEpk, discard: discardEpk } = useEpkVersions()

const pendingVersion  = computed(() => epkVersionsQ.data.value?.find((v) => v.status === 'pending') ?? null)
const publishedVersion = computed(() => epkVersionsQ.data.value?.find((v) => v.status === 'published') ?? null)

async function handlePublish(id: number) {
  try {
    await publishEpk.mutateAsync(id)
    toast.success('EPK version published — now live at /epk')
  } catch { toast.error('Failed to publish') }
}

async function handleDiscard(id: number) {
  try {
    await discardEpk.mutateAsync(id)
    toast.success('Snapshot discarded')
  } catch { toast.error('Failed to discard') }
}
const { query: bandsQ } = useBands()
const { query: venuesQ } = useVenues()
const { query: concertsQ } = useConcerts()
const { query: categoriesQ } = useCategories()
const { query: tagsQ } = useTags()
const { query: releasesQ } = useReleases()
const { query: toursQ }    = useTours()
const { query: profileQ, update: updateProfile } = useBandProfile()
const { query: pressQ } = usePressReleases()
const { query: videosQ } = useMusicVideos()
const { query: postsQ } = usePosts()
const { list: techRidersQ } = useTechRiders()

async function handleLevelUpdate(level: 1 | 2 | 3 | 4) {
  try {
    await updateProfile.mutateAsync({ career_level: level })
  } catch { toast.error('Failed to update career level') }
}

const stats = computed(() => [
  { label: 'Bands', count: bandsQ.data.value?.length, link: '/admin/bands', color: '#818cf8' },
  { label: 'Releases', count: releasesQ.data.value?.length, link: '/admin/releases', color: '#f472b6' },
  { label: 'Tours',    count: toursQ.data.value?.length,   link: '/admin/tours',    color: '#fbbf24' },
  { label: 'Venues', count: venuesQ.data.value?.length, link: '/admin/venues', color: '#34d399' },
  { label: 'Concerts', count: concertsQ.data.value?.length, link: '/admin/concerts', color: '#fb923c' },
  { label: 'Categories', count: categoriesQ.data.value?.length, link: '/admin/categories', color: '#a78bfa' },
  { label: 'Tags', count: tagsQ.data.value?.length, link: '/admin/tags', color: '#22d3ee' },
])


function prRichnessScore(pr: { og_title: string | null; og_image: string | null; featured: boolean; tags: unknown[]; concerts_count: number; posts_count: number; albums_count: number; releases_count: number; tours_count: number; authors_count: number }): number {
  return (
    (pr.og_title   ? 1 : 0) +
    (pr.og_image   ? 1 : 0) +
    (pr.featured   ? 1 : 0) +
    Math.min(pr.tags.length, 3) +
    (pr.concerts_count  > 0 ? 1 : 0) +
    (pr.releases_count  > 0 ? 1 : 0) +
    (pr.albums_count    > 0 ? 1 : 0) +
    (pr.tours_count     > 0 ? 1 : 0) +
    (pr.posts_count     > 0 ? 1 : 0) +
    (pr.authors_count   > 0 ? 1 : 0)
  )
}

const PR_MAX_SCORE = 13

const enhancedPressItems = computed(() => {
  const items = pressQ.data.value ?? []
  return items
    .map((pr) => ({ pr, score: prRichnessScore(pr) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
})

const avgEnhanceScore = computed(() => {
  const items = pressQ.data.value ?? []
  if (!items.length) return 0
  const sum = items.reduce((acc, pr) => acc + prRichnessScore(pr), 0)
  return Math.round((sum / items.length / PR_MAX_SCORE) * 100)
})
</script>

<template>
  <AdminLayout>
    <div class="p-8 max-w-4xl">
      <div class="mb-8">
        <h1 class="text-xl font-bold mb-1" style="color:#e2e8f0;">
          Welcome back<span v-if="user">, {{ user.first_name }}</span>
        </h1>
        <p class="text-sm" style="color:#64748b;">BandMS Admin Panel — manage all your content below.</p>
      </div>

      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        <RouterLink
          v-for="s in stats"
          :key="s.label"
          :to="s.link"
          class="stat-card"
        >
          <div class="text-2xl font-bold tabular-nums mb-1" :style="`color:${s.color};`">
            {{ s.count ?? '—' }}
          </div>
          <div class="text-xs font-medium" style="color:#94a3b8;">{{ s.label }}</div>
        </RouterLink>
      </div>

      <!-- EPK Versions widget -->
      <div class="readiness-widget" v-if="epkVersionsQ.data.value !== undefined">
        <div class="readiness-header">
          <div>
            <div class="readiness-title">EPK Versions</div>
            <div class="readiness-sub">
              <span v-if="publishedVersion">Live: v{{ publishedVersion.version_number }} ({{ publishedVersion.published_at?.slice(0,10) }})</span>
              <span v-else style="color:#f87171;">No published version — EPK shows live data</span>
            </div>
          </div>
          <RouterLink to="/admin/band-profile" class="epk-create-link">Create snapshot →</RouterLink>
        </div>

        <div v-if="pendingVersion" class="epk-pending">
          <div class="epk-pending-badge">Pending review</div>
          <div class="epk-pending-meta">
            <span class="epk-version-num">v{{ pendingVersion.version_number }}</span>
            <span class="epk-pending-date">{{ pendingVersion.created_at?.slice(0,10) }}</span>
            <span v-if="pendingVersion.release_reason" class="epk-pending-reason">{{ pendingVersion.release_reason }}</span>
          </div>
          <div class="epk-pending-actions">
            <button
              class="btn-epk-publish"
              :disabled="publishEpk.isPending.value"
              @click="handlePublish(pendingVersion.id)"
            >{{ publishEpk.isPending.value ? 'Publishing…' : 'Publish' }}</button>
            <button
              class="btn-epk-discard"
              :disabled="discardEpk.isPending.value"
              @click="handleDiscard(pendingVersion.id)"
            >Discard</button>
          </div>
        </div>
        <div v-else class="epk-no-pending">
          No pending snapshot. Go to <RouterLink to="/admin/band-profile" style="color:#818cf8;">Band Profile → EPK</RouterLink> to create one.
        </div>
      </div>

      <!-- Career level widget -->
      <div class="mt-8" v-if="profileQ.data.value">
        <div class="readiness-title mb-2">Band Career Level</div>
        <CareerLevelWidget
          :profile="profileQ.data.value"
          :concerts="concertsQ.data.value ?? []"
          :releases="releasesQ.data.value ?? []"
          :press-count="pressQ.data.value?.length ?? 0"
          :posts-count="postsQ.data.value?.length ?? 0"
          :music-videos-count="videosQ.data.value?.length ?? 0"
          :members-count="profileQ.data.value.members?.length ?? 0"
          :tech-rider-active="techRidersQ.data.value?.some((r) => r.is_active) ?? false"
          :epk-published="!!publishedVersion"
          @update:level="handleLevelUpdate"
        />
      </div>

      <!-- Enhance level widget -->
      <div class="readiness-widget" v-if="pressQ.data.value?.length">
        <div class="readiness-header">
          <div>
            <div class="readiness-title">Press Coverage Enhance Level</div>
            <div class="readiness-sub">Enrich each article with tags, concerts, releases and authors to increase score.</div>
          </div>
          <div class="score-ring">
            <svg viewBox="0 0 40 40" class="ring-svg">
              <circle cx="20" cy="20" r="16" fill="none" stroke="#1a1a38" stroke-width="4" />
              <circle
                cx="20" cy="20" r="16" fill="none"
                :stroke="avgEnhanceScore >= 70 ? '#34d399' : avgEnhanceScore >= 40 ? '#fbbf24' : '#f87171'"
                stroke-width="4"
                stroke-linecap="round"
                :stroke-dasharray="`${avgEnhanceScore} 100`"
                stroke-dashoffset="25"
                transform="rotate(-90 20 20)"
              />
            </svg>
            <span class="ring-pct" :style="avgEnhanceScore >= 70 ? 'color:#34d399' : avgEnhanceScore >= 40 ? 'color:#fbbf24' : 'color:#f87171'">
              {{ avgEnhanceScore }}%
            </span>
          </div>
        </div>

        <div class="enhance-sub">Lowest-scoring articles — click to improve:</div>
        <div class="enhance-list">
          <RouterLink
            v-for="{ pr, score: s } in enhancedPressItems"
            :key="pr.id"
            to="/admin/press-releases"
            class="enhance-item"
          >
            <div class="enhance-bar-wrap">
              <div
                class="enhance-bar"
                :style="`width:${Math.round(s / PR_MAX_SCORE * 100)}%;background:${s / PR_MAX_SCORE >= 0.7 ? '#34d399' : s / PR_MAX_SCORE >= 0.4 ? '#fbbf24' : '#f87171'}`"
              />
            </div>
            <span class="enhance-score">{{ s }}/{{ PR_MAX_SCORE }}</span>
            <span class="enhance-label">{{ pr.og_title ?? pr.url }}</span>
          </RouterLink>
        </div>
      </div>

      <div class="mt-8">
        <h2 class="text-xs font-semibold uppercase tracking-wider mb-3" style="color:#475569;">Quick actions</h2>
        <div class="flex flex-wrap gap-2">
          <RouterLink to="/admin/bands" class="quick-btn">+ Band</RouterLink>
          <RouterLink to="/admin/venues" class="quick-btn">+ Venue</RouterLink>
          <RouterLink to="/admin/concerts" class="quick-btn">+ Concert</RouterLink>
          <RouterLink to="/admin/posts" class="quick-btn">+ Post</RouterLink>
          <RouterLink to="/admin/releases" class="quick-btn">+ Release</RouterLink>
          <RouterLink to="/admin/tours" class="quick-btn">+ Tour</RouterLink>
          <RouterLink to="/admin/photos" class="quick-btn">+ Photo</RouterLink>
          <RouterLink to="/admin/music-videos" class="quick-btn">+ Video</RouterLink>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.stat-card {
  display: flex; flex-direction: column; justify-content: center;
  padding: 1.25rem; border-radius: 0.75rem; text-decoration: none;
  background: #111128; border: 1px solid #2d2a6e;
  transition: border-color 150ms, background 150ms;
}
.stat-card:hover { background: #151535; border-color: #4338ca; }
.quick-btn {
  padding: 0.375rem 0.875rem; border-radius: 0.5rem; font-size: 0.8125rem;
  font-weight: 500; text-decoration: none; color: #a5b4fc;
  background: #1e1b4b; border: 1px solid #312e81;
  transition: background 120ms;
}
.quick-btn:hover { background: #2d2a6e; }

/* EPK widget */
.epk-create-link {
  font-size: 0.78rem; color: #818cf8; text-decoration: none;
  white-space: nowrap; padding: 0.3rem 0.75rem;
  border: 1px solid #252350; border-radius: 0.375rem;
  transition: background 100ms;
}
.epk-create-link:hover { background: #1e1b4b; }

.epk-pending {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
  padding: 0.625rem 0.75rem; background: #0b0b20; border: 1px solid #252370;
  border-radius: 0.5rem;
}
.epk-pending-badge {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  padding: 0.2rem 0.5rem; border-radius: 9999px; background: #1a1740; color: #fbbf24;
  flex-shrink: 0;
}
.epk-pending-meta { display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; }
.epk-version-num { font-size: 0.85rem; font-weight: 700; color: #a5b4fc; }
.epk-pending-date { font-size: 0.75rem; color: #475569; }
.epk-pending-reason { font-size: 0.78rem; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.epk-pending-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

.btn-epk-publish {
  padding: 0.3rem 0.875rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; background: #14532d; border: 1px solid #15803d; color: #34d399;
  transition: background 100ms;
}
.btn-epk-publish:hover:not(:disabled) { background: #166534; }
.btn-epk-publish:disabled { opacity: 0.5; cursor: default; }

.btn-epk-discard {
  padding: 0.3rem 0.875rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; background: transparent; border: 1px solid #7f1d1d; color: #f87171;
  transition: background 100ms;
}
.btn-epk-discard:hover:not(:disabled) { background: #450a0a; }
.btn-epk-discard:disabled { opacity: 0.5; cursor: default; }

.epk-no-pending { font-size: 0.8125rem; color: #475569; }

/* Career level section heading */
.readiness-title { font-size: 0.875rem; font-weight: 700; color: #e2e8f0; }

/* Shared widget shell (used by EPK versions + enhance level) */
.readiness-widget {
  margin-top: 2rem; background: #0d0d22; border: 1px solid #1a1a38;
  border-radius: 0.75rem; padding: 1.25rem 1.5rem;
}
.readiness-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;
}
.readiness-sub { font-size: 0.75rem; color: #475569; margin-top: 0.125rem; }
.score-ring { position: relative; width: 3.5rem; height: 3.5rem; flex-shrink: 0; }
.ring-svg   { width: 100%; height: 100%; }
.ring-pct   {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 700;
}

/* Enhance level widget */
.enhance-sub { font-size: 0.72rem; color: #475569; margin-bottom: 0.625rem; }
.enhance-list { display: flex; flex-direction: column; gap: 0.375rem; }
.enhance-item {
  display: flex; align-items: center; gap: 0.75rem; padding: 0.375rem 0.5rem;
  border-radius: 0.375rem; text-decoration: none; transition: background 100ms;
}
.enhance-item:hover { background: #111128; }
.enhance-bar-wrap { width: 5rem; height: 4px; background: #1a1a38; border-radius: 2px; flex-shrink: 0; overflow: hidden; }
.enhance-bar { height: 100%; border-radius: 2px; transition: width 400ms; }
.enhance-score { font-size: 0.7rem; font-weight: 700; color: #475569; width: 2.5rem; flex-shrink: 0; }
.enhance-label {
  font-size: 0.8125rem; color: #94a3b8; min-width: 0; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
</style>
