# CodeSync — Server

> WebSocket backend for CodeSync: real-time document sync, persistence, and sandboxed code execution.

This is the backend for [CodeSync](https://github.com/Maruthi14-gif/codesync-web), a real-time collaborative code editor. It coordinates Yjs document synchronization over WebSockets, persists rooms to disk, and forwards code execution requests to a sandboxed Piston engine.

**Frontend live demo:** https://codesync-web-lake.vercel.app

---

## Features

- **Yjs WebSocket relay** — synchronizes collaborative documents (`y-websocket`) and awareness/presence between all clients in a room.
- **Persistence** — rooms are stored with `y-leveldb`, so documents survive server restarts.
- **Code execution endpoint** — `POST /execute` forwards code to a self-hosted Piston sandbox and returns stdout/stderr (see note below).
- **Room passcodes** — optional server-side access control.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js, TypeScript |
| WebSocket / sync | `ws`, `yjs`, `y-websocket` |
| Persistence | `y-leveldb` |
| Code execution | Self-hosted [Piston](https://github.com/engineer-man/piston) (Docker) |
| Hosting | Railway |

---

## Local Setup

```bash
git clone https://github.com/Maruthi14-gif/codesync-server.git
cd codesync-server
npm install
```

Create `.env`:

```
PORT=1234
CLIENT_ORIGIN=http://localhost:3000
PISTON_URL=http://localhost:2000
```

Run the dev server:

```bash
npm run dev
```

The server starts on `:1234` (WebSocket + HTTP).

---

## Enabling Code Execution (Local)

Code execution requires a local [Piston](https://github.com/engineer-man/piston) instance running in Docker.

```bash
# Pull and run Piston
docker run -d --name piston_api --privileged -p 2000:2000 ghcr.io/engineer-man/piston

# Install the language runtimes
curl -X POST http://localhost:2000/api/v2/packages -H "Content-Type: application/json" -d '{"language":"python","version":"3.12.0"}'
curl -X POST http://localhost:2000/api/v2/packages -H "Content-Type: application/json" -d '{"language":"node","version":"20.11.1"}'
curl -X POST http://localhost:2000/api/v2/packages -H "Content-Type: application/json" -d '{"language":"gcc","version":"10.2.0"}'
```

With Piston running and `PISTON_URL` pointing at it, `POST /execute` returns real compile/run output.

---

## A Note on Production Code Execution

Piston sandboxes untrusted code using **Isolate** (Linux namespaces, cgroups, privileged operations), which requires a **writable filesystem and a privileged container**. Managed hosting platforms (Railway, etc.) run containers as read-only and unprivileged for security, so Piston fails to initialize there (`mkdir: cannot create directory 'isolate/': Read-only file system`).

The deployed backend therefore runs **collaboration and persistence only**; code execution is available when self-hosting on infrastructure with full Docker control (a VPS or local machine). The frontend degrades gracefully on the live demo, showing a friendly notice instead of an error.

---

## API

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Health check |
| `/execute` | POST | Run code via Piston. Body: `{ language, code, stdin? }` → `{ stdout, stderr, code, signal }` |

WebSocket connections are handled per-room via `y-websocket`.

---

## Related

- Frontend: [codesync-web](https://github.com/Maruthi14-gif/codesync-web)
