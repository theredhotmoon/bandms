<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import BandMemberForm from '@/components/admin/forms/BandMemberForm.vue'
import { useBandMembers } from '@/composables/useBandMembers'
import { useInstruments } from '@/composables/useInstruments'
import { useAuth } from '@/composables/useAuth'
import type { BandMember, BandMemberPayload } from '@bandms/rider-core'
import { reportSaveError } from '@/utils/formErrors'

const { t } = useI18n()
const { user } = useAuth()
const { query, update } = useBandMembers()
const { query: instrumentsQuery } = useInstruments()

const myMember = computed(() =>
  query.data.value?.find((m: BandMember) => m.id === user.value?.band_member_id) ?? null
)

const errors = ref<Record<string, string[]>>({})
const saving = ref(false)

async function handleSubmit(payload: BandMemberPayload) {
  if (!myMember.value) return
  errors.value = {}
  saving.value = true
  try {
    await update.mutateAsync({ id: myMember.value.id, payload })
    toast.success(t('band.myProfile.updated'))
  } catch (e) {
    reportSaveError(e, t('common.state.somethingWentWrong'), errors)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AdminLayout>
    <div class="my-profile-shell">
      <div class="page-header">
        <div class="page-title">{{ $t('band.myProfile.title') }}</div>
        <div class="page-subtitle">{{ $t('band.myProfile.subtitle') }}</div>
      </div>

      <div v-if="query.isPending.value" class="state-msg">{{ $t('common.state.loading') }}</div>
      <div v-else-if="!myMember" class="state-msg">
        {{ $t('band.myProfile.notLinked') }}
      </div>
      <BandMemberForm
        v-else
        :initial="myMember"
        :loading="saving"
        :errors="errors"
        :available-instruments="instrumentsQuery.data.value ?? []"
        @submit="handleSubmit"
      />
    </div>
  </AdminLayout>
</template>

<style scoped>
.my-profile-shell {
  padding: 1.5rem;
  max-width: 52rem;
}
.page-header { margin-bottom: 1.5rem; }
.page-title    { font-size: 1.125rem; font-weight: 700; color: #e2e8f0; }
.page-subtitle { font-size: 0.8rem; color: #475569; margin-top: 0.25rem; }
.state-msg { padding: 2rem; color: #475569; font-size: 0.875rem; }
</style>
