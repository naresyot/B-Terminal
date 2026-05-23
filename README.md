# OmniTerm

Professional-grade cross-platform SSH terminal emulator and file transfer suite built with Electron, React, and xterm.js.

## Features

- **Multi-tab SSH sessions** — open and manage multiple concurrent connections
- **Secure credential vault** — passwords and private key passphrases stored with AES-256-GCM encryption
- **Jump-host chains** — connect through bastion hosts or proxy chains (`ssh -J` style)
- **Dual-engine SFTP** — reuses the active SSH socket for file transfer without re-authenticating
- **WebGL-accelerated terminal** — hardware-accelerated rendering via `@xterm/addon-webgl`
- **Inherited session config** — folder-level settings cascade to child sessions

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron 30 |
| UI | React 19 + Tailwind CSS |
| Terminal | xterm.js 6 + WebGL addon |
| SSH/SFTP | ssh2 |
| Bundler | Vite + TypeScript |

## Getting Started

```bash
npm install
npm run dev        # starts renderer (Vite) + main process + Electron together
```

### Build for distribution

```bash
npm run build      # compiles renderer and main
npm run package    # produces distributable in out/
```

Targets: macOS (`.dmg`), Windows (NSIS installer), Linux (AppImage).

## Architecture

All Node.js APIs (`fs`, `child_process`, `ssh2`, `crypto`) run in the **main process** only. The renderer communicates exclusively through the Electron Context Bridge defined in `src/main/preload.ts`. No Node APIs are ever imported directly into `src/renderer/`.

## Security

- Credentials are encrypted with AES-256-GCM using PBKDF2 key derivation before being written to disk.
- IPC handlers sanitize all input parameters before processing.
- Plain-text passwords and private keys are never persisted.
