<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAlbums } from '@/composables/useAlbums'

const router = useRouter()
const { query } = useAlbums()

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="photos-page">
    <header class="page-header">
      <div class="page-header-inner">
        <p class="page-eyebrow">Gallery</p>
        <h1 class="page-title">Photos</h1>
        <p class="page-sub">Live shots and behind the scenes.</p>
      </div>
    </header>

    <div class="photos-body">
    <div v-if="query.isPending.value">Loading…</div>
    <div v-else-if="query.isError.value">Failed to load albums.</div>
    <div v-else-if="!query.data.value?.length" style="opacity: 0.6;">No albums yet.</div>

    <div v-else style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
      <article
        v-for="album in query.data.value"
        :key="album.id"
        style="border: 1px solid #333; border-radius: 6px; overflow: hidden; cursor: pointer;"
        @click="router.push(`/photos/${album.id}`)"
      >
        <div v-if="album.cover_url" style="aspect-ratio: 4/3; overflow: hidden;">
          <img :src="album.cover_url" :alt="album.title" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
        </div>
        <div style="padding: 0.75rem;">
          <h3 style="margin: 0 0 0.25rem; font-size: 1rem;">{{ album.title }}</h3>
          <div style="font-size: 0.8em; opacity: 0.6;">
            <span v-if="album.taken_at">{{ formatDate(album.taken_at) }}</span>
            <span v-if="album.venue"> · {{ album.venue.name }}</span>
            <span> · {{ album.photo_count }} photo{{ album.photo_count !== 1 ? 's' : '' }}</span>
          </div>
          <div v-if="album.tags.length" style="display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.5rem;">
            <span v-for="tag in album.tags" :key="tag.id" style="font-size: 0.75em; padding: 0.1rem 0.4rem; border: 1px solid #555; border-radius: 3px; opacity: 0.7;">{{ tag.name }}</span>
          </div>
        </div>
      </article>
    </div>
    </div><!-- photos-body -->
  </div>
</template>

<style scoped>
.photos-page { background: #fff; color: #111; min-height: calc(100vh - 56px); }
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
.photos-body { max-width: 1000px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
</style>
