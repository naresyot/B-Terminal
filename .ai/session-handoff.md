# OmniTerm — Session Handoff
**Last updated:** 2026-05-23  
**Outgoing agent:** Claude Sonnet 4.6  
**Incoming agent:** Antigravity-2.0 (Gemini)

---

## ✅ Phase Roadmap — use these numbers, do not renumber

| Phase | Name | Status |
|---|---|---|
| **Phase 0** | Scaffolding — all source files, Electron config, Vite, Tailwind, TypeScript | ✅ Complete |
| **Phase 1** | Live data flow — SessionTree IPC-wired, ssh:connect uses sessionId, onError wired | ✅ Complete |
| **Phase 2** | Vault Unlock Modal — master password UI, SecureVault unlocked at startup | 🔲 **BUILD THIS NEXT** |
| **Phase 3** | Session CRUD — SessionFormModal, full add/edit form with credentials | 🔲 Planned |
| **Phase 4** | Polish — real terminal size at connect, SFTP panel, right-click context menu | 🔲 Planned |

**You are starting Phase 2.** Do not call it Phase 1 or any other number.

---

## What was accomplished this session

### Phase 0 (pre-existing) — Scaffolding complete
All source files exist and compile. See `handoff-state.json` for full file list.

### Bug Fixes Applied (DO NOT REVERT)
Five confirmed bugs were found and fixed. Each has a rule below explaining why the fix must stay.

### Phase 1 — Live data flow wired
The renderer and main process now share a real data path. Mock data and placeholder credentials are gone.

---

## Current application state

```
Renderer ──IPC──▶ Main Process
   │                   │
SessionTree         SessionManager (reads/writes sessions.json)
   │   loads from→ sessions:getNodes
   │   adds via  → sessions:addNode
   │   deletes   → sessions:deleteNode
   │
handleConnect(session.id)
   └──────────→ ssh:connect(sessionId)
                   └── SessionManager.resolveConnectionConfig(sessionId)
                           └── SecureVault.getCredential(sessionId)  ← LOCKED (Phase 2)
                                   └── SSHConnectionPool.createConnection(config)
```

**What works today:**
- Session tree loads from disk (sessions.json) via IPC
- Add/delete sessions persist to disk
- Clicking a session fires the full connection path through SessionManager
- xterm.js terminals render SSH output, handle input, resize
- SSH errors surface to the tab UI (no longer silently dropped)

**What is BLOCKED until Phase 2:**
- Real SSH authentication — SecureVault is locked at startup. `resolveConnectionConfig` returns no password/passphrase. SSH sessions will fail at auth unless the server allows unauthenticated or key-with-no-passphrase connections.

---

## Phase 2 — What to build next

**Goal:** Vault Unlock Modal — users enter a master password to unlock SecureVault so credentials are available at SSH connect time.

### Files to create
**`src/renderer/components/VaultUnlockModal.tsx`**
- Shown on app startup if vault is locked (`window.electron.vault.isUnlocked()` returns false)
- Input: master password (type="password")
- On submit: call `window.electron.vault.unlock(password, savedSaltHex)`
  - `savedSaltHex` comes from `localStorage.getItem('vault_salt')` (may be undefined on first run)
  - On success: store returned `saltHex` → `localStorage.setItem('vault_salt', saltHex)`, close modal
  - On failure: show error "Incorrect password"
- Has a "Skip" option that leaves vault locked (connection attempts with credentials will fail gracefully)
- Dark slate design matching existing UI

### Files to modify
**`src/renderer/index.tsx`**
- On mount: call `window.electron.vault.isUnlocked()`, show `VaultUnlockModal` if false
- After unlock: update a `vaultUnlocked` state boolean
- Pass `vaultUnlocked` to header so the static "Vault Encrypted" badge becomes reactive:
  - Locked: amber shield + "Vault Locked"
  - Unlocked: emerald shield + "Vault Unlocked"

### IPC already wired in main.ts — do not re-register:
```typescript
ipcMain.handle('vault:unlock', ...)   // already registered
ipcMain.handle('vault:lock', ...)     // already registered
ipcMain.handle('vault:isUnlocked', ...) // already registered
```

---

## Phase 3 — After Phase 2

**Goal:** Session CRUD — replace placeholder "New Session" with a proper form.

**File to create:** `src/renderer/components/SessionFormModal.tsx`
- Fields: name, host, port (default 22), username, auth method (password / publicKey), private key path, jump host selector (dropdown of existing sessions), password or passphrase input
- On save: `window.electron.sessions.addNode(node)` + `window.electron.vault.setCredential(node.id, secret)`
- On edit: `window.electron.sessions.updateNode(id, fields)` + vault update
- On delete: already works from tree (delete button)

**File to modify:** `src/renderer/components/SessionTree.tsx`
- Replace `handleAddSession` (which creates a placeholder) with opening `SessionFormModal`
- Add edit button alongside delete button on each session row

---

## ⛔ CRITICAL: Bugs fixed this session — NEVER reintroduce these

### BUG 1 — `ssh:write` must be fire-and-forget (FREEZE risk)

**The problem:** `ssh:write` was using `ipcRenderer.invoke` (request-response). Every keystroke created a pending Promise. Pasting text or fast typing produced hundreds of unresolved Promises, freezing the Electron renderer.

**The fix:**
- `src/main/preload.ts`: `write` uses `ipcRenderer.send`
- `src/main/main.ts`: handler uses `ipcMain.on` (not `ipcMain.handle`)
- `src/renderer/types.d.ts`: `write` return type is `void`

**Rule:** `ssh:write` is one-way. It must NEVER be changed to `invoke`. There is no return value needed for keystroke data.

---

### BUG 2 — Resize handler must be debounced (FREEZE risk)

**The problem:** `ResizeObserver` and `window.resize` both fired `ssh:resize` on every pixel of window drag — up to 60 calls/sec — each as an `invoke` Promise.

**The fix:** `src/renderer/components/TerminalTabs.tsx` — `handleResize` is wrapped in a 100ms `setTimeout` debounce.

**Rule:** Never remove the debounce from the resize handler. Never call any IPC method directly from `ResizeObserver` without debouncing.

---

### BUG 3 — SSHConnectionPool double-disconnect (MEMORY LEAK risk)

**The problem:** `disconnect()` called `shellChannel.end()` which triggered `channel.on('close')` which called `client.end()`. Then `disconnect()` also called `client.end()` — two `end()` calls on the same client. This produced orphaned ssh2 handles per closed tab.

**The fix:** `src/main/services/SSHConnectionPool.ts`
- `disconnect()` deletes from the Map **first**, then ends channel/client
- `channel.on('close')` checks `this.connections.has(connectionId)` before acting
- `client.on('close')` only calls `this.connections.delete()` as a safety net

**Rule:** In `SSHConnectionPool`, always delete from the connections Map before calling `.end()`. Re-entrant close handlers must be no-ops.

---

### BUG 4 — `cpu-features` native compilation (FREEZE on npm install)

**The problem:** `ssh2` has an optional dependency `cpu-features` that runs `node-gyp rebuild` during `npm install`, compiling C++ code. On Node.js v26, no prebuilt binary exists, so it always compiles from source. This freezes the system for 30–120 seconds during every install.

**The fix:**
- `stubs/cpu-features/index.js` — a no-op stub: `module.exports = function() { return {}; }`
- `stubs/cpu-features/package.json` — minimal package metadata
- `package.json` `overrides` field: `"cpu-features": "file:./stubs/cpu-features"`

`ssh2` handles `{}` gracefully — falls back to pure-JS crypto. SSH sessions work correctly.

**Rule:**
1. Never delete `stubs/cpu-features/`
2. Never remove `"overrides": { "cpu-features": "file:./stubs/cpu-features" }` from `package.json`
3. Never use `omit=optional` in `.npmrc` — it also removes `@esbuild/darwin-arm64` and `@rollup/rollup-darwin-arm64` which Vite requires to build

---

### BUG 5 — `ssh:connect` IPC signature mismatch (SILENT FAILURE risk)

**The problem:** `main.ts` expects `ssh:connect` to receive a `sessionId: string` and resolves config via `SessionManager`. The renderer was passing a raw config object `{ host, port, username, password, ... }`. This bypassed SessionManager entirely and passed plaintext credentials over IPC.

**The fix:**
- `src/main/preload.ts`: `connect: (sessionId: string) => ipcRenderer.invoke('ssh:connect', sessionId)`
- `src/renderer/index.tsx`: `handleConnect` passes `session.id` (string)

**Rule:** `ssh:connect` takes a `sessionId` string only. Credentials NEVER travel over IPC. They are resolved server-side by `SessionManager` + `SecureVault`. If you are ever tempted to pass `{ host, password, ... }` over IPC, stop — that breaks the security model.

---

## Architecture invariants (always enforced)

These are in `system-prompt.md` and must never be violated:

1. **Renderer never imports Node.js APIs.** `fs`, `child_process`, `ssh2`, `crypto` — main process only.
2. **All system calls go through contextBridge** (`preload.ts`). No `remote`, no `nodeIntegration`.
3. **Credentials never cross IPC.** Only a `sessionId` string goes renderer → main. Secrets stay in main process memory (SecureVault).
4. **Strict TypeScript** — no `any` on IPC boundaries, no `@ts-ignore`.

---

## File map (all source files)

```
src/
├── main/
│   ├── main.ts                    ← IPC handlers, BrowserWindow, app lifecycle
│   ├── preload.ts                 ← contextBridge API surface
│   └── services/
│       ├── SSHConnectionPool.ts   ← singleton; manages active ssh2 clients
│       ├── SecureVault.ts         ← AES-256-GCM credential store
│       └── SessionManager.ts     ← session tree CRUD + config inheritance
└── renderer/
    ├── index.tsx                  ← App root; tab lifecycle; IPC orchestration
    ├── index.css                  ← Tailwind + xterm overrides
    ├── types.d.ts                 ← Global Window.electron type declarations
    └── components/
        ├── SessionTree.tsx        ← IPC-backed session browser; add/delete
        ├── TerminalTabs.tsx       ← xterm.js tabs; WebGL; IPC data/error subs
        └── ButtonBar.tsx          ← SSH macro command buttons
```

**Files to create in Phase 2:**
- `src/renderer/components/VaultUnlockModal.tsx`

**Files to create in Phase 3:**
- `src/renderer/components/SessionFormModal.tsx`

---

## Quick reference — IPC channel map

| Channel | Direction | Type | Purpose |
|---|---|---|---|
| `ssh:connect` | renderer→main | invoke | Start SSH session; returns `connectionId` |
| `ssh:write` | renderer→main | **send** (one-way) | Keystroke/paste data |
| `ssh:resize` | renderer→main | invoke | PTY window resize |
| `ssh:disconnect` | renderer→main | invoke | Close SSH session |
| `ssh:data:{id}` | main→renderer | send | Incoming terminal data |
| `ssh:error:{id}` | main→renderer | send | SSH error after connect |
| `sftp:list` | renderer→main | invoke | List remote directory |
| `vault:unlock` | renderer→main | invoke | Unlock vault with master password |
| `vault:lock` | renderer→main | invoke | Lock vault, clear key from memory |
| `vault:isUnlocked` | renderer→main | invoke | Check vault state |
| `vault:setCredential` | renderer→main | invoke | Store encrypted credential |
| `vault:deleteCredential` | renderer→main | invoke | Remove credential |
| `sessions:getNodes` | renderer→main | invoke | Fetch all session nodes |
| `sessions:addNode` | renderer→main | invoke | Persist new node |
| `sessions:updateNode` | renderer→main | invoke | Update node fields |
| `sessions:deleteNode` | renderer→main | invoke | Delete node + credentials |
