#!/usr/bin/env node

const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const crypto = require('hypercore-crypto')
const { decode } = require('hypercore-id-encoding')
const { command, flag, summary } = require('paparam')
const Recovery = require('.')

const cmd = command(
  'pear-provision-recover',
  summary('Recover a provision drive from the network'),
  flag('--path <path>', 'Corestore storage path'),
  flag('--key <key>', 'Remote production drive public key'),
  flag('--length <length>', 'Remote length to recover'),
  flag('--blobs-length <blobsLength>', 'Remote blobs length to recover'),
  flag('--primary-key <primaryKey>', 'local store primary key'),
  flag('--name <name>', 'local store namespace'),
  async (cmd) => {
    const { path, key, length, blobsLength, primaryKey, name } = cmd.flags

    const storeOpts = primaryKey ? { primaryKey, unsafe: true } : {}
    const store = new Corestore(path, storeOpts)
    const swarm = new Hyperswarm()
    swarm.on('connection', (conn) => store.replicate(conn))

    const discoveryKey = crypto.discoveryKey(decode(key))
    swarm.join(discoveryKey, { client: true, server: false })

    const recover = new Recovery(swarm, store, { path, key, length, blobsLength, name })
    await recover.ready()

    recover.on('metadata-sync', ({ block, total }) => {
      console.log(`Metadata: ${block}/${total} blocks`)
    })

    recover.on('blobs-sync', ({ block, total }) => {
      console.log(`Blobs: ${block}/${total} blocks`)
    })

    await recover.run()

    console.log('Recovery complete.')
    console.log('Key:', recover.local.id)
    console.log('Path:', recover.path)
    console.log('Metadata blocks:', recover.local.core.length)
    console.log('Blobs blocks:', recover.local.blobs.core.length)

    swarm.join(recover.local.discoveryKey, { client: true, server: false })

    console.log('announced:', 'pear://' + recover.local.id)
    console.log('waiting mirrors sync...')
    await recover.seed()
    console.log('synced')
  }
)

cmd.parse()
