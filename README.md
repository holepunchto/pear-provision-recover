# pear-provision-recover

Recover a lost provision drive by replicating its content from the network into a new drive with a new keypair.

For the case where the original secret key is lost — the content still lives on remote peers, but nobody can write to the original drive anymore. This tool creates a new writable drive that holds a copy of the remote content.

## Requirements

An existing network of nodes must be seeding the original drive. Recovery cannot bootstrap from nothing.

## Install

```
npm install pear-provision-recover
```

## Usage

### CLI

```
pear-provision-recover --path /path/to/corestore --key <prod-public-key>
```

Flags:

- `--path <path>` — Corestore storage path
- `--key <key>` — Remote production drive public key (hex)
- `--timeout <ms>` — Peer discovery timeout in milliseconds (default: 30000)

### Programmatic

```js
const recover = require('pear-provision-recover')

const r = recover({
  path: '/path/to/corestore',
  key: '<prod-public-key>',
  timeout: 30000
})

r.on('ready', ({ key, discoveryKey }) => {
  /* new drive created */
})
r.on('peer-connect', ({ peer }) => {
  /* first peer found */
})
r.on('metadata-sync', ({ block, total }) => {
  /* metadata block copied */
})
r.on('blobs-sync', ({ block, total }) => {
  /* blob block copied */
})

const result = await r.done()
// { key, path, metadataBlocks, blobsBlocks }

await r.destroy()
```

## How it works

1. Opens a Corestore at the given path
2. Creates a new writable Hyperdrive (new keypair)
3. Joins the swarm to discover peers seeding the remote drive
4. Copies metadata core blocks sequentially
5. Copies blobs core blocks sequentially
6. Emits the new key and block counts

The recovered drive has a new public key and is independently writable. Any downstream references to the old key must be updated.

## License

Apache-2.0
