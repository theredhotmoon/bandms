<script setup lang="ts">
/**
 * Every snapshot the EPK has ever been published as, and the one draft
 * waiting to be.
 *
 * Unlike a tech-rider version, an EPK version has no link of its own — `/epk`
 * serves whichever row is live and nothing else — so an archived version is
 * history, not a permalink. That is why it can be deleted here, and why
 * "Make live" exists: restoring is the only way an old snapshot reaches a
 * visitor again.
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminModal from '@/components/admin/AdminModal.vue'
import { useUiLang } from '@/composables/useUiLang'
import type { EpkVersion, EpkVersionStatus } from '@/types/epkVersion'

const { t } = useI18n()
const { uiLang } = useUiLang()

interface Props {
  open: boolean
  versions: EpkVersion[]
  loading: boolean
  error: boolean
  publishing: boolean
  deleting: boolean
}
const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  makeLive: [version: EpkVersion]
  remove: [version: EpkVersion]
}>()

const confirmId = ref<number | null>(null)

// A confirm left open behind a closed modal would be one click from deleting
// the next time the modal opens.
watch(() => props.open, (open) => { if (!open) confirmId.value = null })

const STATUS_KEY: Record<EpkVersionStatus, string> = {
  published: 'dashboard.epk.status.published',
  pending:   'dashboard.epk.status.pending',
  archived:  'dashboard.epk.status.archived',
}

function statusLabel(status: EpkVersionStatus): string {
  return t(STATUS_KEY[status])
}

// Month names follow the chrome language, not the browser's. `undefined` here
// used to mean "whatever the OS says", which could print a Polish month in an
// English panel.
function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(uiLang.value, { day: 'numeric', month: 'short', year: 'numeric' })
}

function confirmRemove(version: EpkVersion): void {
  emit('remove', version)
  confirmId.value = null
}
</script>

<template>
  <AdminModal :open="open" :title="$t('dashboard.epk.historyTitle')" max-width="36rem" @close="emit('close')">
    <div class="history">
      <p v-if="loading" class="empty">{{ $t('dashboard.epk.loading') }}</p>

      <p v-else-if="error" class="empty empty--error">
        {{ $t('dashboard.epk.loadError') }}
      </p>

      <!--
        <i18n-t>, not a {code} string param: interpolating a named param
        renders plain text, which silently dropped the <code> element and the
        `.empty code` styling with it. The slot puts real markup back inside
        the translated sentence, in whatever position each language needs.
      -->
      <i18n-t
        v-else-if="!versions.length"
        keypath="dashboard.epk.empty"
        tag="p"
        class="empty"
        scope="global"
      >
        <template #code><code>/epk</code></template> <!-- i18n-ignore: route path -->
      </i18n-t>

      <ul v-else class="version-list">
        <li
          v-for="version in versions"
          :key="version.id"
          class="version"
          data-testid="epk-version-row"
          :data-version-id="version.id"
        >
          <div class="version-main">
            <div class="version-head">
              <span class="version-number">v{{ version.version_number }}</span>
              <span
                class="version-status"
                :class="`is-${version.status}`"
                data-testid="epk-version-status"
              >{{ statusLabel(version.status) }}</span>
              <span class="version-date">
                {{ version.status === 'pending' ? $t('dashboard.epk.created', { date: formatDate(version.created_at) }) : formatDate(version.published_at) }}
              </span>
            </div>
            <p v-if="version.release_reason" class="version-reason">{{ version.release_reason }}</p>
          </div>

          <div v-if="version.status !== 'published'" class="version-actions">
            <button
              type="button"
              class="btn-live"
              :disabled="publishing"
              @click="emit('makeLive', version)"
            >{{ version.status === 'pending' ? $t('dashboard.epk.publish') : $t('dashboard.epk.makeLive') }}</button>
            <button
              type="button"
              class="btn-ghost btn-ghost--danger"
              :disabled="deleting"
              @click="confirmId = version.id"
            >{{ version.status === 'pending' ? $t('dashboard.epk.discard') : $t('dashboard.epk.delete') }}</button>
          </div>

          <div v-if="confirmId === version.id" class="confirm" role="group" :aria-label="$t('dashboard.epk.confirmAria', { version: version.version_number })">
            <p class="confirm-text">
              <template v-if="version.status === 'pending'">
                {{ $t('dashboard.epk.confirmDiscard') }}
              </template>
              <template v-else>
                {{ $t('dashboard.epk.confirmDelete', { version: version.version_number }) }}
              </template>
            </p>
            <div class="confirm-actions">
              <button type="button" class="btn-ghost" @click="confirmId = null">{{ $t('dashboard.epk.keep') }}</button>
              <button
                type="button"
                class="btn-danger"
                :disabled="deleting"
                @click="confirmRemove(version)"
              >{{ version.status === 'pending' ? $t('dashboard.epk.discard') : $t('dashboard.epk.delete') }}</button>
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
.empty code { color: #9ca3af; }
.empty--error { color: #f87171; }

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
.is-published { color: #4ade80; background: #052e16; }
.is-pending   { color: #fbbf24; background: #422006; }
.is-archived  { color: #64748b; background: #17171a; }
.version-date { font-size: 0.7rem; color: #475569; }
.version-reason { font-size: 0.75rem; color: #94a3b8; margin: 0; line-height: 1.5; }

.version-actions { display: flex; gap: 0.35rem; align-items: center; flex-shrink: 0; }

.confirm {
  flex-basis: 100%; display: flex; align-items: center; justify-content: space-between;
  gap: 0.75rem; flex-wrap: wrap; padding-top: 0.5rem; border-top: 1px solid #1f1f1f;
}
.confirm-text { font-size: 0.72rem; color: #d6bd8b; margin: 0; line-height: 1.5; }
.confirm-actions { display: flex; gap: 0.35rem; }

.btn-live {
  padding: 0.2rem 0.6rem; border-radius: 0.375rem; font-size: 0.72rem; font-weight: 600;
  cursor: pointer; background: #14532d; border: 1px solid #166534; color: #86efac;
}
.btn-live:hover:not(:disabled) { background: #166534; }
.btn-live:disabled { opacity: 0.45; cursor: default; }

.btn-ghost {
  padding: 0.2rem 0.5rem; border-radius: 0.375rem; font-size: 0.72rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #2a2a2a; color: #64748b;
}
.btn-ghost:hover { border-color: #444444; color: #94a3b8; }
.btn-ghost--danger:hover { border-color: #991b1b; color: #fca5a5; }
.btn-ghost:disabled { opacity: 0.45; cursor: default; }

.btn-danger {
  padding: 0.2rem 0.6rem; border-radius: 0.375rem; font-size: 0.72rem; font-weight: 600;
  cursor: pointer; background: #7f1d1d; border: 1px solid #991b1b; color: #fca5a5;
}
.btn-danger:disabled { opacity: 0.45; cursor: default; }
</style>
