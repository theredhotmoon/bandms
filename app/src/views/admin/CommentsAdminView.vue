<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import CommentLimitForm from '@/components/admin/CommentLimitForm.vue'
import { useAdminComments } from '@/composables/useAdminComments'
import { useUiLang } from '@/composables/useUiLang'
import { saveErrorMessage } from '@/api/client'
import { adminUrl } from '@/config/admin'
import { dateLocale } from '@/locales'
import { formatShortDate } from '@/utils/formatDate'
import type { AdminComment } from '@/types/comment'

const { t } = useI18n()
const { uiLang } = useUiLang()
const { page, query, setHidden, remove, setBlocked } = useAdminComments()

const rows = computed<AdminComment[]>(() => query.data.value?.data ?? [])
const lastPage = computed(() => query.data.value?.last_page ?? 1)

function formatDate(iso: string) {
  return formatShortDate(iso, dateLocale(uiLang.value), 'instant')
}

function fail(error: unknown) {
  toast.error(saveErrorMessage(error, t('content.comments.failed')))
}

async function toggleHidden(c: AdminComment) {
  const hidden = c.hidden_at === null
  try {
    await setHidden.mutateAsync({ id: c.id, hidden })
    toast.success(t(hidden ? 'content.comments.hiddenDone' : 'content.comments.shownDone'))
  } catch (e) { fail(e) }
}

async function toggleBlocked(c: AdminComment) {
  const blocked = c.fan.comments_blocked_at === null
  try {
    await setBlocked.mutateAsync({ fanId: c.fan.id, blocked })
    toast.success(t(blocked ? 'content.comments.blockedDone' : 'content.comments.unblockedDone'))
  } catch (e) { fail(e) }
}

// Delete cannot be undone, so it takes a second click on the same row.
const armedDelete = ref<number | null>(null)
let disarm: ReturnType<typeof setTimeout> | undefined

async function onDelete(c: AdminComment) {
  if (armedDelete.value !== c.id) {
    armedDelete.value = c.id
    clearTimeout(disarm)
    disarm = setTimeout(() => { armedDelete.value = null }, 3000)
    return
  }
  armedDelete.value = null
  try {
    await remove.mutateAsync(c.id)
    toast.success(t('content.comments.deletedDone'))
  } catch (e) { fail(e) }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8 max-w-6xl">
      <h1 class="text-lg font-semibold mb-1" style="color:var(--c-e2e8f0);">{{ $t('content.comments.title') }}</h1>
      <p class="cm-lead">{{ $t('content.comments.lead') }}</p>

      <CommentLimitForm />

      <div v-if="query.isPending.value" class="state-msg">{{ $t('common.state.loading') }}</div>
      <div v-else-if="query.isError.value" class="state-msg" style="color:var(--c-f87171);">{{ $t('content.comments.loadFailed') }}</div>
      <div v-else-if="!rows.length" class="state-msg" data-testid="comments-empty">{{ $t('content.comments.empty') }}</div>

      <div v-else class="table-card">
        <table class="w-full">
          <thead>
            <tr style="border-bottom:1px solid var(--c-222222);">
              <th class="th">{{ $t('content.comments.cols.date') }}</th>
              <th class="th">{{ $t('content.comments.cols.post') }}</th>
              <th class="th">{{ $t('content.comments.cols.author') }}</th>
              <th class="th">{{ $t('content.comments.cols.comment') }}</th>
              <th class="th">{{ $t('content.comments.cols.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in rows"
              :key="c.id"
              class="table-row"
              data-testid="comment-row"
              :data-hidden="c.hidden_at !== null"
              :data-blocked="c.fan.comments_blocked_at !== null"
            >
              <td class="td cm-date">{{ formatDate(c.created_at) }}</td>
              <td class="td">
                <RouterLink :to="{ path: adminUrl('posts'), query: { edit: c.post.id } }" class="cm-post">
                  {{ c.post.title || `#${c.post.id}` }}
                </RouterLink>
              </td>
              <td class="td">
                <div class="cm-author">{{ c.fan.display_name }}</div>
                <div class="cm-email">{{ c.fan.email }}</div>
                <span v-if="c.fan.comments_blocked_at" class="cm-badge cm-badge--blocked">{{ $t('content.comments.badgeBlocked') }}</span>
              </td>
              <td class="td cm-body-cell">
                <span v-if="c.hidden_at" class="cm-badge cm-badge--hidden">{{ $t('content.comments.badgeHidden') }}</span>
                <p class="cm-body" :class="{ 'cm-body--off': c.hidden_at || c.fan.comments_blocked_at }">{{ c.body }}</p>
              </td>
              <td class="td cm-actions">
                <button type="button" class="cm-btn" data-testid="comment-toggle-hidden" @click="toggleHidden(c)">
                  {{ c.hidden_at ? $t('content.comments.show') : $t('content.comments.hide') }}
                </button>
                <button type="button" class="cm-btn" data-testid="comment-toggle-block" @click="toggleBlocked(c)">
                  {{ c.fan.comments_blocked_at ? $t('content.comments.unblock') : $t('content.comments.block') }}
                </button>
                <button type="button" class="cm-btn cm-btn--danger" data-testid="comment-delete" @click="onDelete(c)">
                  {{ armedDelete === c.id ? $t('content.comments.deleteConfirm') : $t('content.comments.delete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="lastPage > 1" class="cm-pager">
        <button type="button" class="cm-btn" :disabled="page <= 1" @click="page--">{{ $t('content.comments.newer') }}</button>
        <span class="cm-page">{{ page }} / {{ lastPage }}</span>
        <button type="button" class="cm-btn" :disabled="page >= lastPage" @click="page++">{{ $t('content.comments.older') }}</button>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.state-msg { color: var(--c-64748b); padding: 2rem 0; font-size: var(--fs-base); }
.cm-lead { color: var(--c-94a3b8); font-size: var(--fs-sm); margin-bottom: 1rem; max-width: 60ch; }
.cm-date { color: var(--c-94a3b8); font-size: var(--fs-xs); white-space: nowrap; }
.cm-post { color: var(--c-e2e8f0); text-decoration: underline; text-underline-offset: 2px; }
.cm-author { color: var(--c-e2e8f0); font-weight: 500; }
.cm-email { color: var(--c-94a3b8); font-size: var(--fs-xs); word-break: break-all; }
.cm-body-cell { max-width: 28rem; }
.cm-body { color: var(--c-e2e8f0); white-space: pre-line; overflow-wrap: anywhere; }
.cm-body--off { color: var(--c-94a3b8); text-decoration: line-through; }
.cm-badge {
  display: inline-block; margin-top: 0.25rem; padding: 0.1rem 0.45rem;
  border-radius: 0.25rem; font-size: var(--fs-2xs); font-weight: 700; text-transform: uppercase;
  background: var(--c-1a1a1a); color: var(--c-94a3b8);
}
.cm-actions { white-space: nowrap; }
.cm-btn {
  margin-right: 0.375rem; padding: 0.3rem 0.65rem; border-radius: 0.375rem;
  border: 1px solid var(--c-334155-line); background: transparent;
  color: var(--c-e2e8f0); font-size: var(--fs-xs); cursor: pointer;
}
.cm-btn:hover:not(:disabled) { background: var(--c-1a1a1a); }
.cm-btn:disabled { cursor: not-allowed; opacity: 0.5; }
.cm-btn--danger { color: var(--c-f87171); }
.cm-pager { display: flex; align-items: center; gap: 0.75rem; margin-top: 1rem; }
.cm-page { color: var(--c-94a3b8); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
</style>
<style scoped src="./admin-table.css" />
