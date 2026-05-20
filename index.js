const ReadyResource = require('ready-resource')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')

module.exports = class Recovery extends ReadyResource {
  constructor(opts = {}) {
    super()

    if (!opts.path) throw new Error('path is required')
    if (!opts.key) throw new Error('key is required')

    this.path = opts.path
    this.key = typeof opts.key === 'string' ? Buffer.from(opts.key, 'hex') : opts.key
    this.bootstrap = opts.bootstrap || null

    this._swarm = null
    this._store = null
    this.local = null
    this.remote = null

    this._length = opts.length
    this._blobsLength = opts.blobsLength
    this._primaryKey = opts.primaryKey
  }

  async _open() {
    const storeOpts = this._primaryKey ? { primaryKey: this._primaryKey, unsafe: true } : {}
    this._store = new Corestore(this.path, storeOpts)

    this.remote = new Hyperdrive(this._store.namespace('remote'), this.key)
    await this.remote.ready()

    this.local = new Hyperdrive(this._store.namespace('local'))
    await this.local.ready()

    this._swarm = new Hyperswarm(this.bootstrap ? { bootstrap: this.bootstrap } : {})
    this._swarm.on('connection', (conn) => this._store.replicate(conn))
    this._swarm.join(this.remote.discoveryKey, { client: true, server: false })

    await this.remote.getBlobs()
    await this.local.getBlobs()

    while (this.remote.core.length < this._length) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    while (this.remote.blobs.core.length < this._blobsLength) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }

  async _close() {
    if (this._swarm) await this._swarm.destroy()
    if (this._store) await this._store.close()
  }

  async run() {
    this.remote.db.core.download() // prefetch metadata
    this.remote.blobs.core.download() // prefetch blobs

    let metadataBlocks = 0
    while (metadataBlocks < this._length) {
      const block = await this.remote.core.get(metadataBlocks)
      await this.local.core.append(block)
      metadataBlocks++
      this.emit('metadata-sync', { block: metadataBlocks, total: this._length })
    }

    let blobsBlocks = 0
    while (blobsBlocks < this._blobsLength) {
      const block = await this.remote.blobs.core.get(blobsBlocks)
      await this.local.blobs.core.append(block)
      blobsBlocks++
      this.emit('blobs-sync', { block: blobsBlocks, total: this._blobsLength })
    }
  }
}
