'use strict'
const http = require('http')
const { spawn } = require('child_process')

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/rebuild') {
    console.log('[webhook] Rebuild triggered')
    const child = spawn('sh', ['/docker/rebuild.sh'], {
      detached: true,
      stdio:    'ignore',
      env:      process.env,
    })
    child.unref()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'started' }))
  } else {
    res.writeHead(404)
    res.end()
  }
})

server.listen(3001, '0.0.0.0', () => {
  console.log('[webhook] Listening on port 3001')
})
