#!/usr/bin/env node

const { command, flag, summary } = require('paparam')
const recover = require('.')

const cmd = command(
  'pear-provision-recover',
  summary('Recover a provision drive from the network'),
  flag('--path <path>', 'Corestore storage path'),
  flag('--key <key>', 'Remote production drive public key'),
  flag('--timeout <ms>', 'Peer discovery timeout in milliseconds'),
  async (cmd) => {
    const { path, key, timeout } = cmd.flags

    const r = recover({ path, key, timeout: timeout ? Number(timeout) : undefined })

    r.on('ready', ({ key, discoveryKey }) => {
      console.log('New drive key:', key)
      console.log('Discovery key:', discoveryKey)
    })

    r.on('peer-connect', () => console.log('Peer connected, starting recovery...'))

    r.on('metadata-sync', ({ block, total }) => {
      console.log(`Metadata: ${block}/${total} blocks`)
    })

    r.on('blobs-sync', ({ block, total }) => {
      console.log(`Blobs: ${block}/${total} blocks`)
    })

    try {
      const result = await r.done()
      console.log('\nRecovery complete.')
      console.log('  Key:', result.key)
      console.log('  Path:', result.path)
      console.log('  metadataBlocks:', result.metadataBlocks)
      console.log('  blobsBlocks:', result.blobsBlocks)
    } catch (err) {
      console.log('Recovery failed:', err.message)
      process.exitCode = 1
    } finally {
      await r.destroy()
    }
  }
)

cmd.parse()
