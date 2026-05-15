<script setup lang="ts">
import type { PostLink } from '@/types/post'

defineProps<{ links: PostLink[] }>()

function youtubeEmbedUrl(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return `https://www.youtube.com/embed/${m[1]}`
  }
  return null
}
</script>

<template>
  <div v-if="links.length" style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
    <template v-for="link in links" :key="link.id">
      <div v-if="link.type === 'youtube'" class="post-link post-link--youtube">
        <iframe
          v-if="youtubeEmbedUrl(link.url)"
          :src="youtubeEmbedUrl(link.url)!"
          width="100%"
          height="315"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        />
        <a v-else :href="link.url" target="_blank" rel="noopener noreferrer">
          ▶ {{ link.label || link.url }}
        </a>
      </div>

      <div v-else-if="link.type === 'instagram'" class="post-link post-link--instagram">
        <a :href="link.url" target="_blank" rel="noopener noreferrer">
          📸 Instagram{{ link.label ? ` — ${link.label}` : '' }}
        </a>
      </div>

      <div v-else-if="link.type === 'facebook'" class="post-link post-link--facebook">
        <a :href="link.url" target="_blank" rel="noopener noreferrer">
          👍 Facebook{{ link.label ? ` — ${link.label}` : '' }}
        </a>
      </div>

      <div v-else class="post-link post-link--normal">
        <a :href="link.url" target="_blank" rel="noopener noreferrer">
          🔗 {{ link.label || link.url }}
        </a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.post-link {
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  border-left: 3px solid #555;
}
.post-link--youtube  { border-left-color: #ff0000; }
.post-link--instagram { border-left-color: #e1306c; }
.post-link--facebook { border-left-color: #1877f2; }
.post-link--normal   { border-left-color: #888; }

.post-link a {
  color: inherit;
  text-decoration: none;
}
.post-link a:hover {
  text-decoration: underline;
}
</style>
