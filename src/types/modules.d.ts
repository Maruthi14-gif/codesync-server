declare module 'y-websocket/bin/utils' {
  import * as Y from 'yjs';
  import { IncomingMessage } from 'http';
  import { WebSocket } from 'ws';

  export interface Persistence {
    provider: any;
    bindState: (docName: string, ydoc: Y.Doc) => Promise<void> | void;
    writeState: (docName: string, ydoc: Y.Doc) => Promise<void> | void;
  }

  export function setPersistence(persistence: Persistence | null): void;
  export function getPersistence(): Persistence | null;
  export function setupWSConnection(
    conn: WebSocket,
    req: IncomingMessage,
    options?: { docName?: string; gc?: boolean }
  ): void;

  export const docs: Map<string, any>;
}

declare module 'y-leveldb' {
  import * as Y from 'yjs';

  export class LeveldbPersistence {
    constructor(location: string);
    getYDoc(docName: string): Promise<Y.Doc>;
    storeUpdate(docName: string, update: Uint8Array): Promise<any>;
    flushDocument(docName: string): Promise<any>;
    clearDocument(docName: string): Promise<any>;
  }
}
