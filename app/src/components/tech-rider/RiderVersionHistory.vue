<script setup lang="ts">
/**
 * Everything this rider has ever been sent as.
 *
 * Each row is a permalink, not just a log line: an archived version keeps
 * serving the sheet it was published with, so the promoter who got it in August
 * still opens the August rider. That is the whole point of freezing, and it is
 * only useful if the links are here to copy.
 */
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminModal from '@/components/admin/AdminModal.vue'
import type { TechRiderVersion } from '@/types/techRiderVersion'

defineProps<{
  open: boolean
  versions: TechRiderVersion[]
  loading: boolean
  discarding: boolean
}>()

const emit = defineEmits<{ close: []; discard: [id: number] }>()

const confirmId = ref<number | null>(null)

function linkFor(version: TechRiderVersion): string {
  return `${window.location.origin}/rider/${version.public_token}`
}

async function copyLink(version: TechRiderVersion) {
  try {
    await navigator.clipboard.writeText(linkFor(version))
    toast.success(`Link to v${version.version_number} copied`)
  } catch {
    toast.error('Could not copy the link')
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
</script>

<template>
  <AdminModal :open="open" title="Version history" max-width="36rem" @close="emit('close')">
    <div class="history">
      <p v-if="loading" class="empty">Loading…</p>

      <p v-else-if="!versions.length" class="empty">
        This rider has never been published. Until it is, its public link returns
        “not found” — nothing is sent by accident.
      </p>

      <ul v-else class="version-list">
        <li v-for="version in versions" :key="version.id" class="version">
          <div class="version-main">
            <div class="version-head">
              <span class="version-number">v{{ version.version_number }}</span>
              <span
                class="version-status"
                :class="version.status === 'published' ? 'is-live' : 'is-archived'"
              >{{ version.status === 'published' ? 'Live link' : 'Archived' }}</span>
              <span class="version-date">{{ formatDate(version.published_at) }}</span>
            </div>
            <p v-if="version.notes" class="version-notes">{{ version.notes }}</p>
          </div>

          <div class="version-actions">
            <a :href="linkFor(version)" target="_blank" rel="noopener" class="btn-ghost btn-ghost--sm">Open</a>
            <button type="button" class="btn-ghost btn-ghost--sm" @click="copyLink(version)">Copy link</button>
            <button
              v-if="version.status !== 'published'"
              type="button"
              class="btn-ghost btn-ghost--sm btn-ghost--danger"
              :disabled="discarding"
              @click="confirmId = version.id"
            >Delete</button>
          </div>

          <div v-if="confirmId === version.id" class="confirm" role="dialog" aria-modal="true">
            <p class="confirm-text">
              Delete v{{ version.version_number }}? Anyone holding its link will stop
              being able to open it.
            </p>
            <div class="confirm-actions">
              <button type="button" class="btn-ghost btn-ghost--sm" @click="confirmId = null">Keep</button>
              <button
                type="button"
                class="btn-danger btn-danger--sm"
                :disabled="discarding"
                @click="emit('discard', version.id); confirmId = null"
              >Delete</button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </AdminModal>
</template>

<style scoped>
.history { display: flex; flex-direction: column; gap: 0.75rem; }
.empty { font-size: 0.8rem; color: #64748b; line-height: 1.6; margin: 0; }

.version-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.version {
  display: flex; align-items: flex-start; gap: 0.75rem; flex-wrap: wrap;
  padding: 0.6rem 0.75rem; border: 1px solid #1f1f1f; border-radius: 0.5rem; background: #0d0d0d;
}
.version-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
.version-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.version-number { font-size: 0.85rem; font-weight: 700; color: #e2e8f0; }
.version-status {
  font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
  padding: 0.1rem 0.4rem; border-radius: 999px; letter-spacing: 0.03em;
}
.is-live { color: #4ade80; background: #052e16; }
.is-archived { color: #64748b; background: #17171a; }
.version-date { font-size: 0.7rem; color: #475569; }
.version-notes { font-size: 0.75rem; color: #94a3b8; margin: 0; line-height: 1.5; }

.version-actions { display: flex; gap: 0.35rem; align-items: center; flex-shrink: 0; }

.confirm {
  flex-basis: 100%; display: flex; align-items: center; justify-content: space-between;
  gap: 0.75rem; flex-wrap: wrap; padding-top: 0.5rem; border-top: 1px solid #1f1f1f;
}
.confirm-text { font-size: 0.72rem; color: #d6bd8b; margin: 0; line-height: 1.5; }
.confirm-actions { display: flex; gap: 0.35rem; }

.btn-ghost {
  padding: 0.25rem 0.6rem; border-radius: 0.375rem; font-size: 0.72rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #2a2a2a; color: #64748b;
  text-decoration: none; display: inline-flex; align-items: center;
}
.btn-ghost:hover { border-color: #444444; color: #94a3b8; }
.btn-ghost--sm { padding: 0.2rem 0.5rem; }
.btn-ghost--danger:hover { border-color: #991b1b; color: #fca5a5; }
.btn-ghost:disabled { opacity: 0.45; cursor: default; }

.btn-danger {
  padding: 0.2rem 0.6rem; border-radius: 0.375rem; font-size: 0.72rem; font-weight: 600;
  cursor: pointer; background: #7f1d1d; border: 1px solid #991b1b; color: #fca5a5;
}
.btn-danger:disabled { opacity: 0.45; cursor: default; }
</style>
