# OmniTerm AI Development Guidelines

You are an expert AI agent working on OmniTerm. Adhere to these rules strictly:

## 1. Architecture Constraints
- **Strict Separation of Concerns:** Under no circumstances should Node.js runtime APIs (`fs`, `child_process`, `ssh2`, etc.) be imported or invoked directly inside the `src/renderer/` UI code. All network, encryption, and system storage calls must go through secure Electron IPC via `src/main/preload.ts` Context Bridge.
- **Strict TypeScript:** Set `"strict": true` in `tsconfig.json`. Every function, parameter, state, and IPC message must have defined types. Use interfaces and avoid `any` wherever possible.
- **Component Design:** React components must be functional, modular, and cleanly separated. Lift state up when necessary or use lightweight context/state managers.

## 2. UI & Styling Rules
- **No Inline Styles:** All UI elements must use Tailwind CSS utility classes.
- **Dense, Professional Design:** Optimize layout density for professional usage. Margins and padding should favor compact data presentation (similar to SecureCRT/FX).
- **Dark Mode First:** Use custom palettes with subtle borders (`border-slate-800`), deep backgrounds (`bg-slate-950`), and vibrant highlights (`text-emerald-400`, `text-amber-500`).
- **Hardware Acceleration:** Ensure `xterm.js` utilizes `@xterm/addon-webgl` for rendering. Fall back gracefully to standard canvas if WebGL is unsupported.

## 3. Dependency Management
- Only use approved dependencies defined in `package.json`. Do not install external libraries without explicit instruction.
- Core stack: `electron`, `react`, `react-dom`, `tailwind-css`, `xterm`, `ssh2`, `crypto` (native Node).

## 4. Encryption & Security
- Credentials and private keys stored locally must be encrypted using AES-256-GCM.
- Never write plain passwords or keys to disk.
- IPC handlers must sanitize input parameters.

---

## 5. ⛔ DO NOT CHANGE — Confirmed Bug Fixes (regression risk)

These rules exist because specific bugs were confirmed, diagnosed, and fixed. Reverting any of them will reintroduce a freeze, memory leak, or security hole.

### 5.1 — ssh:write must be fire-and-forget
`ssh:write` uses `ipcRenderer.send` in `preload.ts` and `ipcMain.on` in `main.ts`.  
Its return type in `types.d.ts` is `void`.  
**Never change this to `ipcRenderer.invoke` / `ipcMain.handle`.** Every keystroke calls this channel. Using `invoke` creates a pending Promise per keypress and freezes the renderer under load.

### 5.2 — Resize handler must stay debounced
`TerminalTabs.tsx` debounces `handleResize` by 100ms before calling `ssh:resize`.  
**Never call any IPC method directly inside `ResizeObserver` or `window.addEventListener('resize')` without debouncing.** The observer fires at 60fps during window drag.

### 5.3 — SSHConnectionPool.disconnect() deletes from Map first
`disconnect()` calls `this.connections.delete(connectionId)` **before** calling `.end()` on channel or client.  
**Never reorder these.** Re-entrant close events (`channel.on('close')`, `client.on('close')`) check the Map and must find it already cleared to avoid double-ending the ssh2 client.

### 5.4 — cpu-features stub must not be removed
`package.json` overrides `cpu-features` to `file:./stubs/cpu-features`.  
`stubs/cpu-features/` is a no-op stub that satisfies `ssh2`'s optional require.  
**Never delete the stub. Never remove the `overrides` entry.** Without it, `npm install` triggers `node-gyp` C++ compilation for `cpu-features`, which hangs on Node.js v26 and freezes the system for minutes.  
**Never add `omit=optional` to `.npmrc`** — it also removes `@esbuild/darwin-arm64` and `@rollup/rollup-darwin-arm64`, breaking Vite builds.

### 5.5 — ssh:connect takes a sessionId string only
`ssh:connect` receives a `sessionId: string` in `main.ts` and resolves credentials via `SessionManager` + `SecureVault`.  
**Never pass a raw config object `{ host, password, ... }` over this IPC channel.** Credentials must never cross the IPC boundary — they are resolved server-side in the main process.

---

## 6. Phase Numbering — do not renumber or rename phases

The project uses a fixed phase numbering agreed with the user. Always refer to phases by these exact names:

| Phase | Name | Status |
|---|---|---|
| Phase 0 | Scaffolding | ✅ Complete |
| Phase 1 | Live data flow | ✅ Complete |
| Phase 2 | Vault Unlock Modal | 🔲 **Current — build this next** |
| Phase 3 | Session CRUD | 🔲 Planned |
| Phase 4 | Polish | 🔲 Planned |

**Current sprint: Phase 2.**  
Read `.ai/session-handoff.md` for the full Phase 2 implementation brief before writing any code.
