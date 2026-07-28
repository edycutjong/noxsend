## [1.3.1](https://github.com/edycutjong/noxsend/compare/v1.3.0...v1.3.1) (2026-07-28)


### Bug Fixes

* **pitch:** use scannable PNG QR (data-URI) encoding the full https URL ([083e2db](https://github.com/edycutjong/noxsend/commit/083e2db6da771a2b323ac258e6732ef6ea1cc0cd))

# [1.3.0](https://github.com/edycutjong/noxsend/compare/v1.2.0...v1.3.0) (2026-07-28)


### Features

* **pitch:** real QR + SVG icons + share metadata ([ded1bb7](https://github.com/edycutjong/noxsend/commit/ded1bb760bfb9e4670944b46ba9601b3290a2734))

# [1.2.0](https://github.com/edycutjong/noxsend/compare/v1.1.0...v1.2.0) (2026-07-28)


### Bug Fixes

* **security:** resolve CodeQL high-severity alerts (ReDoS + DOM XSS) ([0b5ec8b](https://github.com/edycutjong/noxsend/commit/0b5ec8b9d313a6c71c0eb62315370786d945e3e5)), closes [hi#severity](https://github.com/hi/issues/severity)


### Features

* **web:** Cipher-Noir landing redesign + real demo video + README screenshots ([3c50585](https://github.com/edycutjong/noxsend/commit/3c5058531ed8527f5e9ac67976c38d1d12ebb201))

# [1.1.0](https://github.com/edycutjong/noxsend/compare/v1.0.1...v1.1.0) (2026-07-26)


### Bug Fixes

* **pitch:** letterbox + page background match slide bg — deck fills the whole screen at any aspect ratio ([e2de887](https://github.com/edycutjong/noxsend/commit/e2de887594349905885813ecdf3f457e0b3faa77))
* **security:** npm audit fix ([a8a1bee](https://github.com/edycutjong/noxsend/commit/a8a1bee73cef127534b189c6552e4e7ffd01070a))


### Features

* **web:** micro-animations — scroll-reveal, hover-lift, press feedback (reduced-motion safe) ([6a4fa88](https://github.com/edycutjong/noxsend/commit/6a4fa88c62c57169c268fb6b86a081025d1bdaff))
* **web:** richer landing page — one-flow, live-proof stats, CTAs, honest FAQ for first-time visitors ([4dfb465](https://github.com/edycutjong/noxsend/commit/4dfb465ef27056c63e87f7b7a5426e44ba840a6b))
* **web:** universal pressable feedback — press + keyboard focus-visible on all interactive elements (a11y) ([6a1f310](https://github.com/edycutjong/noxsend/commit/6a1f310735775cce45c0577300ceae3b80374168))

## [1.0.1](https://github.com/edycutjong/noxsend/compare/v1.0.0...v1.0.1) (2026-07-26)


### Bug Fixes

* **verify:** serve event stream via Etherscan logs API (server route) — public RPC blocks archive eth_getLogs ([1e08024](https://github.com/edycutjong/noxsend/commit/1e08024da3515cab80468e0b848b60dfdea6ffa2))

# 1.0.0 (2026-07-26)


### Bug Fixes

* commit on-chain proof log (docs/proof/e2e.log) — was excluded by *.log, breaking the README proof link ([68021fd](https://github.com/edycutjong/noxsend/commit/68021fde4a63db546f83f59d9143f85df86e92a9))
* commit on-chain proof log (docs/proof/e2e.log) — was excluded by *.log, breaking the README proof link ([a40f237](https://github.com/edycutjong/noxsend/commit/a40f237a05c8c7a6bd496f7dd22c3d3096de5c61))


### Features

* add self-contained pitch deck served at /pitch ([4aac690](https://github.com/edycutjong/noxsend/commit/4aac690aef23df1d0d1359b0d1d5bfecc4d6e548))
