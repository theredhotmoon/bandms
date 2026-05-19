<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBandProfile } from '@/composables/useBandProfile'
import { useBandMembers } from '@/composables/useBandMembers'
import BandMembersTimeline from '@/components/BandMembersTimeline.vue'
import type { BandMember } from '@/types/bandMember'

const { query: profileQuery } = useBandProfile()
const { query: membersQuery  } = useBandMembers()

const profile = computed(() => profileQuery.data.value)

const allMembers     = computed(() => membersQuery.data.value ?? [])
const currentMembers = computed(() => allMembers.value.filter((m: BandMember) => m.is_current))

const showTimeline = ref(false)

interface BioVersion {
  key: 'bio_short' | 'bio_medium' | 'bio_long' | 'bio_full'
  label: string
  hint: string
}

const bioVersions: BioVersion[] = [
  { key: 'bio_short',  label: 'Short',  hint: '~100 words' },
  { key: 'bio_medium', label: 'Medium', hint: '~200 words' },
  { key: 'bio_long',   label: 'Long',   hint: '~400 words' },
  { key: 'bio_full',   label: 'Full',   hint: 'complete'   },
]

const filledBios = computed(() =>
  bioVersions.filter(v => !!profile.value?.[v.key]?.trim())
)

function initials(m: BandMember) {
  return (m.first_name[0] + m.last_name[0]).toUpperCase()
}
</script>

<template>
  <div class="about-page">
    <div v-if="profileQuery.isPending.value" class="loading">Loading…</div>

    <template v-else-if="profile">

      <!-- ── Header ─────────────────────────────────────────────── -->
      <header class="page-header">
        <div class="page-header-inner">
          <p class="page-eyebrow">About</p>
          <h1 class="page-title">{{ profile.name }}</h1>
          <p v-if="profile.hometown || profile.formation_year || profile.genres" class="page-sub">
            <template v-if="profile.formation_year">Est. {{ profile.formation_year }}</template>
            <template v-if="profile.formation_year && (profile.hometown || profile.genres)"> · </template>
            <template v-if="profile.hometown">{{ profile.hometown }}</template>
            <template v-if="profile.hometown && profile.genres"> · </template>
            <template v-if="profile.genres">{{ profile.genres }}</template>
          </p>
        </div>
      </header>

      <!-- ── Bio versions ──────────────────────────────────────── -->
      <div v-if="filledBios.length" class="section-wrap">
        <h2 class="section-heading">Bio</h2>
        <div class="bios-stack">
          <section v-for="bio in filledBios" :key="bio.key" class="bio-card">
            <div class="bio-card-header">
              <span class="bio-label">{{ bio.label }}</span>
              <span class="bio-hint">{{ bio.hint }}</span>
            </div>
            <p class="bio-text">{{ profile[bio.key] }}</p>
          </section>
        </div>
      </div>

      <!-- ── Current members ───────────────────────────────────── -->
      <div v-if="currentMembers.length" class="section-wrap">
        <div class="members-heading-row">
          <h2 class="section-heading">Current members</h2>
          <button
            v-if="allMembers.length"
            class="btn-timeline"
            @click="showTimeline = true"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
              <path d="M2 12h20M2 6h20M2 18h20"/>
            </svg>
            Band members timeline
          </button>
        </div>

        <div class="members-grid">
          <div v-for="m in currentMembers" :key="m.id" class="member-card">
            <!-- Photo -->
            <div class="member-photo-wrap">
              <img v-if="m.photo" :src="m.photo" :alt="`${m.first_name} ${m.last_name}`" class="member-photo" />
              <div v-else class="member-initials">{{ initials(m) }}</div>
            </div>

            <!-- Identity -->
            <div class="member-name">{{ m.first_name }} {{ m.last_name }}</div>
            <div v-if="m.role" class="member-role">{{ m.role }}</div>

            <!-- Instruments -->
            <div v-if="m.instruments?.length" class="member-instruments">
              <span v-for="i in m.instruments" :key="i.id" class="instr-tag">{{ i.name }}</span>
            </div>

            <!-- Bio excerpt -->
            <p v-if="m.bio" class="member-bio">
              {{ m.bio.length > 120 ? m.bio.slice(0, 120) + '…' : m.bio }}
            </p>

            <!-- Social links -->
            <div v-if="m.social_links?.length" class="member-socials">
              <a
                v-for="l in m.social_links"
                :key="l.id"
                :href="l.url"
                target="_blank"
                rel="noopener noreferrer"
                class="social-link"
              >{{ l.platform }}</a>
            </div>
          </div>
        </div>
      </div>

    </template>

    <!-- Timeline modal -->
    <BandMembersTimeline
      v-if="showTimeline"
      :members="allMembers"
      @close="showTimeline = false"
    />
  </div>
</template>

<style scoped>
.about-page {
  min-height: calc(100vh - 56px);
  background: #fff;
  color: #111;
}

.loading {
  padding: 4rem 1.5rem;
  text-align: center;
  color: #888;
}

/* ── Header ─────────────────────────────────────────────────── */
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

/* ── Shared section wrapper ───────────────────────────────── */
.section-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 0;
}

.section-heading {
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: #888; margin-bottom: 1.25rem;
}

/* ── Bio cards ────────────────────────────────────────────── */
.bios-stack { display: flex; flex-direction: column; gap: 1rem; padding-bottom: 2.5rem; }

.bio-card {
  border: 1px solid #e0e0e0; border-radius: 0.75rem;
  padding: 1.25rem 1.5rem; background: #fafafa;
}

.bio-card-header {
  display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.875rem;
}

.bio-label {
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: #555;
  background: #f0f0f0; border: 1px solid #ddd;
  border-radius: 0.375rem; padding: 0.2rem 0.6rem;
}

.bio-hint { font-size: 0.75rem; color: #888; }

.bio-text {
  font-size: 0.9375rem; line-height: 1.75; color: #333; white-space: pre-wrap;
}

/* ── Members heading row ──────────────────────────────────── */
.members-heading-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1.25rem; gap: 1rem;
}

.members-heading-row .section-heading { margin-bottom: 0; }

.btn-timeline {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.875rem; border-radius: 0.5rem;
  font-size: 0.8125rem; font-weight: 500;
  background: #f0f0f0; color: #333;
  border: 1px solid #ddd; cursor: pointer;
  transition: background 120ms, border-color 120ms;
  white-space: nowrap;
}
.btn-timeline:hover { background: #e0e0e0; border-color: #bbb; }

/* ── Members grid ─────────────────────────────────────────── */
.members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  padding-bottom: 3rem;
}

.member-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 0.875rem;
  padding: 1.25rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.375rem;
  transition: border-color 150ms;
}
.member-card:hover { border-color: #bbb; }

.member-photo-wrap { margin-bottom: 0.375rem; }

.member-photo {
  width: 72px; height: 72px; border-radius: 50%; object-fit: cover;
  border: 2px solid #ddd; display: block;
}

.member-initials {
  width: 72px; height: 72px; border-radius: 50%;
  background: #f0f0f0; border: 2px solid #ddd;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.375rem; font-weight: 700; color: #555;
}

.member-name { font-size: 0.9375rem; font-weight: 700; color: #111; }
.member-role { font-size: 0.75rem; color: #555; }

.member-instruments {
  display: flex; flex-wrap: wrap; gap: 4px; justify-content: center;
  margin-top: 0.125rem;
}
.instr-tag {
  font-size: 0.65rem; padding: 0.15rem 0.45rem; border-radius: 0.25rem;
  background: #f5f5f5; color: #555; border: 1px solid #e0e0e0;
}

.member-bio {
  font-size: 0.75rem; line-height: 1.5; color: #888; margin-top: 0.25rem;
}

.member-socials {
  display: flex; flex-wrap: wrap; gap: 4px; justify-content: center;
  margin-top: 0.25rem;
}
.social-link {
  font-size: 0.65rem; padding: 0.15rem 0.5rem; border-radius: 0.25rem;
  background: #f5f5f5; color: #333; border: 1px solid #e0e0e0;
  text-decoration: none; text-transform: capitalize;
  transition: background 100ms;
}
.social-link:hover { background: #e0e0e0; }
</style>
