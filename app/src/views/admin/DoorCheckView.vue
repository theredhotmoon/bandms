<script setup lang="ts">
import { ref } from 'vue'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { doorCheck, doorScan } from '@/api/tickets'
import { useAuth } from '@/composables/useAuth'
import type { DoorCheckResult } from '@/types/ticket'

const { token } = useAuth()

const code = ref('')
const result = ref<DoorCheckResult | null>(null)
const loading = ref(false)
const scanning = ref(false)
const error = ref('')

async function check() {
  if (!code.value.trim()) return
  loading.value = true
  result.value = null
  error.value = ''
  try {
    result.value = await doorCheck(token.value!, code.value.trim().toUpperCase())
  } catch (e) {
    error.value = 'Network error. Please try again.'
  } finally {
    loading.value = false
  }
}

async function scan() {
  if (!code.value.trim()) return
  scanning.value = true
  result.value = null
  error.value = ''
  try {
    result.value = await doorScan(token.value!, code.value.trim().toUpperCase())
  } catch (e) {
    error.value = 'Network error. Please try again.'
  } finally {
    scanning.value = false
  }
}

function reset() {
  code.value = ''
  result.value = null
  error.value = ''
}

function statusColor(): string {
  if (!result.value) return ''
  if (!result.value.valid) return '#ef4444'
  if (result.value.scanned) return '#f59e0b'
  return '#22c55e'
}
</script>

<template>
  <AdminLayout>
    <div class="door-wrap">
      <h1 class="door-title">Door Check</h1>
      <p class="door-sub">Enter a ticket code to validate entry.</p>

      <div class="input-row">
        <input
          v-model="code"
          class="code-input"
          placeholder="TICKET CODE"
          @keydown.enter="check"
          autocomplete="off"
          spellcheck="false"
          style="text-transform:uppercase;"
        />
        <button class="btn-check" :disabled="loading || !code.trim()" @click="check">
          {{ loading ? '…' : 'Check' }}
        </button>
        <button v-if="result || code" class="btn-reset" @click="reset">Reset</button>
      </div>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <div v-if="result" class="result-card" :style="{ borderColor: statusColor() }">
        <div class="status-row">
          <div class="status-dot" :style="{ background: statusColor() }"></div>
          <div class="status-text" :style="{ color: statusColor() }">
            <template v-if="!result.valid">INVALID TICKET</template>
            <template v-else-if="result.scanned">ALREADY SCANNED</template>
            <template v-else>VALID — ALLOW ENTRY</template>
          </div>
        </div>

        <div v-if="result.valid" class="info-grid">
          <div class="info-row">
            <span class="info-label">Type</span>
            <span class="info-val">{{ result.ticket_type ?? '—' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Concert</span>
            <span class="info-val">{{ result.concert ?? '—' }}</span>
          </div>
          <div class="info-row" v-if="result.concert_date">
            <span class="info-label">Date</span>
            <span class="info-val">{{ result.concert_date }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Customer</span>
            <span class="info-val">{{ result.customer ?? '—' }}</span>
          </div>
          <div v-if="result.scanned && result.scanned_at" class="info-row">
            <span class="info-label">Scanned at</span>
            <span class="info-val" style="color:#f59e0b;">{{ new Date(result.scanned_at).toLocaleString() }}</span>
          </div>
        </div>

        <div v-if="result.reason" class="reason-text">{{ result.reason }}</div>

        <button
          v-if="result.valid && !result.scanned"
          class="btn-scan"
          :disabled="scanning"
          @click="scan"
        >
          {{ scanning ? 'Scanning…' : '✓ Mark as Scanned' }}
        </button>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.door-wrap {
  max-width: 520px;
  margin: 60px auto;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.door-title {
  font: 700 24px/1 system-ui;
  color: #e2e8f0;
  margin: 0;
}
.door-sub {
  font-size: 14px;
  color: #64748b;
  margin: -10px 0 0;
}

.input-row {
  display: flex;
  gap: 8px;
}
.code-input {
  flex: 1;
  background: #111;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: #e2e8f0;
  padding: 10px 14px;
  font: 600 16px/1 'Courier New', monospace;
  letter-spacing: .1em;
}
.code-input:focus { outline: 2px solid #3b82f6; border-color: transparent; }
.btn-check {
  padding: 10px 20px;
  border-radius: 6px;
  font: 600 14px/1 system-ui;
  background: #3b82f6;
  color: #fff;
  border: none;
  cursor: pointer;
}
.btn-check:hover:not(:disabled) { background: #2563eb; }
.btn-check:disabled { opacity: .5; cursor: default; }
.btn-reset {
  padding: 10px 14px;
  border-radius: 6px;
  font: 600 13px/1 system-ui;
  background: transparent;
  color: #64748b;
  border: 1px solid #2a2a2a;
  cursor: pointer;
}
.btn-reset:hover { color: #e2e8f0; }

.error-msg { color: #f87171; font-size: 13px; margin: 0; }

.result-card {
  border: 2px solid;
  border-radius: 10px;
  padding: 20px;
  background: #0d0d0d;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.status-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-text {
  font: 800 18px/1 system-ui;
  letter-spacing: .04em;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid #1a1a1a;
}
.info-row {
  display: flex;
  gap: 10px;
  font-size: 13px;
}
.info-label {
  color: #64748b;
  min-width: 80px;
  font-weight: 500;
}
.info-val { color: #e2e8f0; }

.reason-text { font-size: 13px; color: #94a3b8; }

.btn-scan {
  padding: 12px 20px;
  border-radius: 7px;
  font: 700 15px/1 system-ui;
  background: #14532d;
  color: #4ade80;
  border: 1px solid #166534;
  cursor: pointer;
  transition: background .12s;
}
.btn-scan:hover:not(:disabled) { background: #166534; }
.btn-scan:disabled { opacity: .6; cursor: default; }
</style>
