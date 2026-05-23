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
