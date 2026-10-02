<script setup lang="ts">
import { adminUrl } from '@/config/admin'
import type { BandProfile } from '@/types/bandProfile'

interface Props {
  profile: BandProfile | null
  riderName: string
}
defineProps<Props>()
</script>

<template>
  <div class="cover">
    <div class="cover-preview">
      <div class="cover-band">{{ profile?.name ?? '—' }}</div>
      <div class="cover-title">{{ $t('rider.cover.title', { name: riderName }) }}</div>
      <div class="cover-contacts">
        <span v-if="profile?.tech_contact_email">📧 {{ profile.tech_contact_email }}</span>
        <span v-if="profile?.tech_contact_phone">📞 {{ profile.tech_contact_phone }}</span>
      </div>
      <div v-if="profile?.tech_rider_notes" class="cover-notes">{{ profile.tech_rider_notes }}</div>
    </div>

    <div class="cover-info">
      <div class="info-title">{{ $t('rider.cover.infoTitle') }}</div>
      <i18n-t keypath="rider.cover.infoDesc" tag="p" class="info-desc" scope="global">
        <template #link>
          <RouterLink :to="adminUrl('band-profile')" class="info-link">{{ $t('rider.cover.infoLink') }}</RouterLink>
        </template>
      </i18n-t>
      <div class="info-fields">
        <div class="info-row">
          <span class="info-label">{{ $t('rider.cover.techEmail') }}</span>
          <span class="info-val">{{ profile?.tech_contact_email || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('rider.cover.techPhone') }}</span>
          <span class="info-val">{{ profile?.tech_contact_phone || '—' }}</span>
        </div>
        <div class="info-row info-row--wide">
          <span class="info-label">{{ $t('rider.cover.engineerDesc') }}</span>
          <span class="info-val">{{ profile?.tech_rider_notes || '—' }}</span>
        </div>
      </div>
      <RouterLink :to="adminUrl('band-profile')" class="btn-go">{{ $t('rider.cover.editInProfile') }}</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.cover { display: flex; flex-direction: column; gap: 1rem; }

.cover-preview {
  background: var(--c-0d0d0d); border: 1px solid var(--c-2a2a2a); border-radius: 0.5rem;
  padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;
  border-left: 3px solid var(--c-888888-line);
}
.cover-band { font-size: 1.5rem; font-weight: 800; color: var(--c-e2e8f0); letter-spacing: -.02em; }
.cover-title { font-size: var(--fs-base); color: var(--c-c0c0c0); font-weight: 600; }
.cover-contacts { display: flex; gap: 1.5rem; font-size: var(--fs-sm); color: var(--c-64748b); flex-wrap: wrap; }
.cover-notes {
  font-size: var(--fs-sm); color: var(--c-64748b); line-height: 1.6;
  border-top: 1px solid var(--c-222222); padding-top: 0.5rem;
}

.cover-info {
  background: var(--c-111111); border: 1px solid var(--c-2a2a2a); border-radius: 0.5rem; padding: 1rem;
  display: flex; flex-direction: column; gap: 0.625rem;
}
.info-title { font-size: var(--fs-sm); font-weight: 600; color: var(--c-94a3b8); }
.info-desc { font-size: var(--fs-xs); color: var(--c-475569); line-height: 1.5; }
.info-link { color: var(--c-c0c0c0); text-decoration: none; }
.info-link:hover { color: var(--c-e2e8f0); }

.info-fields { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.info-row {
  flex: 1; min-width: 12rem;
  background: var(--c-0d0d0d); border: 1px solid var(--c-1a1a1a); border-radius: 0.375rem;
  padding: 0.5rem 0.75rem; display: flex; flex-direction: column; gap: 0.15rem;
}
.info-row--wide { flex-basis: 100%; }
.info-label {
  font-size: var(--fs-2xs); font-weight: 600; color: var(--c-334155);
  text-transform: uppercase; letter-spacing: .05em;
}
.info-val { font-size: var(--fs-sm); color: var(--c-94a3b8); }

.btn-go {
  align-self: flex-start; padding: 0.35rem 0.875rem; border-radius: 0.375rem;
  font-size: var(--fs-xs); font-weight: 600; color: var(--c-c0c0c0); text-decoration: none;
  background: var(--c-141414); border: 1px solid var(--c-2a2a2a);
}
.btn-go:hover { background: var(--c-1a1a1a); }
</style>
