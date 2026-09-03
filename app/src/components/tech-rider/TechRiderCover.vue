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
      <div class="cover-title">Technical Rider — {{ riderName }}</div>
      <div class="cover-contacts">
        <span v-if="profile?.tech_contact_email">📧 {{ profile.tech_contact_email }}</span>
        <span v-if="profile?.tech_contact_phone">📞 {{ profile.tech_contact_phone }}</span>
      </div>
      <div v-if="profile?.tech_rider_notes" class="cover-notes">{{ profile.tech_rider_notes }}</div>
    </div>

    <div class="cover-info">
      <div class="info-title">Where these come from</div>
      <p class="info-desc">
        The tech contact fields and the sound-engineer description are managed in
        <RouterLink :to="adminUrl('band-profile')" class="info-link">Band Profile → Contacts</RouterLink>
        and appear on every rider.
      </p>
      <div class="info-fields">
        <div class="info-row">
          <span class="info-label">Tech contact email</span>
          <span class="info-val">{{ profile?.tech_contact_email || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tech contact phone</span>
          <span class="info-val">{{ profile?.tech_contact_phone || '—' }}</span>
        </div>
        <div class="info-row info-row--wide">
          <span class="info-label">Sound engineer description</span>
          <span class="info-val">{{ profile?.tech_rider_notes || '—' }}</span>
        </div>
      </div>
      <RouterLink :to="adminUrl('band-profile')" class="btn-go">Edit in Band Profile →</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.cover { display: flex; flex-direction: column; gap: 1rem; }

.cover-preview {
  background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 0.5rem;
  padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;
  border-left: 3px solid #888888;
}
.cover-band { font-size: 1.5rem; font-weight: 800; color: #e2e8f0; letter-spacing: -.02em; }
.cover-title { font-size: 0.875rem; color: #c0c0c0; font-weight: 600; }
.cover-contacts { display: flex; gap: 1.5rem; font-size: 0.8rem; color: #64748b; flex-wrap: wrap; }
.cover-notes {
  font-size: 0.8rem; color: #64748b; line-height: 1.6;
  border-top: 1px solid #222222; padding-top: 0.5rem;
}

.cover-info {
  background: #111111; border: 1px solid #2a2a2a; border-radius: 0.5rem; padding: 1rem;
  display: flex; flex-direction: column; gap: 0.625rem;
}
.info-title { font-size: 0.8rem; font-weight: 600; color: #94a3b8; }
.info-desc { font-size: 0.775rem; color: #475569; line-height: 1.5; }
.info-link { color: #c0c0c0; text-decoration: none; }
.info-link:hover { color: #e2e8f0; }

.info-fields { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.info-row {
  flex: 1; min-width: 12rem;
  background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 0.375rem;
  padding: 0.5rem 0.75rem; display: flex; flex-direction: column; gap: 0.15rem;
}
.info-row--wide { flex-basis: 100%; }
.info-label {
  font-size: 0.65rem; font-weight: 600; color: #334155;
  text-transform: uppercase; letter-spacing: .05em;
}
.info-val { font-size: 0.8rem; color: #94a3b8; }

.btn-go {
  align-self: flex-start; padding: 0.35rem 0.875rem; border-radius: 0.375rem;
  font-size: 0.78rem; font-weight: 600; color: #c0c0c0; text-decoration: none;
  background: #141414; border: 1px solid #2a2a2a;
}
.btn-go:hover { background: #1a1a1a; }
</style>
