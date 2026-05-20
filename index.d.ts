declare module 'pear-provision-recover' {
  import { EventEmitter } from 'events'

  interface RecoveryOptions {
    path: string
    key: string | Buffer
    timeout?: number
    bootstrap?: Array<{ host: string; port: number }>
  }

  interface ReadyEvent {
    key: string
    discoveryKey: string
  }

  interface SyncEvent {
    block: number
    total: number
  }

  interface DoneEvent {
    key: string
    path: string
    metadataBlocks: number
    blobsBlocks: number
  }

  class Recovery extends EventEmitter {
    path: string
    key: Buffer
    timeout: number
    bootstrap: Array<{ host: string; port: number }> | null

    done(): Promise<DoneEvent>
    destroy(): Promise<void>

    on(event: 'ready', listener: (info: ReadyEvent) => void): this
    on(event: 'peer-connect', listener: (info: { peer: any }) => void): this
    on(event: 'metadata-sync', listener: (info: SyncEvent) => void): this
    on(event: 'blobs-sync', listener: (info: SyncEvent) => void): this
    on(event: 'done', listener: (info: DoneEvent) => void): this
    on(event: 'error', listener: (err: Error) => void): this
  }

  function recover(opts: RecoveryOptions): Recovery

  export = recover
}
