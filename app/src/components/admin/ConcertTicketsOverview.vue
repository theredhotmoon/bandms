<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import TicketStatusBadge from '@/components/admin/TicketStatusBadge.vue'
import { useAuth } from '@/composables/useAuth'
import { fetchConcertTickets } from '@/api/concerts'
import { adminUrl } from '@/config/admin'
import type { Concert } from '@/types/concert'

/**
 * Read-only: where this concert's tickets are sold, and who bought ours.
 * Setting either up happens in the concert's edit form, never here.
 */
const props = defineProps<{ concert: Concert }>()

const { locale } = useI18n()
const { token } = useAuth()

const sellsOwn = computed(() => (props.concert.ticket_types_count ?? 0) > 0)

const issued = useQuery({
  // Same key and shape as ConcertTicketListView, so the two share a cache.
  queryKey: computed(() => ['concert-tickets', props.concert.id]),
  queryFn: () => fetchConcertTickets(token.value!, props.concert.id),
  enabled: computed(() => !!token.value && sellsOwn.value),
})

// Voided tickets were refunded or cancelled; they are listed but not counted.
const soldCount = computed(() => (issued.data.value ?? []).filter(t => t.status !== 'voided').length)

function fmtWhen(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}
</script>

<template>
  <div class="tko" data-testid="concert-tickets-overview">
    <section class="tko-block">
      <h3 class="tko-h">{{ $t('shows.concerts.ticketDetails.external') }}</h3>
      <a v-if="concert.ticket_url" :href="concert.ticket_url" target="_blank" rel="noopener" class="tko-link">{{ concert.ticket_url }}</a>
      <p v-else class="tko-muted">{{ $t('shows.concerts.ticketDetails.noExternal') }}</p>
    </section>

    <section class="tko-block">
      <div class="tko-head">
        <h3 class="tko-h">{{ $t('shows.concerts.ticketDetails.own') }}</h3>
        <span v-if="issued.data.value" class="tko-count" data-testid="tickets-sold-count">
          {{ $t('shows.concerts.ticketDetails.soldCount', { n: soldCount }) }}
        </span>
      </div>

      <p v-if="!sellsOwn" class="tko-muted">{{ $t('shows.concerts.ticketDetails.noOwn') }}</p>
      <p v-else-if="issued.isPending.value" class="tko-muted">{{ $t('common.state.loading') }}</p>
      <p v-else-if="issued.isError.value" class="tko-muted tko-err">{{ $t('shows.tickets.loadFailed') }}</p>
      <p v-else-if="!issued.data.value?.length" class="tko-muted">{{ $t('shows.concerts.ticketDetails.noSales') }}</p>
      <table v-else class="tko-table">
        <thead>
          <tr>
            <th>{{ $t('shows.concerts.ticketDetails.purchasedAt') }}</th>
            <th>{{ $t('shows.tickets.columns.holderName') }}</th>
            <th>{{ $t('shows.tickets.columns.holderEmail') }}</th>
            <th>{{ $t('common.fields.type') }}</th>
            <th>{{ $t('shows.tickets.columns.status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in issued.data.value" :key="t.uuid">
            <td class="tko-num">{{ fmtWhen(t.purchased_at) }}</td>
            <td>{{ t.holder_name ?? '—' }}</td>
            <td class="tko-dim">{{ t.holder_email ?? '—' }}</td>
            <td class="tko-dim">{{ t.ticket_type ?? '—' }}</td>
            <td><TicketStatusBadge :status="t.status" /></td>
          </tr>
        </tbody>
      </table>

      <RouterLink v-if="sellsOwn" :to="adminUrl(`concerts/${concert.id}/tickets`)" class="tko-more">
        {{ $t('shows.concerts.ticketDetails.fullList') }}
      </RouterLink>
    </section>
  </div>
</template>

<style scoped>
.tko { display: flex; flex-direction: column; gap: 1.25rem; }
.tko-block { display: flex; flex-direction: column; gap: 0.5rem; }
.tko-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
.tko-h {
  margin: 0; font-size: var(--fs-2xs); font-weight: 600; color: var(--c-94a3b8);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.tko-count { font-size: var(--fs-sm); color: var(--c-4ade80); font-variant-numeric: tabular-nums; }
.tko-link { font-size: var(--fs-sm); color: var(--c-93c5fd); word-break: break-all; }
.tko-muted { margin: 0; font-size: var(--fs-sm); color: var(--c-64748b); }
.tko-err { color: var(--c-f87171); }
.tko-table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.tko-table th {
  text-align: left; font-size: var(--fs-2xs); font-weight: 600; color: var(--c-64748b);
  text-transform: uppercase; letter-spacing: 0.04em; padding: 0.375rem 0.5rem;
  border-bottom: 1px solid var(--c-222222);
}
.tko-table td { padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--c-1a1a1a); color: var(--c-e2e8f0); }
.tko-dim { color: var(--c-94a3b8) !important; }
.tko-num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.tko-more { align-self: flex-end; font-size: var(--fs-xs); color: var(--c-94a3b8); }
.tko-more:hover { color: var(--c-e2e8f0); }
</style>
