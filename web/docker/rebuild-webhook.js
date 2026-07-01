'use strict'
const http = require('http')
const { spawn } = require('child_process')

const TIMEOUT_MS = 5 * 60 * 1000

let state = { status: 'idle', startedAt: null, finishedAt: null }

function triggerRebuild() {
  if (state.status === 'building') return false
  const startedAt = Date.now()
  state = { status: 'building', startedAt, finishedAt: null }
  console.log('[webhook] Rebuild started')

  let timedOut = false

  const child = spawn('sh', ['/docker/rebuild.sh'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })

  child.stdout.on('data', (d) => process.stdout.write(d))
  child.stderr.on('data', (d) => process.stderr.write(d))

  const timer = setTimeout(() => {
    timedOut = true
    child.kill('SIGTERM')
    state = { status: 'error', startedAt, finishedAt: Date.now() }
    console.error('[webhook] Rebuild timed out — child killed')
  }, TIMEOUT_MS)

  child.on('error', (err) => {
    clearTimeout(timer)
    state = { status: 'error', startedAt, finishedAt: Date.now() }
    console.error(`[webhook] Spawn failed: ${err.message}`)
  })

  child.on('exit', (code) => {
    clearTimeout(timer)
    if (timedOut) return
    state = { status: code === 0 ? 'done' : 'error', startedAt, finishedAt: Date.now() }
    console.log(`[webhook] Rebuild ${state.status} (exit ${code})`)
  })

  return true
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/rebuild') {
    const started = triggerRebuild()
    if (!started) {
      res.writeHead(409, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'building', message: 'rebuild already in progress' }))
      return
    }
    res.writeHead(202, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'started' }))
  } else if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(state))
  } else {
    res.writeHead(404)
    res.end()
  }
})

server.listen(3001, '0.0.0.0', () => {
  console.log('[webhook] Listening on port 3001')
})
