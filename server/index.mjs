import { createApp } from './app.mjs'
const port = Number(process.env.PORT || 8787), host = process.env.HOST || '127.0.0.1'
const server = createApp().listen(port, host, () => console.log(`UGC Flow server: http://${host}:${port}`))
server.on('error', (error) => {
  console.error(`UGC Flow failed to listen on ${host}:${port}: ${error.message}`)
  process.exitCode = 1
})
server.ref()
const keepAlive = setInterval(() => {}, 2_147_000_000)
function shutdown() { clearInterval(keepAlive); server.close() }
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
