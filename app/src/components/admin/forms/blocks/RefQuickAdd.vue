<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminModal from '@/components/admin/AdminModal.vue'
import RefQuickAddConcert from './RefQuickAddConcert.vue'
import RefQuickAddRelease from './RefQuickAddRelease.vue'
import RefQuickAddPress from './RefQuickAddPress.vue'
import RefQuickAddShopItem from './RefQuickAddShopItem.vue'
import type { RefEntity } from '@/types/post'

/**
 * "+ New …" beside a reference block's item select: opens that entity's own
 * admin form in a modal stacked over the post, creates the record, and hands
 * its id back so the block can point at it. The record itself reaches the
 * block's option list through the cache append each entity's create
 * mutation does (useConcerts, useReleases, usePressReleases, useShop), so
 * the option is there before the host's list has refetched.
 *
 * Not QuickAddModal, because the save is not one call: a concert or release
 * uploads its poster or cover after the create, and which lists a form needs
 * differs per entity. So each entity is its own child that owns the save and
 * is mounted only while the modal is open — the list queries a form needs
 * (venues, members, tags…) must not run under every post for a button that
 * may never be pressed.
 *
 * Only the entities whose create flow is a reusable form are offered. An
 * album is made by uploading photos and a music video by fetching a URL's
 * metadata; both live inline in their views and are left to those pages. A
 * clip has its own "Add a new clip…" in the block already.
 */
const props = defineProps<{ entity: RefEntity }>()
const emit = defineEmits<{ created: [id: number] }>()

const { t } = useI18n()

const SUPPORTED: Partial<Record<RefEntity, { button: string; title: string; width: string }>> = {
  concert:       { button: 'content.blocks.ref.newEntity.concert', title: 'shows.concerts.modalNew', width: '56rem' },
  release:       { button: 'content.blocks.ref.newEntity.release', title: 'media.releases.modalNew',  width: '56rem' },
  press_release: { button: 'content.blocks.ref.newEntity.press',   title: 'content.press.modalNew',   width: '52rem' },
  shop_item:     { button: 'content.blocks.ref.newEntity.shop',    title: 'more.shop.modalNew',       width: '52rem' },
}

const config = computed(() => SUPPORTED[props.entity])
const open = ref(false)

function onCreated(id: number): void {
  open.value = false
  emit('created', id)
}
</script>

<template>
  <template v-if="config">
    <button type="button" class="btn-add" data-testid="ref-quick-add" @click="open = true">
      {{ t(config.button) }}
    </button>

    <AdminModal :open="open" :title="t(config.title)" :max-width="config.width" @close="open = false">
      <RefQuickAddConcert  v-if="entity === 'concert'"       @created="onCreated" @cancel="open = false" />
      <RefQuickAddRelease  v-else-if="entity === 'release'"  @created="onCreated" @cancel="open = false" />
      <RefQuickAddPress    v-else-if="entity === 'press_release'" @created="onCreated" @cancel="open = false" />
      <RefQuickAddShopItem v-else-if="entity === 'shop_item'" @created="onCreated" @cancel="open = false" />
    </AdminModal>
  </template>
</template>

<style scoped src="../../form-styles.css" />
