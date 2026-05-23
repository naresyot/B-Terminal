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
| Phase 2 | Vault Unlock Modal | ✅ Complete |
| Phase 3 | Session CRUD | ✅ Complete |
| Phase 4 | Polish | ✅ Complete |

All planned phases are complete. New work is post-roadmap (e.g. file transfer ops, multi-window, themes). Add a new phase row above only after the user signs off on its scope.

Read `.ai/handoff-state.json` for current sprint, completed phases, and known gaps. Read `.ai/session-handoff.md` for the architectural narrative.

---

## 7. Cross-platform support — Windows + macOS

OmniTerm targets both **Windows** and **macOS**. Every change must work on both. The user is currently on macOS; that is *not* a license to write macOS-only code.

**Concrete rules:**
- **Paths:** use `path.join` / `path.sep` — never hardcode `/` or `\`. Use `os.homedir()`, never `~`.
- **Shell-out / spawn:** if you need a child process, prefer Node APIs (`fs`, `crypto`, `ssh2`) over shelling out. If a shell call is unavoidable, use `child_process.spawn` with an array argv (not a shell string) and check `process.platform`.
- **Line endings:** never assume `\n`. Use `os.EOL` for files the user will open; keep `\n` only for SSH protocol payloads where the wire format demands it.
- **Window chrome:** `titleBarStyle: 'hiddenInset'` is mac-only. Wrap any platform-specific `BrowserWindow` options in a `process.platform === 'darwin'` check with a sensible Windows fallback.
- **Keyboard shortcuts:** Cmd on mac, Ctrl on Windows. Use Electron's `CommandOrControl` accelerator or branch on `process.platform`.
- **Native modules:** anything that pulls `node-gyp` must have a prebuilt for both arm64/x64 macOS and x64 Windows, or be stubbed (see `cpu-features` stub).
- **Default paths in UI:** `~/.ssh/id_rsa` is fine as a placeholder string in form inputs (it renders the same), but never hardcode it as a resolved filesystem path in main-process code.
- **Tests / verification:** when you make a change that touches files, paths, child processes, or window options, explicitly note which behavior changes (or doesn't) on Windows in the PR description.

If something only works on macOS and there's no Windows path, stop and flag it — don't ship.

---

## 8. Version control workflow — push every meaningful change

OmniTerm uses GitHub as the source of truth. Treat every meaningful change as something the next session (or another AI agent) needs to see on `origin`.

**The workflow, every time:**
1. **Work on a branch**, never directly on `main`. Branch naming: `feat/<short-slug>`, `fix/<short-slug>`, `chore/<short-slug>`, `docs/<short-slug>`.
2. **Commit before context grows stale.** A logical chunk = a commit. Don't accumulate ten phases of work uncommitted.
3. **Push to origin after every commit** (`git push` — or `-u` on first push of a branch). The remote is the handoff.
4. **Open a PR** when the branch represents a complete unit of work. Include a Summary + Test plan. Reference the phase number if applicable.
5. **Never push directly to main** without the user's explicit go-ahead. Never `--force` push to main under any circumstances.
6. **Confirm before destructive ops** (`reset --hard`, `push --force`, deleting branches). Hard-to-reverse work belongs behind a confirmation.

**Branch hygiene:**
- One PR = one logical unit. Don't mix unrelated work (e.g. don't bundle feature code into a `docs/*` branch).
- Update `.ai/handoff-state.json` in the same commit/PR that changes phase status — so the index never lies.

**Skip commits only when:** the change is genuinely throwaway (scratch experiments under `scratch/`, which is intentionally gitignored / untracked).

---

## 9. Handoff maintenance — keep the knowledge base current

Any AI agent should be able to walk into this repo cold and resume work. That only stays true if these files stay accurate:

| File | What it captures | Update trigger |
|---|---|---|
| `.ai/handoff-state.json` | machine-readable phase status, current sprint, completed phases (with file lists), known gaps, bug-fix index | every phase status change, every resolved gap, every new file in `completed_files`, every new bug-fix rule |
| `.ai/system-prompt.md` | architectural invariants and DO NOT CHANGE bug-fix rules with rationale | when you discover a new invariant, or when a bug-fix rule needs to survive across sessions |
| `.ai/session-handoff.md` | architectural narrative, current app-state diagram, IPC channel map | when IPC shape changes, when a major component is added, when the architecture diagram becomes stale |
| `.ai/knowledge-base.md` | data schemas, type contracts (SessionNode, vault format, SFTP shape) | when an IPC payload or persisted JSON schema changes |

**Rules:**
- **Update in the same commit as the code change.** Don't push code and leave docs lagging.
- **Record the *why*, not just the *what*.** Future agents need motivation to judge edge cases — a rule without rationale gets reverted.
- **Convert relative dates to absolute** ("Thursday" → "2026-03-05") so the file is interpretable a month later.
- **If you fix a confirmed bug**, add a numbered rule to `.ai/system-prompt.md` § 5 with: symptom, root cause, fix, and a "Never do X" statement. Reverting these is how regressions ship.
- **`scratch/` is for ephemera only.** Never put load-bearing context there.

**Memory vs. handoff files:**
- Handoff files (`.ai/*`) are the *project's* knowledge — shared across agents (Claude, Gemini, future tools). Commit them.
- Per-agent memory (e.g. Claude's `~/.claude/.../memory/`) is private to that agent. Use it for cross-project user preferences, not for project-specific facts that the next agent needs to know.
