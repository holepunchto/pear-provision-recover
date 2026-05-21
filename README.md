# pear-provision-recover

Recover a lost provision drive by replicating its content from the network into a new drive with a new keypair.

For the case where the original secret key is lost — the content still lives on remote peers, but nobody can write to the original drive anymore. This tool creates a new writable drive that holds a copy of the remote content.

## Requirements

An existing network of nodes must be seeding the original drive. Recovery cannot bootstrap from nothing.

## Install

```
npm install -g pear-provision-recover
```

## Usage

## CLI

```
pear-provision-recover --path <storage> --key <key> --length <n> --blobs-length <n> --primary-key <primary-key> --name <name>
```

### Flags

| Flag                 | Description                              |
| -------------------- | ---------------------------------------- |
| `--path <path>`      | Corestore storage path                   |
| `--key <key>`        | Remote provision drive public key        |
| `--length <n>`       | Number of metadata blocks to recover     |
| `--blobs-length <n>` | Number of blob blocks to recover         |
| `--primaryKey <key>` | Local store primary key (optional)       |
| `--name <name>`      | Local store namespace (default: `local`) |

## API

```js
const Recovery = require('pear-provision-recover')
```

### `const recover = new Recovery(swarm, store, opts)`

Create a recovery instance.

- `swarm` — a Hyperswarm instance used for replication
- `store` — a Corestore instance for local storage
- `opts.key` — remote drive public key (string or buffer, required)
- `opts.length` — number of remote metadata blocks to download
- `opts.blobsLength` — number of remote blob blocks to download
- `opts.name` — local drive namespace (default: `local`)

### `await recover.ready()`

Opens the remote and local Hyperdrives and waits until the remote has at least `length` metadata blocks and `blobsLength` blob blocks available. Throws if the local storage has already been written to.

### `await recover.run()`

Downloads all metadata and blob blocks from the remote drive and appends them to the local drive. Emits progress events during the transfer:

- `metadata-sync` — `{ block, total }` after each metadata block
- `blobs-sync` — `{ block, total }` after each blob block

### `await recover.seed()`

Waits until remote peers have downloaded the full contents of the local drive (both metadata and blobs).

### `await recover.close()`

Destroys the swarm and closes the store.

## License

Apache-2.0
