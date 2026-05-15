<script setup lang="ts">
import { computed } from 'vue'
import { useBandProfile } from '@/composables/useBandProfile'

const { query } = useBandProfile()
const profile = computed(() => query.data.value)

interface BioVersion {
  key: 'bio_short' | 'bio_medium' | 'bio_long' | 'bio_full'
  label: string
  wordCount: string
}

const bioVersions: BioVersion[] = [
  { key: 'bio_short',  label: 'Short',  wordCount: '~100 words' },
  { key: 'bio_medium', label: 'Medium', wordCount: '~200 words' },
  { key: 'bio_long',   label: 'Long',   wordCount: '~400 words' },
  { key: 'bio_full',   label: 'Full',   wordCount: 'complete'   },
]

const filledBios = computed(() =>
  bioVersions.filter((v) => !!profile.value?.[v.key]?.trim())
)
</script>

<template>
  <div class="about-page">
    <div v-if="query.isPending.value" class="loading">Loading…</div>

    <template v-else-if="profile">
      <header class="about-header">
        <p class="about-eyebrow">About</p>
        <h1 class="about-name">{{ profile.name }}</h1>
        <div v-if="profile.hometown || profile.formation_year || profile.genres" class="about-meta">
          <span v-if="profile.formation_year">est. {{ profile.formation_year }}</span>
          <span v-if="profile.hometown">{{ profile.hometown }}</span>
          <span v-if="profile.genres">{{ profile.genres }}</span>
        </div>
      </header>

      <div v-if="filledBios.length" class="bios-wrap">
        <section
          v-for="bio in filledBios"
          :key="bio.key"
          class="bio-section"
        >
          <div class="bio-header">
            <span class="bio-label">{{ bio.label }}</span>
            <span class="bio-wordcount">{{ bio.wordCount }}</span>
          </div>
          <p class="bio-text">{{ profile[bio.key] }}</p>
        </section>
      </div>

      <p v-else class="empty">No bio available yet.</p>
    </template>
  </div>
</template>

<style scoped>
.about-page {
  min-height: calc(100vh - 56px);
  background: #08081a;
  color: #e2e8f0;
}

.loading {
  padding: 4rem 1.5rem;
  text-align: center;
  color: #64748b;
}

/* ── Header ──────────────────────────────────────────── */
.about-header {
  padding: 4rem 1.5rem 3rem;
  background: linear-gradient(180deg, #0d0d22 0%, #08081a 100%);
  border-bottom: 1px solid #1e1b4b;
  max-width: 720px;
  margin: 0 auto;
}

.about-eyebrow {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #6366f1;
  margin-bottom: 0.75rem;
}

.about-name {
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 0.75rem;
  line-height: 1.2;
}

.about-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  font-size: 0.875rem;
  color: #64748b;
}

/* ── Bio sections ─────────────────────────────────────── */
.bios-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.bio-section {
  border: 1px solid #1e1b4b;
  border-radius: 0.75rem;
  padding: 1.5rem;
  background: #0d0d22;
}

.bio-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.bio-label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #a5b4fc;
  background: #1e1b4b;
  border: 1px solid #312e81;
  border-radius: 0.375rem;
  padding: 0.2rem 0.6rem;
}

.bio-wordcount {
  font-size: 0.75rem;
  color: #475569;
}

.bio-text {
  font-size: 0.9375rem;
  line-height: 1.75;
  color: #cbd5e1;
  white-space: pre-wrap;
}

.empty {
  text-align: center;
  color: #475569;
  padding: 3rem 1.5rem;
}
</style>
