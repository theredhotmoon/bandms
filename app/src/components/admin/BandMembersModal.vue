<script setup lang="ts">
import { ref, reactive } from 'vue'
import { toast } from 'vue-sonner'
import { useSocialLinks } from '@/composables/useSocialLinks'
import { SOCIAL_PLATFORMS } from '@/types/socialLink'
import type { SocialLink, SocialPlatform } from '@/types/socialLink'

defineEmits<{ close: [] }>()

const { query: linksQuery, create: linkCreate, update: linkUpdate, remove: linkRemove } = useSocialLinks()

const showLinkForm = ref(false)
const editingLink = ref<SocialLink | null>(null)
const linkForm = reactive<{ platform: SocialPlatform; url: string }>({
  platform: 'instagram',
  url: '',
})

function openAddLink() {
  editingLink.value = null
  linkForm.platform = 'instagram'
  linkForm.url = ''
  showLinkForm.value = true
}

function openEditLink(l: SocialLink) {
  editingLink.value = l
  linkForm.platform = l.platform
  linkForm.url = l.url
  showLinkForm.value = true
}

function cancelLinkForm() {
  showLinkForm.value = false
  editingLink.value = null
}

async function saveLinkForm() {
  if (!linkForm.url.trim()) return
  try {
    if (editingLink.value) {
      await linkUpdate.mutateAsync({ id: editingLink.value.id, payload: { platform: linkForm.platform, url: linkForm.url.trim() } })
      toast.success('Link updated')
    } else {
      await linkCreate.mutateAsync({ platform: linkForm.platform, url: linkForm.url.trim() })
      toast.success('Link added')
    }
    cancelLinkForm()
  } catch { toast.error('Failed to save link') }
}

async function deleteLink(id: number) {
  try {
    await linkRemove.mutateAsync(id)
    toast.success('Link removed')
  } catch { toast.error('Failed to remove') }
}

function platformMeta(key: SocialPlatform) {
  return SOCIAL_PLATFORMS.find((p) => p.key === key)!
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <p class="text-xs" style="color:#64748b;">Band-level streaming &amp; social profiles</p>
      <button @click="openAddLink" class="btn-add-sm">+ Add link</button>
    </div>

    <div v-if="linksQuery.isPending.value" class="py-4 text-center text-xs" style="color:#475569;">Loading…</div>
    <div v-else-if="!linksQuery.data.value?.length && !showLinkForm" class="py-4 text-xs" style="color:#475569;">
      No social links yet.
    </div>

    <div class="links-list">
      <div v-for="l in linksQuery.data.value" :key="l.id" class="link-row">
        <span class="link-dot" :style="`background:${platformMeta(l.platform).color};`" />
        <span class="link-platform">{{ platformMeta(l.platform).label }}</span>
        <a :href="l.url" target="_blank" rel="noopener" class="link-url">{{ l.url }}</a>
        <button @click="openEditLink(l)" class="btn-edit-sm">Edit</button>
        <button @click="deleteLink(l.id)" class="btn-del-sm">✕</button>
      </div>
    </div>

    <div v-if="showLinkForm" class="link-form-row">
      <select v-model="linkForm.platform" class="link-platform-select">
        <option v-for="p in SOCIAL_PLATFORMS" :key="p.key" :value="p.key">{{ p.label }}</option>
      </select>
      <input v-model="linkForm.url" class="link-url-input" placeholder="https://…" @keydown.enter.prevent="saveLinkForm" />
      <button
        @click="saveLinkForm"
        :disabled="linkCreate.isPending.value || linkUpdate.isPending.value"
        class="btn-link-save"
      >{{ editingLink ? 'Update' : 'Add' }}</button>
      <button @click="cancelLinkForm" class="btn-link-cancel">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
.btn-add-sm {
  padding: 0.3rem 0.75rem; border-radius: 0.4rem; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; background: #4338ca; border: none; color: #fff; transition: background 120ms;
}
.btn-add-sm:hover { background: #4f46e5; }
.links-list { display: flex; flex-direction: column; gap: 0.375rem; margin-bottom: 0.5rem; }
.link-row {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.375rem 0.625rem; border-radius: 0.375rem;
  background: #0b0b20; border: 1px solid #1a1a38;
}
.link-dot { width: 0.5rem; height: 0.5rem; border-radius: 9999px; flex-shrink: 0; }
.link-platform { font-size: 0.7rem; font-weight: 600; color: #94a3b8; width: 6.5rem; flex-shrink: 0; }
.link-url {
  flex: 1; min-width: 0; font-size: 0.75rem; color: #6366f1;
  text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.link-url:hover { color: #818cf8; }
.btn-edit-sm {
  padding: 0.2rem 0.5rem; border-radius: 0.3rem; font-size: 0.7rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #1e2040; color: #818cf8;
  transition: background 100ms;
}
.btn-edit-sm:hover { background: #1e1b4b; }
.btn-del-sm {
  padding: 0.2rem 0.5rem; border-radius: 0.3rem; font-size: 0.7rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #3a1212; color: #f87171;
  transition: background 100ms;
}
.btn-del-sm:hover { background: #3f1212; }
.link-form-row {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 0.625rem; border-radius: 0.375rem;
  background: #0f0f26; border: 1px solid #1e2040; margin-top: 0.375rem;
}
.link-platform-select {
  background: #0b0b20; border: 1px solid #1e2040; border-radius: 0.3rem;
  color: #e2e8f0; font-size: 0.75rem; padding: 0.25rem 0.375rem;
  outline: none; cursor: pointer; flex-shrink: 0;
}
.link-platform-select:focus { border-color: #6366f1; }
.link-url-input {
  flex: 1; min-width: 0; background: #0b0b20; border: 1px solid #1e2040;
  border-radius: 0.3rem; color: #e2e8f0; font-size: 0.75rem;
  padding: 0.25rem 0.5rem; outline: none;
}
.link-url-input:focus { border-color: #6366f1; }
.link-url-input::placeholder { color: #334155; }
.btn-link-save {
  padding: 0.2rem 0.625rem; border-radius: 0.3rem; font-size: 0.7rem; font-weight: 600;
  cursor: pointer; background: #4338ca; border: none; color: #fff;
  transition: background 100ms; flex-shrink: 0;
}
.btn-link-save:hover:not(:disabled) { background: #4f46e5; }
.btn-link-save:disabled { opacity: 0.5; cursor: default; }
.btn-link-cancel {
  padding: 0.2rem 0.5rem; border-radius: 0.3rem; font-size: 0.7rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #1e2040; color: #64748b;
  transition: background 100ms; flex-shrink: 0;
}
.btn-link-cancel:hover { background: #0f0f26; color: #94a3b8; }
</style>
