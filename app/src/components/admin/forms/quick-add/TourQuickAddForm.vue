<script setup lang="ts">
import TourForm from '@/components/admin/forms/TourForm.vue'
import type { TourPayload } from '@/types/tour'

/** The tour form, for EntityQuickAdd's slot (it loads its own concerts list). */
defineProps<{ loading: boolean; errors: Record<string, string[]> }>()
const emit = defineEmits<{ submit: [payload: TourPayload]; cancel: [] }>()
</script>

<template>
  <TourForm :initial="null" :loading="loading" :errors="errors" @submit="emit('submit', $event)" @cancel="emit('cancel')" />
</template>
