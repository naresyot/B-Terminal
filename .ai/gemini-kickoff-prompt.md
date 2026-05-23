# Gemini Kickoff Prompt
Copy everything between the triple dashes and paste it as your first message.

---

You are continuing development on **OmniTerm** — a professional Electron + React + TypeScript SSH terminal emulator. This project was partially built in a previous session. You must read the project state before writing any code.

## Step 1 — Read these files first (mandatory before touching any code)

1. `.ai/system-prompt.md` — architecture rules and DO NOT CHANGE bug fixes
2. `.ai/session-handoff.md` — full briefing: what is done, what to build, what is blocked
3. `.ai/handoff-state.json` — machine-readable phase status and known gaps

## Step 2 — Project context (summary)

**Stack:** Electron 30 · React 19 · TypeScript · xterm.js (WebGL) · ssh2 · Tailwind CSS  
**Repo:** https://github.com/naresyot/B-Terminal.git  
**Node version:** v26.0.0  
**Dev command:** `npm run dev` (starts Vite + tsc -w + Electron together via concurrently)

## Step 3 — Phase roadmap (use these exact numbers, never renumber)

| Phase | Name | Status |
|---|---|---|
| Phase 0 | Scaffolding | ✅ Complete |
| Phase 1 | Live data flow | ✅ Complete |
| **Phase 2** | **Vault Unlock Modal** | 🔲 **Build this now** |
| Phase 3 | Session CRUD — SessionFormModal | 🔲 Planned |
| Phase 4 | Polish | 🔲 Planned |

## Step 4 — Your task: Phase 2 — Vault Unlock Modal

**Why it matters:** The SecureVault (AES-256-GCM credential store) exists and is wired in the main process but has no UI entry point. Until it is unlocked, SSH sessions cannot retrieve stored passwords or key passphrases — auth will always fail.

**Create this file:**

`src/renderer/components/VaultUnlockModal.tsx`
- Modal shown on app startup when vault is locked
- Single master password input (`type="password"`)
- On submit: call `window.electron.vault.unlock(password, savedSaltHex)`
  - `savedSaltHex` = `localStorage.getItem('vault_salt')` (may be null on first run → pass undefined)
  - On success: `localStorage.setItem('vault_salt', returnedSaltHex)` then close modal
  - On failure: show inline error "Incorrect password — try again"
- "Skip" button that closes modal without unlocking (SSH auth will fail for password sessions)
- Design: dark slate, matches existing UI (`bg-slate-900`, `border-slate-700`, `text-emerald-400` accents)

**Modify this file:**

`src/renderer/index.tsx`
- On mount: call `window.electron.vault.isUnlocked()` → if false, show `VaultUnlockModal`
- Add `vaultUnlocked: boolean` state, set to true after successful unlock
- Replace static header badge with reactive one:
  - Locked → amber `Shield` icon + "Vault Locked"
  - Unlocked → emerald `Shield` icon + "Vault Unlocked"

**IPC already registered in `src/main/main.ts` — do NOT re-register:**
```
vault:unlock    → SecureVault.getInstance().unlock(password, saltHex)
vault:lock      → SecureVault.getInstance().lock()
vault:isUnlocked → SecureVault.getInstance().isUnlocked()
```

## Step 5 — CRITICAL rules (bugs already fixed — never revert)

These bugs were confirmed, diagnosed, and fixed. The code looks intentional. Do not "clean it up."

**Rule 1 — ssh:write is fire-and-forget**
`preload.ts` uses `ipcRenderer.send` for `ssh:write`. `main.ts` uses `ipcMain.on`.
Return type in `types.d.ts` is `void`.
NEVER change to `invoke/handle` — every keystroke calls this. `invoke` creates one Promise per keypress and freezes the renderer under load.

**Rule 2 — Resize handler is debounced**
`TerminalTabs.tsx` wraps `handleResize` in a 100ms `setTimeout`.
NEVER call IPC directly inside `ResizeObserver` without debouncing — fires at 60fps during window drag.

**Rule 3 — SSHConnectionPool.disconnect() deletes from Map first**
`disconnect()` calls `this.connections.delete(connectionId)` BEFORE `.end()`.
NEVER reorder this. Re-entrant `close` events check the Map and must find it cleared to avoid double-ending the ssh2 client and leaking handles.

**Rule 4 — cpu-features stub must stay**
`package.json` has `"overrides": { "cpu-features": "file:./stubs/cpu-features" }`.
`stubs/cpu-features/` is a no-op stub. Do NOT delete it. Do NOT remove the override.
Without it, `npm install` runs `node-gyp` C++ compilation that hangs for minutes on Node v26.
Do NOT add `omit=optional` to `.npmrc` — it breaks Vite by removing `@esbuild/darwin-arm64`.

**Rule 5 — ssh:connect takes a sessionId string only**
`main.ts` `ssh:connect` handler receives a string and resolves config via `SessionManager` + `SecureVault`.
NEVER pass `{ host, password, ... }` over IPC. Credentials must never cross the IPC boundary.

## Step 6 — Architecture invariants

- Renderer NEVER imports Node.js APIs (`fs`, `ssh2`, `crypto`, `child_process`). Main process only.
- All system calls go through `preload.ts` contextBridge. No `nodeIntegration`, no `remote`.
- Strict TypeScript. No `any` on IPC boundaries. No `@ts-ignore`.
- All UI uses Tailwind utility classes. No inline styles.

## Step 7 — Full source file map

```
src/
├── main/
│   ├── main.ts                    ← IPC handlers, BrowserWindow, app lifecycle
│   ├── preload.ts                 ← contextBridge API (ssh, sftp, vault, sessions)
│   └── services/
│       ├── SSHConnectionPool.ts   ← singleton; manages active ssh2 clients + SFTP
│       ├── SecureVault.ts         ← AES-256-GCM encrypted credential store
│       └── SessionManager.ts     ← session tree CRUD, config inheritance, jump host resolution
└── renderer/
    ├── index.tsx                  ← App root; tab/connection lifecycle; IPC orchestration
    ├── index.css                  ← Tailwind directives + xterm.js overrides
    ├── types.d.ts                 ← Global Window.electron type declarations
    └── components/
        ├── SessionTree.tsx        ← IPC-backed session browser (loads from sessions:getNodes)
        ├── TerminalTabs.tsx       ← xterm.js multi-tab terminal; WebGL; onData/onError subs
        └── ButtonBar.tsx          ← SSH macro command buttons (clear, df, top, tail, ss)
```

New file to create in this phase: `src/renderer/components/VaultUnlockModal.tsx`

---
