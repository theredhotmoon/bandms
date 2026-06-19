<script setup lang="ts">
import { ref, onMounted } from 'vue'

const status  = ref<'loading' | 'ready' | 'error'>('loading')
const content = ref('')
const title   = ref('')
const error   = ref('')

onMounted(async () => {
  const parts = window.location.pathname.split('/').filter(Boolean)
  const token = parts[parts.length - 1] ?? ''

  if (!token || token === 'rider') {
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
    const json = (await res.json()) as { data: { title?: string; content_html?: string } }
    const rider = json.data
    title.value   = rider.title ?? 'Technical Rider'
    content.value = rider.content_html ?? ''
    status.value  = 'ready'
  } catch {
    status.value = 'error'
    error.value  = 'Rider not found or link has expired.'
  }
})
</script>

<template>
  <div>
    <div v-if="status === 'loading'" class="flex justify-center py-20">
      <div class="w-10 h-10 rounded-full border-2 border-zinc-700 border-t-accent animate-spin" />
    </div>

    <div v-else-if="status === 'error'" class="text-center py-20 text-zinc-400">
      <p class="text-lg">{{ error }}</p>
      <a href="/contact" class="mt-4 inline-block text-accent hover:underline">Contact us</a>
    </div>

    <div v-else>
      <h1 class="text-3xl font-black text-white mb-8">{{ title }}</h1>
      <!-- eslint-disable-next-line vue/no-v-html -- content comes from trusted CMS backend -->
      <div class="prose max-w-none" v-html="content" />
    </div>
  </div>
</template>
