// Copy the WebSocket server into the build output for deployment
import fs from 'fs'
import path from 'path'

const src = path.resolve(process.cwd(), 'server/ws-server.js')
const destDir = path.resolve(process.cwd(), 'build')
const dest = path.join(destDir, 'ws-server.js')

if (!fs.existsSync(src)) {
  console.error('[bundle-ws] Source server/ws-server.js not found')
  process.exit(1)
}

fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(src, dest)
console.log('[bundle-ws] Copied ws-server.js -> build/ws-server.js')