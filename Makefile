.PHONY: help install compile test test-contracts ci build web dev e2e-web lighthouse security-scan

help:
	@echo "NoxSend — make targets"
	@echo "  make install         Install workspace dependencies"
	@echo "  make compile         Compile contracts (solc auto-download)"
	@echo "  make test            @noxsend/core unit tests (vitest)"
	@echo "  make test-contracts  Hardhat contract tests"
	@echo "  make ci              lint + typecheck + all tests"
	@echo "  make build           Production build of the web dApp"
	@echo "  make dev             Run the web dApp locally (http://localhost:3000)"
	@echo "  make e2e-web         Playwright UI E2E tests (demo mode, no wallet)"
	@echo "  make lighthouse      Lighthouse CI audit"
	@echo "  make security-scan   npm audit + license check"

install:
	npm install

compile:
	npm run compile

test:
	npm test

test-contracts:
	npm run test:contracts

ci:
	npm run ci

build:
	npm run build:web

web dev:
	npm --prefix web run dev

# ── Advanced Testing & Security ─────────────────────────────
e2e-web:
	@echo "🎭 Running Playwright UI E2E tests (demo mode)..."
	npx playwright test

lighthouse:
	@echo "🔦 Running Lighthouse CI audit..."
	npx lhci autorun

security-scan:
	@echo "=== NPM AUDIT ==="
	npm audit --audit-level=high || true
	@echo ""
	@echo "=== LICENSE CHECK ==="
	npx license-checker --production --failOn "GPL-3.0;AGPL-3.0" --summary || true
