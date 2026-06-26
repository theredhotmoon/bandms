<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { useAuth } from '@/composables/useAuth'
import { API_BASE, authHeaders, handleResponse } from '@/api/client'

interface ScanResult {
  valid: boolean
  reason?: string
  customer?: string
  ticket_type?: string
  concert?: string
  already_used?: boolean
}

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
const result = ref<ScanResult | null>(null)
const loading = ref(false)
const scanLog = ref<ScanLogEntry[]>([])

let stream: MediaStream | null = null
let detector: BarcodeDetector | null = null
let rafId = 0
let scanning = false

function addLog(code: string, res: ScanResult) {
  const entry: ScanLogEntry = {
    ts: new Date().toLocaleTimeString(),
    code,
    valid: res.valid,
    name: res.valid ? (res.customer ?? 'OK') : (res.reason ?? 'INVALID'),
  }
  scanLog.value = [entry, ...scanLog.value].slice(0, 20)
}

async function submitCode(code: string) {
  if (loading.value || !code.trim()) return
  loading.value = true
  try {
    const res = await fetch(`${API_BASE}/api/door-check/scan`, {
      method: 'POST',
      headers: authHeaders(token.value!),
      body: JSON.stringify({ code: code.trim() }),
    })
    const data = await handleResponse<ScanResult>(res)
    result.value = data
    addLog(code, data)
  } catch {
    result.value = { valid: false, reason: 'Network error' }
  } finally {
    loading.value = false
    manualCode.value = ''
  }
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
    if (!detector || !videoEl.value || scanning) { scanLoop(); return }
    if (videoEl.value.readyState < 2) { scanLoop(); return }
    scanning = true
    try {
      const codes = await detector.detect(videoEl.value)
      if (codes.length) {
        await submitCode(codes[0].rawValue)
      }
    } catch { /* ignore frame errors */ }
    scanning = false
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
    <div class="p-8 max-w-lg">
      <h1 class="text-lg font-semibold mb-6" style="color:#e2e8f0;">Door Check</h1>

      <p v-if="!isOnline" class="offline-warning">⚠ Offline — results may be stale</p>

      <div v-if="cameraSupported" class="camera-section mb-6">
        <video ref="videoEl" autoplay playsinline style="width:100%;max-width:300px;border-radius:0.5rem;background:#000;" />
        <p v-if="cameraError" class="text-sm mt-2" style="color:#f87171;">{{ cameraError }}</p>
      </div>

      <form @submit.prevent="submitCode(manualCode)" class="flex gap-2 mb-6">
        <input
          v-model="manualCode"
          type="text"
          placeholder="Paste ticket UUID…"
          class="code-input"
          :disabled="loading"
        />
        <button type="submit" class="btn-scan" :disabled="loading || !manualCode.trim()">
          {{ loading ? '…' : 'Check' }}
        </button>
      </form>

      <div v-if="result" class="result-card mb-6" :class="result.valid ? 'result-ok' : 'result-fail'">
        <div class="result-title">{{ result.valid ? (result.already_used ? '⚠ Already Scanned' : '✓ Valid') : '✗ Invalid' }}</div>
        <div v-if="result.valid" class="result-detail">
          <div>{{ result.customer }}</div>
          <div>{{ result.ticket_type }}</div>
          <div>{{ result.concert }}</div>
        </div>
        <div v-else class="result-detail">{{ result.reason }}</div>
      </div>

      <div v-if="scanLog.length" class="scan-log">
        <div class="log-header">Recent scans</div>
        <div v-for="entry in scanLog" :key="entry.ts + entry.code" class="log-entry" :class="entry.valid ? 'log-ok' : 'log-fail'">
          <span class="log-ts">{{ entry.ts }}</span>
          <span class="log-code">{{ entry.code.slice(0, 8) }}</span>
          <span class="log-name">{{ entry.valid ? entry.name : 'INVALID' }}</span>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.offline-warning {
  background: #1c1107; color: #fbbf24; border: 1px solid #854d0e;
  border-radius: 0.375rem; padding: 0.5rem 0.75rem; font-size: 0.8125rem; margin-bottom: 1rem;
}
.camera-section video { display: block; }
.code-input {
  flex: 1; padding: 0.5rem 0.75rem; border-radius: 0.375rem;
  border: 1px solid #252525; background: #0d0d0d;
  color: #e2e8f0; font-size: 0.875rem; outline: none; font-family: monospace;
}
.code-input:focus { border-color: #334155; }
.btn-scan {
  padding: 0.5rem 1.25rem; border-radius: 0.375rem;
  background: #e8e8e8; color: #111; border: none;
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: background 120ms;
}
.btn-scan:hover:not(:disabled) { background: #fff; }
.btn-scan:disabled { opacity: 0.5; cursor: default; }
.result-card { padding: 1rem 1.25rem; border-radius: 0.5rem; }
.result-ok   { background: #052e16; border: 1px solid #15803d; }
.result-fail { background: #2d0a0a; border: 1px solid #7f1d1d; }
.result-title { font-weight: 700; font-size: 1rem; margin-bottom: 0.375rem; }
.result-ok .result-title   { color: #4ade80; }
.result-fail .result-title { color: #f87171; }
.result-detail { font-size: 0.8125rem; color: #94a3b8; display: flex; flex-direction: column; gap: 0.125rem; }
.scan-log { border: 1px solid #1f1f1f; border-radius: 0.5rem; overflow: hidden; }
.log-header { padding: 0.5rem 0.75rem; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #475569; background: #111; }
.log-entry {
  display: flex; gap: 0.75rem; padding: 0.4rem 0.75rem;
  font-size: 0.78rem; border-top: 1px solid #1f1f1f;
}
.log-ok   { background: #0a1a0a; }
.log-fail { background: #1a0a0a; }
.log-ts   { color: #475569; white-space: nowrap; }
.log-code { font-family: monospace; color: #94a3b8; }
.log-ok .log-name   { color: #4ade80; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-fail .log-name { color: #f87171; flex: 1; }
</style>
