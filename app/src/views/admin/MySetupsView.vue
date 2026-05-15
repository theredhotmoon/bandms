<script setup lang="ts">
import { computed } from 'vue'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import MemberSetupsPanel from '@/components/band-member/MemberSetupsPanel.vue'
import { useBandMembers } from '@/composables/useBandMembers'
import { useAuth } from '@/composables/useAuth'

const { user } = useAuth()
const { query } = useBandMembers()

const myMember = computed(() =>
  query.data.value?.find((m) => m.id === user.value?.band_member_id) ?? null
)
</script>

<template>
  <AdminLayout>
    <div class="my-setups-shell">
      <div class="page-header">
        <div class="page-title">My Stage Setups</div>
        <div class="page-subtitle">Manage your personal rig presets — inputs, monitor mix, backline, and power requirements.</div>
      </div>

      <div v-if="query.isPending.value" class="state-msg">Loading…</div>
      <div v-else-if="!myMember" class="state-msg">
        Your account is not linked to a band member profile yet. Ask an admin to link your account.
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
</style>
