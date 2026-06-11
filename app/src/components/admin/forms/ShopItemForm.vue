<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { ShopItem, ShopItemPayload, ShopItemType } from '@/types/shop'
import { SHOP_ITEM_TYPE_LABELS } from '@/types/shop'
import type { Tag } from '@/types/tag'
import type { ReleaseSummary } from '@/types/release'
import type { Concert } from '@/types/concert'
import type { PostSummary } from '@/types/post'
import type { MusicVideo } from '@/types/musicVideo'

const props = defineProps<{
  initial?: ShopItem | null
  currencies: string[]
  tags: Tag[]
  releases: ReleaseSummary[]
  concerts: Concert[]
  posts: PostSummary[]
  videos: MusicVideo[]
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{
  submit: [payload: ShopItemPayload]
  cancel: []
}>()

const TYPES = Object.keys(SHOP_ITEM_TYPE_LABELS) as ShopItemType[]

const form = reactive({
  name:              '',
  type:              'record' as ShopItemType,
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
})

const prices = reactive<Record<string, string>>({})

watch(
  [() => props.currencies, () => props.initial],
  () => {
    const next: Record<string, string> = {}
    props.currencies.forEach((c) => {
      const existing = props.initial?.prices.find((p) => p.currency === c)
      next[c] = existing ? String(existing.amount) : ''
    })
    // reset prices keys to match currencies
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
      form.type             = 'record'
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
    } else {
      form.name             = item.name
      form.type             = item.type
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
    }
  },
  { immediate: true },
)

function toggleId(arr: number[], id: number) {
  const idx = arr.indexOf(id)
  if (idx === -1) arr.push(id)
  else arr.splice(idx, 1)
}

function err(field: string): string | undefined {
  return props.errors?.[field]?.[0]
}

function handleSubmit() {
  const builtPrices = Object.entries(prices)
    .filter(([, amt]) => amt !== '')
    .map(([currency, amt]) => ({ currency, amount: Number(amt) }))

  const payload: ShopItemPayload = {
    name:             form.name,
    type:             form.type,
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
  }
  emit('submit', payload)
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="shop-form">

    <!-- ── Info ─────────────────────────────────────────────────── -->
    <div class="section-label">Info</div>
    <div class="form-row two-col">
      <div class="field">
        <label class="field-label">Name *</label>
        <input v-model="form.name" type="text" class="field-input" :class="{ 'field-input--error': err('name') }" placeholder="e.g. Debut LP — Limited Edition" />
        <span v-if="err('name')" class="field-error">{{ err('name') }}</span>
      </div>
      <div class="field">
        <label class="field-label">Type *</label>
        <select v-model="form.type" class="field-select">
          <option v-for="t in TYPES" :key="t" :value="t">{{ SHOP_ITEM_TYPE_LABELS[t] }}</option>
        </select>
        <span v-if="err('type')" class="field-error">{{ err('type') }}</span>
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
      <span v-if="err('prices')" class="field-error">{{ err('prices') }}</span>
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

    <!-- ── Links ─────────────────────────────────────────────────── -->
    <div class="section-label">Tags</div>
    <div v-if="!tags.length" class="empty-hint">No tags yet.</div>
    <div v-else class="chips-wrap">
      <label
        v-for="t in tags" :key="t.id"
        class="chip-label"
        :class="{ 'chip-label--on': form.tag_ids.includes(t.id) }"
      >
        <input type="checkbox" :checked="form.tag_ids.includes(t.id)" @change="toggleId(form.tag_ids, t.id)" class="chip-cb" />
        {{ t.name }}
      </label>
    </div>

    <div class="section-label">Releases</div>
    <div v-if="!releases.length" class="empty-hint">No releases yet.</div>
    <div v-else class="link-list">
      <label
        v-for="r in releases" :key="r.id"
        class="link-item"
        :class="{ 'link-item--on': form.release_ids.includes(r.id) }"
      >
        <input type="checkbox" :checked="form.release_ids.includes(r.id)" @change="toggleId(form.release_ids, r.id)" class="chip-cb" />
        <span class="link-item-text">{{ r.title }} <span class="link-item-meta">{{ r.type }}</span></span>
      </label>
    </div>

    <div class="section-label">Concerts</div>
    <div v-if="!concerts.length" class="empty-hint">No concerts yet.</div>
    <div v-else class="link-list">
      <label
        v-for="c in concerts" :key="c.id"
        class="link-item"
        :class="{ 'link-item--on': form.concert_ids.includes(c.id) }"
      >
        <input type="checkbox" :checked="form.concert_ids.includes(c.id)" @change="toggleId(form.concert_ids, c.id)" class="chip-cb" />
        <span class="link-item-text">{{ c.date }} <span class="link-item-meta">{{ c.venue?.name ?? '' }}</span></span>
      </label>
    </div>

    <div class="section-label">Posts</div>
    <div v-if="!posts.length" class="empty-hint">No posts yet.</div>
    <div v-else class="link-list">
      <label
        v-for="p in posts" :key="p.id"
        class="link-item"
        :class="{ 'link-item--on': form.post_ids.includes(p.id) }"
      >
        <input type="checkbox" :checked="form.post_ids.includes(p.id)" @change="toggleId(form.post_ids, p.id)" class="chip-cb" />
        <span class="link-item-text">{{ p.title }}</span>
      </label>
    </div>

    <div class="section-label">Videos</div>
    <div v-if="!videos.length" class="empty-hint">No videos yet.</div>
    <div v-else class="link-list">
      <label
        v-for="v in videos" :key="v.id"
        class="link-item"
        :class="{ 'link-item--on': form.video_ids.includes(v.id) }"
      >
        <input type="checkbox" :checked="form.video_ids.includes(v.id)" @change="toggleId(form.video_ids, v.id)" class="chip-cb" />
        <span class="link-item-text">{{ v.title }}</span>
      </label>
    </div>

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
.field-select,
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
.field-select:focus,
.field-textarea:focus { border-color: #555555; }
.field-input--error { border-color: #f87171 !important; }
.field-textarea { resize: vertical; min-height: 5rem; }
.field-select { appearance: none; cursor: pointer; }
.field-error { font-size: 0.72rem; color: #f87171; }

.form-row { display: flex; gap: 0.75rem; }
.two-col > * { flex: 1; min-width: 0; }

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

/* Chips (tags) */
.chips-wrap { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-bottom: 0.75rem; }
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

/* Link lists */
.link-list { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.75rem; max-height: 10rem; overflow-y: auto; }
.link-item {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 100ms, border-color 100ms;
}
.link-item:hover { background: #1a1a1a; }
.link-item--on { background: #1a1a1a; border-color: #333333; }
.link-item-text { font-size: 0.8rem; color: #94a3b8; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.link-item--on .link-item-text { color: #e2e8f0; }
.link-item-meta { font-size: 0.7rem; color: #475569; margin-left: 0.25rem; }

.empty-hint { font-size: 0.78rem; color: #334155; margin-bottom: 0.75rem; }

/* Actions */
.form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 1rem; margin-top: 0.5rem; border-top: 1px solid #1e1e1e; }
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
