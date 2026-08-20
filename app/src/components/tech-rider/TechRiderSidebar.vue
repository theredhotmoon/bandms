<script setup lang="ts">
import type { TechRiderSummary } from '@/types/techRider'

interface Props {
  riders: TechRiderSummary[]
  loading: boolean
  error: boolean
  openId: number | null
}
defineProps<Props>()

defineEmits<{
  open: [id: number]
  activate: [id: number]
  duplicate: [id: number]
  delete: [id: number]
  new: []
}>()
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h1 class="sidebar-title">Tech Riders</h1>
      <button type="button" class="btn-new" title="New rider" @click="$emit('new')">+</button>
    </div>

    <div v-if="loading" class="sidebar-state">Loading…</div>
    <div v-else-if="error" class="sidebar-state sidebar-state--err">Failed to load</div>

    <div v-else class="rider-list">
      <div
        v-for="r in riders"
        :key="r.id"
        class="rider-item"
        :class="{ 'rider-item--open': openId === r.id }"
        @click="$emit('open', r.id)"
      >
        <div class="rider-info">
          <span class="rider-name">{{ r.name }}</span>
          <div class="rider-badges">
            <span v-if="r.is_active" class="badge-active">Active</span>
            <span v-if="r.published_version_number" class="badge-published">
              v{{ r.published_version_number }}
            </span>
            <span class="rider-date">{{ new Date(r.updated_at).toLocaleDateString() }}</span>
          </div>
        </div>
        <div class="rider-actions">
          <button
            v-if="!r.is_active"
            type="button"
            class="act-btn"
            title="Set as active rider"
            @click.stop="$emit('activate', r.id)"
          >✓</button>
          <button
            type="button"
            class="act-btn"
            title="Duplicate this rider"
            @click.stop="$emit('duplicate', r.id)"
          >⧉</button>
          <button
            type="button"
            class="act-btn act-btn--del"
            title="Delete"
            @click.stop="$emit('delete', r.id)"
          >✕</button>
        </div>
      </div>

      <div v-if="!riders.length" class="sidebar-state">
        No riders yet.<br>Click + to create one.
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 17rem; flex-shrink: 0;
  border-right: 1px solid #1a1a1a; background: #0a0a0a;
  display: flex; flex-direction: column; overflow: hidden;
}
.sidebar-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1rem 0.625rem; border-bottom: 1px solid #1a1a1a;
}
.sidebar-title { font-size: 0.8125rem; font-weight: 700; color: #94a3b8; }
.btn-new {
  width: 1.75rem; height: 1.75rem; border-radius: 0.375rem;
  background: #2a2a2a; border: 1px solid #444444; color: #c0c0c0;
  font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.btn-new:hover { background: #333333; }

.sidebar-state {
  padding: 1.5rem 1rem; font-size: 0.8rem; color: #334155; text-align: center; line-height: 1.6;
}
.sidebar-state--err { color: #f87171; }

.rider-list { flex: 1; overflow-y: auto; padding: 0.5rem; }
.rider-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.625rem 0.75rem; border-radius: 0.4rem; cursor: pointer;
  border: 1px solid transparent; margin-bottom: 0.25rem;
  transition: background 100ms, border-color 100ms;
}
.rider-item:hover { background: #181818; border-color: #2a2a2a; }
.rider-item--open { background: #141414; border-color: #444444; }
.rider-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
.rider-name {
  font-size: 0.8rem; font-weight: 600; color: #e2e8f0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rider-badges { display: flex; align-items: center; gap: 0.4rem; }
.badge-active {
  font-size: 0.6rem; font-weight: 700; color: #4ade80; background: #052e16;
  padding: 0.1rem 0.4rem; border-radius: 999px; text-transform: uppercase;
}
.rider-date { font-size: 0.65rem; color: #334155; }

.rider-actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
.act-btn {
  background: none; border: none; cursor: pointer; color: #334155; font-size: 0.7rem;
  padding: 0.2rem 0.35rem; border-radius: 3px; transition: color 100ms, background 100ms;
}
.act-btn:hover { color: #c0c0c0; background: #2a2a2a; }
.act-btn--del:hover { color: #f87171; background: #450a0a; }
.badge-published {
  font-size: 0.6rem; font-weight: 700; color: #94a3b8; background: #1a1a1a;
  padding: 0.1rem 0.35rem; border-radius: 999px;
}
</style>
