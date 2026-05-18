<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import PostForm from '@/components/admin/forms/PostForm.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { usePosts, usePost } from '@/composables/usePosts'
import { useTags } from '@/composables/useTags'
import { useConcerts } from '@/composables/useConcerts'
import { useAlbums } from '@/composables/useAlbums'
import { useReleases } from '@/composables/useReleases'
import { useTours } from '@/composables/useTours'
import { useMusicVideos } from '@/composables/useMusicVideos'
import { usePressReleases } from '@/composables/usePressReleases'
import { useTableControls } from '@/composables/useTableControls'
import { ApiValidationError } from '@/api/client'
import type { PostSummary, PostPayload } from '@/types/post'

const { query, create, update, remove } = usePosts()
const { query: tagsQ }       = useTags()
const { query: concertsQ }   = useConcerts()
const { query: albumsQ }     = useAlbums()
const { query: releasesQ }   = useReleases()
const { query: toursQ }         = useTours()
const { query: musicVideosQ }   = useMusicVideos()
const { query: pressReleasesQ } = usePressReleases()

const showModal = ref(false)
const editingId = ref<number | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const confirmId = ref<number | null>(null)
const isCreating = ref(false)
const filterStatus = ref<'' | 'published' | 'draft'>('')

const editQuery = usePost(editingId)
const formPost = computed(() => isCreating.value ? null : editQuery.data.value ?? null)

const filteredData = computed(() => {
  let rows = query.data.value?.data ?? []
  if (filterStatus.value === 'published') rows = rows.filter((p: PostSummary) => !!p.published_at)
  if (filterStatus.value === 'draft') rows = rows.filter((p: PostSummary) => !p.published_at)
  return rows
})

const tc = useTableControls<PostSummary>({
  data: filteredData,
  searchFn: (p, q) =>
    p.title.toLowerCase().includes(q) ||
    (p.tags ?? []).some(t => t.name.toLowerCase().includes(q)),
  defaultSort: 'published_at',
  defaultDir: 'desc',
})

function openCreate() {
  isCreating.value = true; editingId.value = null; fieldErrors.value = {}; showModal.value = true
}
function openEdit(id: number) {
  isCreating.value = false; editingId.value = id; fieldErrors.value = {}; showModal.value = true
}
function closeModal() { showModal.value = false }

async function handleSubmit(payload: PostPayload) {
  fieldErrors.value = {}
  try {
    if (editingId.value && !isCreating.value) {
      await update.mutateAsync({ id: editingId.value, payload })
      toast.success('Post updated')
    } else {
      await create.mutateAsync(payload)
      toast.success('Post created')
    }
    closeModal()
  } catch (e) {
    if (e instanceof ApiValidationError) fieldErrors.value = e.errors
    else toast.error('Something went wrong')
  }
}

async function confirmDelete() {
  if (confirmId.value == null) return
  try {
    await remove.mutateAsync(confirmId.value)
    toast.success('Post deleted')
    confirmId.value = null
  } catch { toast.error('Failed to delete') }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">Posts</h1>
        <button @click="openCreate" class="btn-add-primary">+ Add post</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">Loading…</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:#f87171;">Failed to load posts.</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value">
            <template #filters>
              <select v-model="filterStatus" class="filter-select">
                <option value="">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </template>
          </TableToolbar>

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!(query.data.value?.data?.length)">No posts yet.</span>
            <span v-else>No posts match your search.</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #1a1a3a;">
                <SortHeader label="Title" sort-key="title" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th">Tags</th>
                <SortHeader label="Published" sort-key="published_at" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="post in tc.paginated.value" :key="post.id" class="table-row">
                <td class="td font-medium" style="color:#e2e8f0; max-width:16rem;">
                  <span class="truncate block">{{ post.title }}</span>
                </td>
                <td class="td">
                  <span v-if="post.tags?.length" class="pill-list">
                    <span v-for="t in post.tags" :key="t.id" class="pill pill--tag">{{ t.name }}</span>
                  </span>
                  <span v-else style="color:#475569;">—</span>
                </td>
                <td class="td text-xs" :style="post.published_at ? 'color:#34d399;' : 'color:#475569;'">
                  {{ post.published_at ? post.published_at.slice(0,10) : 'Draft' }}
                </td>
                <td class="td text-right">
                  <button @click="openEdit(post.id)" class="btn-edit">Edit</button>
                  <button @click="confirmId = post.id" class="btn-delete">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>

          <Pagination
            v-if="tc.totalPages.value > 1"
            :page="tc.page.value"
            :total-pages="tc.totalPages.value"
            :total="tc.total.value"
            :per-page="tc.perPage"
            :from="tc.from.value"
            :to="tc.to.value"
            @update:page="tc.page.value = $event"
          />
        </template>
      </div>
    </div>

    <AdminModal :open="showModal" :title="isCreating ? 'New post' : 'Edit post'" max-width="44rem" @close="closeModal">
      <div v-if="!isCreating && editQuery.isPending.value" class="py-8 text-center text-sm" style="color:#475569;">Loading post…</div>
      <PostForm
        v-else
        :initial="formPost"
        :tags="tagsQ.data.value ?? []"
        :concerts="concertsQ.data.value ?? []"
        :albums="albumsQ.data.value ?? []"
        :releases="releasesQ.data.value ?? []"
        :tours="toursQ.data.value ?? []"
        :musicVideos="musicVideosQ.data.value ?? []"
        :pressReleases="pressReleasesQ.data.value ?? []"
        :loading="create.isPending.value || update.isPending.value"
        :errors="fieldErrors"
        @submit="handleSubmit"
        @cancel="closeModal"
      />
    </AdminModal>

    <ConfirmDialog :open="confirmId !== null" :loading="remove.isPending.value" @confirm="confirmDelete" @cancel="confirmId = null" />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped>
.pill-list { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.pill { font-size:0.7rem; padding:0.1rem 0.4rem; border-radius:9999px; background:#1e1b4b; color:#a5b4fc; white-space:nowrap; }
.pill--tag { background:#0f2a1e; color:#34d399; }
</style>
