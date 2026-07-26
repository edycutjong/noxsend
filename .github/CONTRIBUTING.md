# Contributing

Thanks for your interest in improving NoxSend! 🎉

NoxSend is an npm-workspaces monorepo: Hardhat contracts, the `@noxsend/core`
SDK, and a CLI live at the repo root; the Next.js dApp lives in `web/`.

## Getting Started
1. Fork the repo and branch from `main`: `git checkout -b feat/your-feature`
2. Install dependencies: `npm install` (installs all workspaces)
3. Copy the env template: `cp .env.example .env` and add a **throwaway** Sepolia key
4. Compile + test: `npm run compile && npm run test:all`
5. Start the dApp: `cd web && npm run dev` (http://localhost:3000)

## Before You Open a PR
- `npm run ci` passes (lint, typecheck, core + contract tests).
- `npm run e2e:web` passes (Playwright UI, demo mode — no wallet needed).
- Add or update tests for any behavior change.
- Keep contracts thin and the protocol unmodified (see `ARCHITECTURE.md`).
- Keep commits conventional (`feat:`, `fix:`, `docs:`, `chore:`).
- **Never commit real keys.** Sepolia + throwaway keys only.

## Reporting Bugs / Requesting Features
Open an issue using the provided templates. Include repro steps, expected vs.
actual behavior, and environment details (OS, Node version, browser/wallet).
