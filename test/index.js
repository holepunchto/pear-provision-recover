const { test } = require('brittle')
const path = require('path')
const os = require('os')
const fs = require('fs')

const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const DHT = require('hyperdht')
const testnet = require('hyperdht/testnet')

const Recovery = require('../index.js')

test('recover replicates drive content', async (t) => {
  const bootstrap = await createTestnet(t)
  const { drive: remote } = await createRemoteDrive(t, bootstrap)
  const dir = tmpdir()

  const store = new Corestore(dir)
  const swarm = new Hyperswarm({ bootstrap })

  swarm.on('connection', (conn) => store.replicate(conn))
  swarm.join(remote.core.discoveryKey, { client: true, server: false })

  const recover = new Recovery(swarm, store, {
    path: dir,
    key: remote.key,
    bootstrap,
    length: remote.core.length,
    blobsLength: remote.blobs.core.length
  })

  await recover.ready()
  await recover.run()

  t.teardown(() => {
    recover.close()
    store.close()
    swarm.destroy()
  })

  t.not(recover.local.key, remote.key.toString('hex'), 'new key is different')
  t.is(recover.local.core.contiguousLength, remote.core.length, 'metadata blocks synced')
  t.is(recover.local.blobs.core.contiguousLength, remote.blobs.core.length, 'blobs blocks synced')
  t.is(
    (await recover.local.core.treeHash()).toString('hex'),
    (await remote.core.treeHash()).toString('hex'),
    'db treeHash matches'
  )
  t.is(
    (await recover.local.blobs.core.treeHash()).toString('hex'),
    (await remote.blobs.core.treeHash()).toString('hex'),
    'blobs treeHash matches'
  )
})

function tmpdir() {
  const dir = path.join(
    os.tmpdir(),
    'pear-recover-' + Date.now() + '-' + Math.random().toString(36).slice(2)
  )
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

async function createTestnet(t) {
  const net = await testnet(2, t)
  return net.bootstrap
}

async function createRemoteDrive(t, bootstrap) {
  const dir = tmpdir()
  const store = new Corestore(dir)
  const drive = new Hyperdrive(store)
  await drive.ready()

  await drive.put('/hello.txt', Buffer.from('hello pear'))
  await drive.put('/dir/nested.txt', Buffer.from('nested pear'))

  const swarm = new Hyperswarm({ dht: new DHT({ bootstrap }) })
  swarm.on('connection', (conn) => store.replicate(conn))
  swarm.join(drive.discoveryKey, { server: true, client: false })
  await swarm.flush()

  t.teardown(async () => {
    await swarm.destroy()
    await drive.close()
    await store.close()
  })

  return { drive, store, swarm }
}
