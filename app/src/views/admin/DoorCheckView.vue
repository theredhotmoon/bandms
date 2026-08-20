<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { doorCheck, doorScan } from '@/api/tickets'
import { useAuth } from '@/composables/useAuth'
import type { DoorCheckResult } from '@/types/ticket'

interface ScanLogEntry {
  ts: string
  code: string
  valid: boolean
  name: string
}

const { token } = useAuth()

const isOnline = ref(navigator.onLine)
const cameraSupported = ref(typeof BarcodeDetector !== 'undefined')
const cameraError = ref('')
const videoEl = ref<HTMLVideoElement | null>(null)

const manualCode = ref('')
const currentCode = ref('')
const result = ref<DoorCheckResult | null>(null)
const loading = ref(false)
const scanning = ref(false)
const error = ref('')
const scanLog = ref<ScanLogEntry[]>([])

let stream: MediaStream | null = null
let detector: BarcodeDetector | null = null
let rafId = 0
let busy = false

function addLog(code: string, valid: boolean, name: string) {
  scanLog.value = [
    { ts: new Date().toLocaleTimeString(), code, valid, name },
    ...scanLog.value,
  ].slice(0, 20)
}

/**
 * Read-only lookup. Detection never marks a ticket used — the operator
 * confirms with `confirmScan()` after seeing who is at the door.
 */
async function check(code: string) {
  const trimmed = code.trim()
  if (loading.value || !trimmed) return
  loading.value = true
  error.value = ''
  result.value = null
  try {
    const data = await doorCheck(token.value!, trimmed)
    currentCode.value = trimmed
    result.value = data
    addLog(trimmed, data.valid, data.valid ? (data.customer ?? 'OK') : (data.reason ?? 'INVALID'))
  } catch {
    error.value = 'Network error. Please try again.'
  } finally {
    loading.value = false
    manualCode.value = ''
  }
}

async function confirmScan() {
  if (scanning.value || !currentCode.value) return
  scanning.value = true
  error.value = ''
  try {
    const data = await doorScan(token.value!, currentCode.value)
    result.value = data
    addLog(currentCode.value, data.valid, 'ENTERED')
  } catch {
    error.value = 'Network error. Please try again.'
  } finally {
    scanning.value = false
  }
}

function reset() {
  manualCode.value = ''
  currentCode.value = ''
  result.value = null
  error.value = ''
}

function statusColor(): string {
  if (!result.value) return ''
  if (!result.value.valid) return '#ef4444'
  if (result.value.scanned) return '#f59e0b'
  return '#22c55e'
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    if (videoEl.value) videoEl.value.srcObject = stream
    detector = new BarcodeDetector({ formats: ['qr_code'] })
    scanLoop()
  } catch {
    cameraError.value = 'Camera access denied or unavailable.'
  }
}

function scanLoop() {
  rafId = requestAnimationFrame(async () => {
    // Hold detection while a result is on screen so the same badge is not
    // re-read on every frame; the operator clears it with Reset.
    if (!detector || !videoEl.value || busy || result.value) { scanLoop(); return }
    if (videoEl.value.readyState < 2) { scanLoop(); return }
    busy = true
    try {
      const codes = await detector.detect(videoEl.value)
      if (codes.length) await check(codes[0].rawValue)
    } catch { /* ignore frame errors */ }
    busy = false
    scanLoop()
  })
}

function handleOnline()  { isOnline.value = true }
function handleOffline() { isOnline.value = false }

onMounted(() => {
  if (cameraSupported.value) startCamera()
  window.addEventListener('online',  handleOnline)
  window.addEventListener('offline', handleOffline)
})

onUnmounted(() => {
  window.removeEventListener('online',  handleOnline)
  window.removeEventListener('offline', handleOffline)
  cancelAnimationFrame(rafId)
  stream?.getTracks().forEach((t) => t.stop())
})
</script>

<template>
  <AdminLayout>
    <div class="door-wrap">
      <h1 class="door-title">Door Check</h1>
      <p class="door-sub">Scan a ticket QR code, or paste a ticket UUID.</p>

      <p v-if="!isOnline" class="offline-warning">⚠ Offline — results may be stale</p>

      <div v-if="cameraSupported" class="camera-section">
        <video ref="videoEl" autoplay playsinline />
        <p v-if="cameraError" class="error-msg">{{ cameraError }}</p>
      </div>

      <form class="input-row" @submit.prevent="check(manualCode)">
        <input
          v-model="manualCode"
          class="code-input"
          placeholder="Paste ticket UUID…"
          autocomplete="off"
          spellcheck="false"
          :disabled="loading"
        />
        <button type="submit" class="btn-check" :disabled="loading || !manualCode.trim()">
          {{ loading ? '…' : 'Check' }}
        </button>
        <button v-if="result || manualCode" type="button" class="btn-reset" @click="reset">Reset</button>
      </form>

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
          @click="confirmScan"
        >
          {{ scanning ? 'Scanning…' : '✓ Mark as Scanned' }}
        </button>
      </div>

      <div v-if="scanLog.length" class="scan-log">
        <div class="log-header">Recent scans</div>
        <div
          v-for="entry in scanLog"
          :key="entry.ts + entry.code"
          class="log-entry"
          :class="entry.valid ? 'log-ok' : 'log-fail'"
        >
          <span class="log-ts">{{ entry.ts }}</span>
          <span class="log-code">{{ entry.code.slice(0, 8) }}</span>
          <span class="log-name">{{ entry.valid ? entry.name : 'INVALID' }}</span>
        </div>
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

.offline-warning {
  background: #1c1107; color: #fbbf24; border: 1px solid #854d0e;
  border-radius: 6px; padding: 8px 12px; font-size: 13px; margin: 0;
}

.camera-section video {
  display: block;
  width: 100%;
  max-width: 300px;
  border-radius: 8px;
  background: #000;
}

.input-row {
  display: flex;
  gap: 8px;
}
.code-input {
  flex: 1;
  min-width: 0;
  background: #111;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: #e2e8f0;
  padding: 10px 14px;
  font: 600 14px/1 'Courier New', monospace;
  letter-spacing: .06em;
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

.scan-log { border: 1px solid #1f1f1f; border-radius: 8px; overflow: hidden; }
.log-header {
  padding: 8px 12px; font-size: 10.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .07em;
  color: #475569; background: #111;
}
.log-entry {
  display: flex; gap: 12px; padding: 6px 12px;
  font-size: 12.5px; border-top: 1px solid #1f1f1f;
}
.log-ok   { background: #0a1a0a; }
.log-fail { background: #1a0a0a; }
.log-ts   { color: #475569; white-space: nowrap; }
.log-code { font-family: monospace; color: #94a3b8; }
.log-ok .log-name   { color: #4ade80; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-fail .log-name { color: #f87171; flex: 1; }
</style>
