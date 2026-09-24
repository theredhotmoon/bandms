<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import MemberSetupsPanel from '@/components/band-member/MemberSetupsPanel.vue'
import { useBandMembers } from '@/composables/useBandMembers'
import { useAuth } from '@/composables/useAuth'
import { useMyRiderConfirmations } from '@/composables/useRiderConfirmations'
import type { BandMember } from '@bandms/rider-core'
import { toast } from 'vue-sonner'
import { reportSaveError } from '@/utils/formErrors'

const { t } = useI18n()
const { user } = useAuth()
const { query } = useBandMembers()

// Riders someone has asked this musician to confirm. The email points here, so
// the ask has to be visible on arrival rather than buried in a menu.
const { pending, confirm } = useMyRiderConfirmations()

async function confirmRig(riderId: number, riderName: string) {
  try {
    await confirm.mutateAsync(riderId)
    toast.success(t('band.setups.confirmed', { name: riderName }))
  } catch (e) {
    reportSaveError(e, t('band.setups.confirmFailed'))
  }
}

function gigLabel(c: { rider?: { name: string; concert: { date: string; venue: string | null } | null } }): string {
  const concert = c.rider?.concert
  if (!concert) return c.rider?.name ?? t('band.setups.thisGig')
  const date = new Date(concert.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return [concert.venue, date].filter(Boolean).join(', ')
}

const myMember = computed(() =>
  query.data.value?.find((m: BandMember) => m.id === user.value?.band_member_id) ?? null
)
</script>

<template>
  <AdminLayout>
    <div class="my-setups-shell">
      <div class="page-header">
        <div class="page-title">{{ $t('band.setups.title') }}</div>
        <div class="page-subtitle">{{ $t('band.setups.subtitle') }}</div>
      </div>

      <div v-if="pending.length" class="confirm-banner">
        <div class="confirm-title">
          {{ $t('band.setups.waiting', pending.length, { named: { n: pending.length } }) }}
        </div>
        <p class="confirm-hint">{{ $t('band.setups.waitingHint') }}</p>
        <div class="confirm-rows">
          <div v-for="c in pending" :key="c.id" class="confirm-row">
            <span class="confirm-gig">{{ gigLabel(c) }}</span>
            <button
              type="button"
              class="btn-confirm"
              :disabled="confirm.isPending.value"
              @click="confirmRig(c.tech_rider_id, gigLabel(c))"
            >{{ $t('band.setups.confirmRig') }}</button>
          </div>
        </div>
      </div>

      <div v-if="query.isPending.value" class="state-msg">{{ $t('common.state.loading') }}</div>
      <div v-else-if="!myMember" class="state-msg">
        {{ $t('band.myProfile.notLinked') }}
      </div>
      <MemberSetupsPanel v-else :key="myMember.id" :member="myMember" />
    </div>
  </AdminLayout>
</template>

<style scoped>
.my-setups-shell {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.page-header { margin-bottom: 1rem; }
.page-title    { font-size: 1.125rem; font-weight: 700; color: #e2e8f0; }
.page-subtitle { font-size: 0.8rem; color: #475569; margin-top: 0.25rem; }
.state-msg { padding: 2rem; color: #475569; font-size: 0.875rem; }

/* The ask that brought them here from their inbox. */
.confirm-banner {
  border: 1px solid #1e3a5f; border-radius: 0.5rem; background: #0b1520;
  padding: 0.8rem 1rem; margin-bottom: 1rem;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.confirm-title { font-size: 0.8rem; font-weight: 700; color: #93c5fd; }
.confirm-hint { font-size: 0.75rem; color: #94a3b8; margin: 0; line-height: 1.55; max-width: 44rem; }
.confirm-rows { display: flex; flex-direction: column; gap: 0.35rem; }
.confirm-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.75rem; flex-wrap: wrap;
}
.confirm-gig { font-size: 0.78rem; color: #e2e8f0; }
.btn-confirm {
  padding: 0.3rem 0.75rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; background: #1d4ed8; border: none; color: #eff6ff;
}
.btn-confirm:disabled { opacity: 0.5; cursor: default; }
</style>
