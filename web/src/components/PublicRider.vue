<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { PublishedRider } from '@bandms/rider-core'
import RiderSheet from '@bandms/rider-core/components/RiderSheet.vue'

/**
 * The venue's copy of a published tech rider.
 *
 * Fetching only — every pixel of the sheet comes from @bandms/rider-core, the
 * same component and the same resolver the admin previews with. This used to
 * read `title` and `content_html`, fields the API has never sent, so the page
 * rendered a bare heading over an empty body for every rider link ever shared.
 *
 * Resolved by the Astro page from the CMS slug map — the contact module can be
 * renamed (changing its slug) or switched off entirely, so this cannot be a
 * hardcoded /en/contact any more. `null` means the module is off: no link.
 */
const { contactHref = null } = defineProps<{ contactHref?: string | null }>()

const status    = ref<'loading' | 'ready' | 'error'>('loading')
const published = ref<PublishedRider | null>(null)
const error     = ref('')

onMounted(async () => {
  // Nginx serves this one page for any sub-path of /rider/, so the token is
  // read from the URL rather than passed in as a prop.
  const parts = window.location.pathname.split('/').filter(Boolean)
  const token = parts[parts.length - 1] ?? ''

  // Same guard the admin's client uses, so a junk path never reaches the API.
  if (!token || token === 'rider' || !/^[A-Za-z0-9]{16,64}$/.test(token)) {
    status.value = 'error'
    error.value  = 'Invalid rider link.'
    return
  }

  try {
    const res = await fetch(`/api/public/rider/${encodeURIComponent(token)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error('Not found')
    // API always wraps in { data: {...} }
    const json = (await res.json()) as { data: PublishedRider }
    published.value = json.data
    status.value    = 'ready'
  } catch {
    status.value = 'error'
    error.value  = 'Rider not found, or the link has expired.'
  }
})
</script>

<template>
  <div>
    <div v-if="status === 'loading'" class="flex justify-center py-20">
      <div class="w-10 h-10 rounded-pill border-2 border-border border-t-accent animate-spin" />
    </div>

    <div v-else-if="status === 'error'" class="text-center py-20 text-muted">
      <p class="text-lg">{{ error }}</p>
      <a v-if="contactHref" :href="contactHref" class="mt-4 inline-block text-accent hover:underline">Contact us</a>
    </div>

    <RiderSheet
      v-else-if="published"
      :rider="published.rider"
      :members="published.members"
      :version="published.version"
      :logo-url="published.profile?.logo_url ?? null"
    />
  </div>
</template>
