const { test } = require('brittle')
const path = require('path')
const os = require('os')
const fs = require('fs')

const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const DHT = require('hyperdht')
const testnet = require('hyperdht/testnet')

const recover = require('../index.js')

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

test('recover throws if path is missing', async (t) => {
  t.exception(() => recover({ key: 'a'.repeat(64) }), /path is required/)
})

test('recover throws if key is missing', async (t) => {
  t.exception(() => recover({ path: tmpdir() }), /key is required/)
})

test('recover replicates drive content', async (t) => {
  const bootstrap = await createTestnet(t)
  const { drive: remote } = await createRemoteDrive(t, bootstrap)
  const dir = tmpdir()

  const r = recover({
    path: dir,
    key: remote.key,
    bootstrap
  })

  const result = await r.done()
  await r.destroy()

  t.not(result.key, remote.key.toString('hex'), 'new key is different')
  t.ok(result.metadataBlocks > 0, 'metadata blocks synced')
  t.ok(result.blobsBlocks > 0, 'blobs blocks synced')

  const store = new Corestore(dir)
  const recovered = new Hyperdrive(store, Buffer.from(result.key, 'hex'))
  await recovered.ready()

  const hello = await recovered.get('/hello.txt')
  t.ok(hello, 'hello.txt exists')
  t.is(hello && hello.toString(), 'hello pear', 'file content matches')

  const nested = await recovered.get('/dir/nested.txt')
  t.ok(nested, 'nested.txt esists')
  t.is(nested && nested.toString(), 'nested pear', 'nested file content matches')

  await recovered.close()
  await store.close()
})

test('recover emits ready event', async (t) => {
  t.plan(2)
  const bootstrap = await createTestnet(t)
  const { drive: remote } = await createRemoteDrive(t, bootstrap)
  const dir = tmpdir()

  const r = recover({
    path: dir,
    key: remote.key,
    bootstrap
  })

  r.on('ready', ({ key, discoveryKey }) => {
    t.ok(key, 'ready event has key')
    t.ok(discoveryKey, 'ready event has discoveryKey')
  })

  await r.done()
  await r.destroy()
})

test('recover errors on no peers', async (t) => {
  const bootstrap = await createTestnet(t)
  const fakeKey = 'b'.repeat(64)
  const dir = tmpdir()

  const r = recover({
    path: dir,
    key: fakeKey,
    timeout: 2000,
    bootstrap
  })

  await t.exception(async () => r.done(), /no peers/)
  await r.destroy()
})
