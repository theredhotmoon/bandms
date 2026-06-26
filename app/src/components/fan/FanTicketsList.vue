<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useFanAccount } from '@/composables/useFanAccount'
import { fetchFanTickets, initiateTransfer } from '@/api/fan'
import { ApiValidationError } from '@/api/client'
import TicketDownloadCard from '@/components/TicketDownloadCard.vue'
import type { FanTicket } from '@/types/fan'

const { token } = useFanAccount()
const { data: tickets, isPending, isError } = useQuery({
  queryKey: ['fan', 'tickets'],
  queryFn: () => fetchFanTickets(token.value!),
  enabled: computed(() => !!token.value),
})

const STATUS_COLOR: Record<string, string> = {
  active: 'ftl-badge--active',
  scanned: 'ftl-badge--scanned',
  transferred: 'ftl-badge--transferred',
  voided: 'ftl-badge--voided',
}

// Transfer state — keyed by ticket uuid
const transferOpen = ref<Record<string, boolean>>({})
const transferEmail = ref<Record<string, string>>({})
const transferLoading = ref<Record<string, boolean>>({})
const transferResult = ref<Record<string, { link: string } | null>>({})
const transferError = ref<Record<string, string | null>>({})

function openTransfer(ticket: FanTicket): void {
  transferOpen.value[ticket.uuid] = true
  transferEmail.value[ticket.uuid] = ''
  transferResult.value[ticket.uuid] = null
  transferError.value[ticket.uuid] = null
}

function closeTransfer(uuid: string): void {
  transferOpen.value[uuid] = false
}

async function sendTransfer(ticket: FanTicket): Promise<void> {
  const uuid  = ticket.uuid
  const email = (transferEmail.value[uuid] ?? '').trim()
  if (!email) return

  transferLoading.value[uuid] = true
  transferError.value[uuid]   = null
  transferResult.value[uuid]  = null

  try {
    const res = await initiateTransfer(token.value!, uuid, email)
    transferResult.value[uuid] = { link: res.dev_link }
  } catch (err) {
    if (err instanceof ApiValidationError) {
      const msgs = Object.values(err.errors).flat()
      transferError.value[uuid] = msgs.join(' ')
    } else if (err instanceof Error) {
      transferError.value[uuid] = err.message
    } else {
      transferError.value[uuid] = 'Transfer failed.'
    }
  } finally {
    transferLoading.value[uuid] = false
  }
}
</script>

<template>
  <section class="ftl-section">
    <p v-if="isPending" class="ftl-state">Loading tickets…</p>
    <p v-else-if="isError" class="ftl-state ftl-state--error" role="alert">Failed to load tickets.</p>
    <p v-else-if="!tickets || tickets.length === 0" class="ftl-state">No tickets yet.</p>
    <ul v-else class="ftl-list">
      <li v-for="ticket in tickets" :key="ticket.uuid" class="ftl-item">
        <div class="ftl-info">
          <p class="ftl-venue">{{ ticket.venue ?? 'Unknown venue' }}</p>
          <p class="ftl-date">{{ ticket.concert_date ?? '' }}</p>
          <p class="ftl-type">{{ ticket.ticket_type ?? '' }}</p>
          <p class="ftl-holder">{{ ticket.holder_name }}</p>
          <span :class="['ftl-badge', STATUS_COLOR[ticket.status] ?? '']">{{ ticket.status }}</span>
        </div>

        <TicketDownloadCard v-if="ticket.status === 'active'" :uuid="ticket.uuid" />

        <!-- Transfer controls for active tickets -->
        <div v-if="ticket.status === 'active'" class="ftl-transfer">
          <template v-if="!transferOpen[ticket.uuid]">
            <button class="ftl-transfer-btn" type="button" @click="openTransfer(ticket)">
              Transfer
            </button>
          </template>
          <template v-else>
            <div v-if="transferResult[ticket.uuid]" class="ftl-transfer-success" role="status">
              Transfer initiated! Recipient will receive a claim link.
              <br />
              Dev link:
              <a
                :href="transferResult[ticket.uuid]!.link"
                target="_blank"
                rel="noopener noreferrer"
                class="ftl-transfer-link"
              >{{ transferResult[ticket.uuid]!.link }}</a>
            </div>
            <form v-else class="ftl-transfer-form" @submit.prevent="sendTransfer(ticket)">
              <label :for="`transfer-email-${ticket.uuid}`" class="ftl-transfer-label">
                Recipient email
              </label>
              <input
                :id="`transfer-email-${ticket.uuid}`"
                v-model="transferEmail[ticket.uuid]"
                type="email"
                autocomplete="email"
                class="ftl-transfer-input"
                placeholder="recipient@example.com"
                required
              />
              <p v-if="transferError[ticket.uuid]" class="ftl-transfer-error" role="alert">
                {{ transferError[ticket.uuid] }}
              </p>
              <div class="ftl-transfer-actions">
                <button
                  type="submit"
                  class="ftl-transfer-btn ftl-transfer-btn--primary"
                  :disabled="transferLoading[ticket.uuid]"
                >
                  {{ transferLoading[ticket.uuid] ? 'Sending…' : 'Send transfer' }}
                </button>
                <button
                  type="button"
                  class="ftl-transfer-btn"
                  :disabled="transferLoading[ticket.uuid]"
                  @click="closeTransfer(ticket.uuid)"
                >
                  Cancel
                </button>
              </div>
            </form>
          </template>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
/* ── existing badge classes ─────────────────────────── */
.ftl-section { padding: 1rem 0; }
.ftl-state { color: #666; padding: 1rem 0; }
.ftl-state--error { color: #c00; }
.ftl-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1.25rem; }
.ftl-item { border: 1px solid #e5e5e5; border-radius: 0.75rem; padding: 1.25rem; }
.ftl-info { margin-bottom: 0.75rem; }
.ftl-venue { font-weight: 700; margin: 0 0 0.15rem; }
.ftl-date, .ftl-type, .ftl-holder { margin: 0 0 0.15rem; font-size: 0.875rem; color: #555; }
.ftl-badge { display: inline-block; padding: 0.15em 0.55em; border-radius: 0.35em; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; background: #e5e5e5; color: #555; margin-top: 0.35rem; }
.ftl-badge--active { background: #d1fae5; color: #065f46; }
.ftl-badge--scanned { background: #dbeafe; color: #1e3a8a; }
.ftl-badge--transferred { background: #fef3c7; color: #92400e; }
.ftl-badge--voided { background: #fee2e2; color: #991b1b; }

/* ── transfer controls ──────────────────────────────── */
.ftl-transfer { margin-top: 0.75rem; }
.ftl-transfer-btn {
  padding: 0.4rem 0.9rem;
  border-radius: 0.4rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #ddd;
  background: #fff;
  color: #111;
  transition: background 120ms;
}
.ftl-transfer-btn:hover:not(:disabled) { background: #f5f5f5; }
.ftl-transfer-btn--primary { background: #111; color: #fff; border-color: #111; }
.ftl-transfer-btn--primary:hover:not(:disabled) { background: #333; }
.ftl-transfer-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.ftl-transfer-form { display: flex; flex-direction: column; gap: 0.5rem; }
.ftl-transfer-label { font-size: 0.8125rem; font-weight: 600; }
.ftl-transfer-input {
  padding: 0.45rem 0.7rem;
  border: 1px solid #ccc;
  border-radius: 0.4rem;
  font-size: 0.875rem;
  width: 100%;
  box-sizing: border-box;
}
.ftl-transfer-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.ftl-transfer-error { color: #c00; font-size: 0.8rem; margin: 0; }
.ftl-transfer-success { font-size: 0.875rem; color: #065f46; background: #d1fae5; border-radius: 0.4rem; padding: 0.6rem 0.8rem; }
.ftl-transfer-link { word-break: break-all; color: #065f46; }
</style>
