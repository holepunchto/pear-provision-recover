const ReadyResource = require('ready-resource')
const Hyperdrive = require('hyperdrive')
const { decode } = require('hypercore-id-encoding')

module.exports = class Recovery extends ReadyResource {
  constructor(swarm, store, opts = {}) {
    super()

    if (!opts.key) throw new Error('key is required')

    this.key = typeof opts.key === 'string' ? decode(opts.key) : opts.key
    this.bootstrap = opts.bootstrap || null

    this._swarm = swarm
    this._store = store
    this.local = null
    this.remote = null

    this._length = opts.length
    this._blobsLength = opts.blobsLength
    this._primaryKey = opts.primaryKey
    this._name = opts.name || 'local'
  }

  async _open() {
    this.remote = new Hyperdrive(this._store.namespace('remote'), this.key)
    await this.remote.ready()

    this.local = new Hyperdrive(this._store.namespace(this._name))
    await this.local.ready()

    await this.remote.getBlobs()
    await this.local.getBlobs()

    if (this.local.db.core.contiguousLength > 0) throw new Error('Local storage already written')

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

  async seed() {
    while (this.local.db.core.remoteContiguousLength < this.local.db.core.length) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    while (this.local.blobs.core.remoteContiguousLength < this.local.blobs.core.length) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }
}
