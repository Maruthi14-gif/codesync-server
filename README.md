# codesync-server

> Real-time collaborative WebSocket synchronization and LevelDB persistence server for CodeSync.

---

## Tech Stack

| Technology | Purpose |
| :--- | :--- |
| **Node.js + TypeScript** | Core backend server runtime and compilation |
| **ws** | High-performance WebSocket server for collaborative transport |
| **tsx** | Fast dev server and execution of TypeScript directly |
| **Yjs** | CRDT collaborative document framework |
| **y-websocket** | Synchronization protocol adapter for WebSockets |
| **y-leveldb** | Local LevelDB persistence adapter for Yjs documents |
| **dotenv** | Environment configuration management |

---

## Local Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Copy the example template and set your values:
   ```bash
   cp .env.example .env
   ```

3. **Start Development Server:**
   ```bash
   npm run dev
   ```

4. **Build Production Bundle:**
   ```bash
   npm run build
   ```

---

## Environment Variables

| Variable | Description | Default | Required |
| :--- | :--- | :--- | :--- |
| `PORT` | The network port the HTTP and WebSocket server listens on. | `1234` | No |

---

## How It Works

### Yjs CRDT Sync
The server acts as a central authority for Yjs CRDT (Conflict-free Replicated Data Type) updates. When clients connect, they exchange state vectors over WebSocket. The server applies incoming client updates to in-memory Yjs documents (`Y.Doc`) and broadcasts them to other connected peers in the same room.

### LevelDB Persistence
To prevent data loss when all users disconnect, the server uses `y-leveldb` persistence. When a document is first opened, the server loads its historical updates from LevelDB. As clients make edits, incremental Yjs updates are saved to the LevelDB store on every transaction.

### Multi-surface Document Structure
The server manages a single `Y.Doc` per room which contains multiple separate shared types:
- `codemirror`: A `Y.Text` type that holds the collaborative code editor text.
- `notepad`: A `Y.Text` type that holds the scratchpad/notes content.

These are independent surfaces that sync independently but reside inside the same unified document structure.

---

## Demo & Live URL

- **Live URL:** *[Insert Live URL Here]*
- **Demo Preview:**  
  ![Demo GIF Placeholder](https://via.placeholder.com/800x450.gif?text=Demo+GIF+Placeholder)
