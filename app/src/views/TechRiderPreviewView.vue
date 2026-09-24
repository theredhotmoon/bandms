<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { fetchActiveTechRider, fetchTechRider } from '@/api/techRiders'
import { fetchBandMembers } from '@/api/bandMembers'
import { fetchBandProfile } from '@/api/bandProfile'
import type { TechRider, BandMember } from '@bandms/rider-core'
import { riderSheetLabels } from '@bandms/rider-core'
import type { BandProfile } from '@/types/bandProfile'
import RiderSheet from '@bandms/rider-core/components/RiderSheet.vue'
import { useUiLang } from '@/composables/useUiLang'

/**
 * The band's own preview of a tech rider — opened from the editor's topbar.
 *
 * Fetching only. The sheet itself is <RiderSheet> from @bandms/rider-core, the
 * same component the public site renders for a venue, so the two cannot drift:
 * this used to be a 760-line second copy of the same document, and a change to
 * one was invisible in the other.
 *
 * The difference between the two callers is only where the data comes from.
 * Here it is the *live* rider, by id (or the active one), resolved against the
 * members' current saved rigs — correct while planning. The public page is
 * handed a frozen published snapshot instead, so a venue's copy cannot shift
 * under it after the link is sent.
 */
const route = useRoute()
const { t } = useI18n()
const { uiLang } = useUiLang()

/**
 * The preview follows the *chrome* language, not the content language.
 *
 * It is the band reading their own document, so it should match the panel
 * around it. The venue's copy is resolved separately, from the public site's
 * default locale — see web/src/components/PublicRider.vue.
 */
const sheetLabels = computed(() => riderSheetLabels(uiLang.value))

const rider   = ref<TechRider | null>(null)
const members = ref<BandMember[]>([])
const profile = ref<BandProfile | null>(null)
const loading = ref(true)
const error   = ref<string | null>(null)

onMounted(async () => {
  try {
    const [riderData, membersData, profileData] = await Promise.all([
      route.params.id
        ? fetchTechRider(parseInt(Array.isArray(route.params.id) ? route.params.id[0] : route.params.id, 10))
        : fetchActiveTechRider(),
      fetchBandMembers().catch(() => [] as BandMember[]),
      fetchBandProfile('en').catch(() => null),
    ])
    rider.value   = riderData
    members.value = membersData
    profile.value = profileData
  } catch {
    error.value = t('rider.preview.loadFailed')
  } finally {
    loading.value = false
  }
})

const logoUrl = computed(() => {
  // Use tech_rider_logo_id pin if set, else fall back to global default
  if (profile.value?.tech_rider_logo_id && profile.value?.logos?.length) {
    const pinned = profile.value.logos.find(l => l.id === profile.value!.tech_rider_logo_id)
    if (pinned) return pinned.url
  }
  return profile.value?.logo_url ?? null
})
</script>

<template>
  <div v-if="loading" class="preview-loading">{{ $t('rider.preview.loading') }}</div>
  <div v-else-if="error" class="preview-error">{{ error }}</div>

  <!--
    No `version` prop: this is the live rider, which has no version number
    until it is published. RiderSheet guards that label with v-if, so the
    chip simply does not render here.
  -->
  <RiderSheet
    v-else-if="rider"
    :rider="rider"
    :labels="sheetLabels"
    :locale="uiLang"
    :members="members"
    :logo-url="logoUrl"
  />
</template>

<style scoped>
.preview-loading, .preview-error {
  display: flex; align-items: center; justify-content: center;
  height: 100vh; font-size: 1rem; color: #64748b;
}
.preview-error { color: #dc2626; }
</style>
