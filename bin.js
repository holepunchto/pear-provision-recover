#!/usr/bin/env node

const { command, flag, summary } = require('paparam')
const Recovery = require('.')

const cmd = command(
  'pear-provision-recover',
  summary('Recover a provision drive from the network'),
  flag('--path <path>', 'Corestore storage path'),
  flag('--key <key>', 'Remote production drive public key'),
  flag('--length <length>', 'Remote length to recover'),
  flag('--blobsLength <blobsLength>', 'Remote blobs length to recover'),
  flag('--primaryKey <primaryKey>', 'local store primary key'),
  async (cmd) => {
    const { path, key, timeout } = cmd.flags

    const recover = new Recovery({ path, key, length, blobsLength, primaryKey })
    await recover.ready()

    r.on('metadata-sync', ({ block, total }) => {
      console.log(`Metadata: ${block}/${total} blocks`)
    })

    r.on('blobs-sync', ({ block, total }) => {
      console.log(`Blobs: ${block}/${total} blocks`)
    })

    try {
      await recover.run()
      console.log('\nRecovery complete.')
      console.log('  Key:', recover.key)
      console.log('  Path:', recover.path)
      console.log('  metadataBlocks:', recover.local.core.length)
      console.log('  blobsBlocks:', recover.local.blobs.core.length)
    } catch (err) {
      console.log('Recovery failed:', err.message)
    } finally {
      await recover.close()
    }
  }
)

cmd.parse()
