<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { ShopItem, ShopItemPayload, ShopCategory, ShopItemVariant } from '@/types/shop'
import type { Tag } from '@/types/tag'
import type { ReleaseSummary } from '@/types/release'
import type { Concert } from '@/types/concert'
import type { PostSummary } from '@/types/post'
import type { MusicVideo } from '@/types/musicVideo'
import EntityRelationsPanel from '@/components/admin/EntityRelationsPanel.vue'
import { useShop } from '@/composables/useShop'

const props = defineProps<{
  initial?: ShopItem | null
  itemId: number | null
  currencies: string[]
  tags: Tag[]
  releases: ReleaseSummary[]
  concerts: Concert[]
  posts: PostSummary[]
  videos: MusicVideo[]
  categories: ShopCategory[]
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{
  submit: [payload: ShopItemPayload]
  cancel: []
}>()

const form = reactive({
  name:              '',
  description:       '' as string,
  is_available:      true,
  is_presale:        false,
  presale_ships_at:  '' as string,
  stock_quantity:    '' as string,
  purchase_url:      '' as string,
  sort_order:        '0' as string,
  tag_ids:           [] as number[],
  release_ids:       [] as number[],
  concert_ids:       [] as number[],
  post_ids:          [] as number[],
  video_ids:         [] as number[],
  category_ids:      [] as number[],
})

const prices = reactive<Record<string, string>>({})
const localPriceError = ref<string | null>(null)

watch(
  [() => props.currencies, () => props.initial],
  () => {
    const next: Record<string, string> = {}
    props.currencies.forEach((c) => {
      const existing = props.initial?.prices.find((p) => p.currency === c)
      next[c] = existing ? String(existing.amount) : ''
    })
    Object.keys(prices).forEach((k) => delete prices[k])
    Object.assign(prices, next)
  },
  { immediate: true },
)

watch(
  () => props.initial,
  (item) => {
    if (!item) {
      form.name             = ''
      form.description      = ''
      form.is_available     = true
      form.is_presale       = false
      form.presale_ships_at = ''
      form.stock_quantity   = ''
      form.purchase_url     = ''
      form.sort_order       = '0'
      form.tag_ids          = []
      form.release_ids      = []
      form.concert_ids      = []
      form.post_ids         = []
      form.video_ids        = []
      form.category_ids     = []
    } else {
      form.name             = item.name
      form.description      = item.description ?? ''
      form.is_available     = item.is_available
      form.is_presale       = item.is_presale
      form.presale_ships_at = item.presale_ships_at ?? ''
      form.stock_quantity   = item.stock_quantity !== null ? String(item.stock_quantity) : ''
      form.purchase_url     = item.purchase_url ?? ''
      form.sort_order       = String(item.sort_order)
      form.tag_ids          = item.tags?.map((t) => t.id) ?? []
      form.release_ids      = item.release_ids ?? []
      form.concert_ids      = item.concert_ids ?? []
      form.post_ids         = item.post_ids ?? []
      form.video_ids        = item.video_ids ?? []
      form.category_ids     = item.category_ids ?? []
    }
  },
  { immediate: true },
)

function toggleCategory(id: number) {
  const idx = form.category_ids.indexOf(id)
  if (idx === -1) form.category_ids.push(id)
  else form.category_ids.splice(idx, 1)
}

function err(field: string): string | undefined {
  return props.errors?.[field]?.[0]
}

// ── Variants ─────────────────────────────────────────────────────────────────
const { addVariant, editVariant, removeVariant } = useShop()

const newVariant = reactive({ name: '', value: '', stock_quantity: '' as string })
const editingVariantId = ref<number | null>(null)
const editVariantForm = reactive({ name: '', value: '', stock_quantity: '' as string })

function startEditVariant(v: ShopItemVariant) {
  editingVariantId.value = v.id
  editVariantForm.name           = v.name
  editVariantForm.value          = v.value
  editVariantForm.stock_quantity = v.stock_quantity !== null ? String(v.stock_quantity) : ''
}

function cancelEditVariant() {
  editingVariantId.value = null
}

async function handleAddVariant() {
  if (!props.itemId || !newVariant.name.trim() || !newVariant.value.trim()) return
  await addVariant.mutateAsync({
    itemId: props.itemId,
    payload: {
      name:           newVariant.name.trim(),
      value:          newVariant.value.trim(),
      stock_quantity: newVariant.stock_quantity !== '' ? Number(newVariant.stock_quantity) : null,
    },
  })
  newVariant.name           = ''
  newVariant.value          = ''
  newVariant.stock_quantity = ''
}

async function handleSaveVariant(variantId: number) {
  if (!props.itemId) return
  await editVariant.mutateAsync({
    itemId: props.itemId,
    variantId,
    payload: {
      name:           editVariantForm.name.trim(),
      value:          editVariantForm.value.trim(),
      stock_quantity: editVariantForm.stock_quantity !== '' ? Number(editVariantForm.stock_quantity) : null,
    },
  })
  editingVariantId.value = null
}

async function handleDeleteVariant(variantId: number) {
  if (!props.itemId) return
  await removeVariant.mutateAsync({ itemId: props.itemId, variantId })
}

function handleSubmit() {
  const builtPrices = Object.entries(prices)
    .filter(([, amt]) => amt !== '')
    .map(([currency, amt]) => ({ currency, amount: Number(amt) }))

  if (builtPrices.length === 0 && Object.keys(prices).length > 0) {
    localPriceError.value = 'At least one price is required.'
    return
  }
  localPriceError.value = null

  const payload: ShopItemPayload = {
    name:             form.name,
    description:      form.description || null,
    is_available:     form.is_available,
    is_presale:       form.is_presale,
    presale_ships_at: form.is_presale && form.presale_ships_at ? form.presale_ships_at : null,
    stock_quantity:   form.stock_quantity !== '' ? Number(form.stock_quantity) : null,
    purchase_url:     form.purchase_url || null,
    sort_order:       Number(form.sort_order) || 0,
    prices:           builtPrices,
    tag_ids:          form.tag_ids,
    release_ids:      form.release_ids,
    concert_ids:      form.concert_ids,
    post_ids:         form.post_ids,
    video_ids:        form.video_ids,
    category_ids:     form.category_ids,
  }
  emit('submit', payload)
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="shop-form">

    <!-- ── Info ─────────────────────────────────────────────────── -->
    <div class="section-label">Info</div>
    <div class="field">
      <label class="field-label">Name *</label>
      <input v-model="form.name" type="text" class="field-input" :class="{ 'field-input--error': err('name') }" placeholder="e.g. Debut LP — Limited Edition" />
      <span v-if="err('name')" class="field-error">{{ err('name') }}</span>
    </div>

    <div class="field">
      <label class="field-label">Categories</label>
      <div v-if="!categories.length" class="empty-hint">No categories yet. Add some via the Categories button.</div>
      <div v-else class="chips-wrap">
        <label
          v-for="cat in categories" :key="cat.id"
          class="chip-label"
          :class="{ 'chip-label--on': form.category_ids.includes(cat.id) }"
        >
          <input type="checkbox" :checked="form.category_ids.includes(cat.id)" @change="toggleCategory(cat.id)" class="chip-cb" />
          {{ cat.name }}
        </label>
      </div>
    </div>

    <div class="field">
      <label class="field-label">Description</label>
      <textarea v-model="form.description" class="field-textarea" rows="4" placeholder="Describe the item…" />
      <span v-if="err('description')" class="field-error">{{ err('description') }}</span>
    </div>

    <!-- ── Pricing ───────────────────────────────────────────────── -->
    <div class="section-label">Pricing</div>
    <div v-if="!currencies.length" class="empty-hint">
      No currencies configured. Set up currencies in Band Profile → Shop Settings first.
    </div>
    <template v-else>
      <div class="price-grid">
        <div v-for="c in currencies" :key="c" class="price-row">
          <span class="currency-badge">{{ c }}</span>
          <input
            v-model="prices[c]"
            type="number"
            min="0"
            step="0.01"
            class="field-input price-input"
            :placeholder="`Amount in ${c}`"
          />
        </div>
      </div>
      <span v-if="localPriceError" class="field-error">{{ localPriceError }}</span>
      <span v-else-if="err('prices')" class="field-error">{{ err('prices') }}</span>
    </template>

    <!-- ── Inventory ─────────────────────────────────────────────── -->
    <div class="section-label">Inventory</div>
    <div class="form-row two-col">
      <div class="field">
        <label class="field-label">Stock quantity <span class="field-hint">(leave blank for unlimited)</span></label>
        <input v-model="form.stock_quantity" type="number" min="0" step="1" class="field-input" placeholder="Unlimited" />
        <span v-if="err('stock_quantity')" class="field-error">{{ err('stock_quantity') }}</span>
      </div>
      <div class="field">
        <label class="field-label">Sort order</label>
        <input v-model="form.sort_order" type="number" min="0" step="1" class="field-input" />
      </div>
    </div>

    <div class="field">
      <label class="field-label">External purchase URL</label>
      <input v-model="form.purchase_url" type="url" class="field-input" placeholder="https://…" />
      <span v-if="err('purchase_url')" class="field-error">{{ err('purchase_url') }}</span>
    </div>

    <div class="toggles-row">
      <label class="toggle-label">
        <input v-model="form.is_available" type="checkbox" class="toggle-cb" />
        <span class="toggle-text">Available for sale</span>
      </label>
      <label class="toggle-label">
        <input v-model="form.is_presale" type="checkbox" class="toggle-cb" />
        <span class="toggle-text">Pre-sale</span>
      </label>
    </div>

    <div v-if="form.is_presale" class="field">
      <label class="field-label">Ships at</label>
      <input v-model="form.presale_ships_at" type="date" class="field-input" />
      <span v-if="err('presale_ships_at')" class="field-error">{{ err('presale_ships_at') }}</span>
    </div>

    <!-- ── Variants ──────────────────────────────────────────────── -->
    <div class="section-label">Variants</div>
    <div v-if="!itemId" class="empty-hint">Save the item first to add size/color variants.</div>
    <template v-else>
      <!-- Existing variants -->
      <div v-if="initial?.variants?.length" class="variant-table">
        <div class="variant-row variant-row--head">
          <span>Name</span><span>Value</span><span>Stock</span><span></span>
        </div>
        <template v-for="v in initial.variants" :key="v.id">
          <!-- View row -->
          <div v-if="editingVariantId !== v.id" class="variant-row">
            <span class="variant-cell">{{ v.name }}</span>
            <span class="variant-cell">{{ v.value }}</span>
            <span class="variant-cell variant-stock">{{ v.stock_quantity !== null ? v.stock_quantity : '∞' }}</span>
            <span class="variant-cell variant-actions">
              <button type="button" class="vbtn vbtn--edit" @click="startEditVariant(v)">Edit</button>
              <button type="button" class="vbtn vbtn--del" @click="handleDeleteVariant(v.id)" :disabled="removeVariant.isPending.value">Del</button>
            </span>
          </div>
          <!-- Edit row -->
          <div v-else class="variant-row variant-row--editing">
            <input v-model="editVariantForm.name"           type="text"   class="field-input variant-inp" placeholder="Name" />
            <input v-model="editVariantForm.value"          type="text"   class="field-input variant-inp" placeholder="Value" />
            <input v-model="editVariantForm.stock_quantity" type="number" class="field-input variant-inp variant-inp--stock" placeholder="∞" min="0" />
            <span class="variant-cell variant-actions">
              <button type="button" class="vbtn vbtn--save" @click="handleSaveVariant(v.id)" :disabled="editVariant.isPending.value">Save</button>
              <button type="button" class="vbtn vbtn--cancel" @click="cancelEditVariant">Cancel</button>
            </span>
          </div>
        </template>
      </div>
      <div v-else class="empty-hint">No variants yet. Use the form below to add sizes or colors.</div>

      <!-- Add new variant -->
      <div class="variant-add-row">
        <input v-model="newVariant.name"           type="text"   class="field-input variant-inp" placeholder="Name (e.g. Size)" />
        <input v-model="newVariant.value"          type="text"   class="field-input variant-inp" placeholder="Value (e.g. M)" />
        <input v-model="newVariant.stock_quantity" type="number" class="field-input variant-inp variant-inp--stock" placeholder="Stock (blank=∞)" min="0" />
        <button
          type="button"
          class="vbtn vbtn--add"
          :disabled="!newVariant.name.trim() || !newVariant.value.trim() || addVariant.isPending.value"
          @click="handleAddVariant"
        >Add</button>
      </div>
    </template>

    <!-- ── Links ─────────────────────────────────────────────────── -->
    <div class="section-label">Links</div>
    <EntityRelationsPanel
      :tags="tags"
      :releases="releases"
      :concerts="concerts"
      :posts="posts"
      :musicVideos="videos"
      v-model:tagIds="form.tag_ids"
      v-model:releaseIds="form.release_ids"
      v-model:concertIds="form.concert_ids"
      v-model:postIds="form.post_ids"
      v-model:musicVideoIds="form.video_ids"
    />

    <!-- ── Actions ────────────────────────────────────────────────── -->
    <div class="form-actions">
      <button type="button" @click="emit('cancel')" class="btn-cancel">Cancel</button>
      <button type="submit" :disabled="loading" class="btn-submit">
        {{ loading ? 'Saving…' : (initial ? 'Save changes' : 'Create item') }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.shop-form { display: flex; flex-direction: column; gap: 0; }

.section-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #475569;
  border-top: 1px solid #222222;
  padding-top: 0.875rem;
  margin-top: 0.5rem;
  margin-bottom: 0.625rem;
}
.shop-form > .section-label:first-child { border-top: none; margin-top: 0; }

.field { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.75rem; }
.field-label { font-size: 0.78rem; font-weight: 500; color: #94a3b8; }
.field-hint { font-weight: 400; color: #475569; }
.field-input,
.field-textarea {
  background: #141414;
  border: 1px solid #2a2a2a;
  border-radius: 0.375rem;
  color: #e2e8f0;
  font-size: 0.8125rem;
  padding: 0.4375rem 0.625rem;
  outline: none;
  transition: border-color 120ms;
  width: 100%;
}
.field-input:focus,
.field-textarea:focus { border-color: #555555; }
.field-input--error { border-color: #f87171 !important; }
.field-textarea { resize: vertical; min-height: 5rem; }
.field-error { font-size: 0.72rem; color: #f87171; }

.form-row { display: flex; gap: 0.75rem; }
.two-col > * { flex: 1; min-width: 0; }

/* Category chips */
.chips-wrap { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-bottom: 0.25rem; }
.chip-label {
  display: flex; align-items: center; gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  border: 1px solid #2a2a2a;
  background: #141414;
  font-size: 0.75rem;
  color: #64748b;
  cursor: pointer;
  transition: border-color 120ms, color 120ms, background 120ms;
}
.chip-label--on { border-color: #666; color: #e2e8f0; background: #1f1f1f; }
.chip-cb { display: none; }

/* Pricing */
.price-grid { display: flex; flex-direction: column; gap: 0.375rem; margin-bottom: 0.75rem; }
.price-row { display: flex; align-items: center; gap: 0.5rem; }
.currency-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: #94a3b8;
  background: #1e1e1e;
  border: 1px solid #2a2a2a;
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  min-width: 3rem;
  text-align: center;
  letter-spacing: 0.06em;
}
.price-input { max-width: 12rem; }

/* Toggles */
.toggles-row { display: flex; gap: 1.25rem; margin-bottom: 0.75rem; }
.toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
.toggle-cb { width: 0.875rem; height: 0.875rem; accent-color: #888; cursor: pointer; }
.toggle-text { font-size: 0.8125rem; color: #94a3b8; }

.empty-hint { font-size: 0.78rem; color: #334155; margin-bottom: 0.75rem; }

/* Variants */
.variant-table { display: flex; flex-direction: column; border: 1px solid #222; border-radius: 0.375rem; overflow: hidden; margin-bottom: 0.625rem; }
.variant-row {
  display: grid;
  grid-template-columns: 1fr 1fr 5rem 7rem;
  gap: 0.375rem;
  align-items: center;
  padding: 0.375rem 0.5rem;
  border-bottom: 1px solid #1a1a1a;
  font-size: 0.78rem;
  color: #94a3b8;
}
.variant-row:last-child { border-bottom: none; }
.variant-row--head { background: #111; font-weight: 600; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; }
.variant-row--editing { background: #101010; }
.variant-cell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.variant-stock { text-align: center; }
.variant-actions { display: flex; gap: 0.3rem; justify-content: flex-end; }
.variant-inp { padding: 0.3rem 0.45rem; font-size: 0.775rem; }
.variant-inp--stock { max-width: 5rem; }

.variant-add-row {
  display: grid;
  grid-template-columns: 1fr 1fr 5rem auto;
  gap: 0.375rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.vbtn {
  padding: 0.25rem 0.55rem;
  border-radius: 0.3rem;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 100ms, opacity 100ms;
  white-space: nowrap;
}
.vbtn:disabled { opacity: 0.35; cursor: default; }
.vbtn--edit   { background: #1e1e1e; border-color: #333; color: #94a3b8; }
.vbtn--edit:hover:not(:disabled) { background: #252525; }
.vbtn--del    { background: transparent; border-color: #3f1a1a; color: #f87171; }
.vbtn--del:hover:not(:disabled) { background: #1f0e0e; }
.vbtn--save   { background: #1a2a1a; border-color: #2d4a2d; color: #4ade80; }
.vbtn--save:hover:not(:disabled) { background: #1f3520; }
.vbtn--cancel { background: transparent; border-color: #333; color: #64748b; }
.vbtn--cancel:hover:not(:disabled) { background: #1a1a1a; }
.vbtn--add    { background: #1e1e1e; border-color: #333; color: #e2e8f0; }
.vbtn--add:hover:not(:disabled) { background: #282828; }

/* Actions */
.form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 1rem; margin-top: 0.75rem; border-top: 1px solid #1e1e1e; }
.btn-cancel {
  padding: 0.4rem 1rem; border-radius: 0.375rem; font-size: 0.8125rem; font-weight: 500;
  background: transparent; border: 1px solid #2a2a2a; color: #64748b; cursor: pointer;
  transition: background 100ms, color 100ms;
}
.btn-cancel:hover { background: #1a1a1a; color: #94a3b8; }
.btn-submit {
  padding: 0.4rem 1.25rem; border-radius: 0.375rem; font-size: 0.8125rem; font-weight: 600;
  background: #333333; border: 1px solid #555555; color: #fff; cursor: pointer;
  transition: background 100ms;
}
.btn-submit:hover:not(:disabled) { background: #444444; }
.btn-submit:disabled { opacity: 0.4; cursor: default; }
</style>
