const EventEmitter = require('events')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')

class Recovery extends EventEmitter {
  constructor(opts = {}) {
    super()

    if (!opts.path) throw new Error('path is required')
    if (!opts.key) throw new Error('key is required')

    this.path = opts.path
    this.key = typeof opts.key === 'string' ? Buffer.from(opts.key, 'hex') : opts.key
    this.timeout = opts.timeout || 30000
    this.bootstrap = opts.bootstrap || null

    this._done = null
    this._store = null
    this._swarm = null

    this._run()
  }

  done() {
    if (!this._done) this._done = this._promise()
    return this._done
  }

  async destroy() {
    if (this._swarm) await this._swarm.destroy()
    if (this._store) await this._store.close()
  }

  async _promise() {
    return new Promise((resolve, reject) => {
      this.on('done', resolve)
      this.on('error', reject)
    })
  }

  async _run() {
    try {
      this._store = new Corestore(this.path)

      const remote = new Hyperdrive(this._store.namespace('remote'), this.key)
      await remote.ready()

      const local = new Hyperdrive(this._store.namespace('local'))
      await local.ready()

      this._swarm = new Hyperswarm(this.bootstrap ? { bootstrap: this.bootstrap } : {})
      this._swarm.on('connection', (conn) => this._store.replicate(conn))

      this.emit('ready', {
        key: local.key.toString('hex'),
        discoveryKey: local.discoveryKey.toString('hex')
      })

      this._swarm.join(remote.discoveryKey, { client: true, server: false })

      const peer = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('no peers found')), this.timeout)
        this._swarm.on('connection', (conn) => {
          clearTimeout(timer)
          resolve(conn)
        })
      })

      this.emit('peer-connect', { peer })

      if (remote.core.length === 0) await remote.core.update()
      if (remote.core.length === 0) {
        await new Promise((resolve) => remote.core.once('append', resolve))
      }
      if (remote.core.length === 0) throw new Error('remote drive is empty')

      let metadataBlocks = 0
      while (local.core.length < remote.core.length) {
        const block = await remote.core.get(local.core.length)
        await local.core.append(block)
        metadataBlocks++
        this.emit('metadata-sync', { block: metadataBlocks, total: remote.core.length })
      }

      const remoteBlobs = await remote.getBlobs()
      const localBlobs = await local.getBlobs()

      if (remoteBlobs.core.length === 0) await remoteBlobs.core.update()
      if (remoteBlobs.core.length > 0) remoteBlobs.core.download()

      let blobsBlocks = 0
      while (localBlobs.core.length < remoteBlobs.core.length) {
        const block = await remoteBlobs.core.get(localBlobs.core.length)
        await localBlobs.core.append(block)
        blobsBlocks++
        this.emit('blobs-sync', { block: blobsBlocks, total: remoteBlobs.core.length })
      }

      this.emit('done', {
        key: local.key.toString('hex'),
        path: this.path,
        metadataBlocks,
        blobsBlocks
      })
    } catch (err) {
      this.emit('error', err)
    }
  }
}

module.exports = function recover(opts) {
  return new Recovery(opts)
}
