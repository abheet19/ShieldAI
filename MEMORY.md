# ShieldAI project memory

> Optimized handoff for humans and coding agents. Updated 10 September 2026 IST. Full portfolio transcript and cross-project decisions live in `C:\Users\abhee\OneDrive\Documents\ChatGPT\code\verification-work\portfolio-release-20260910\MEMORY.md`.

## Stable product decisions

- ShieldAI demonstrates browser-held-key Paillier partial homomorphic encryption with synthetic inputs.
- It is deliberately not an AI/ML system, credit decision, lender, eligibility tool, or production cryptographic claim.
- The browser alone sees raw values, derived plaintext indicators, private key, decrypted total, and rendered score.
- The Flask evaluator accepts exactly a public modulus and four ciphertexts, validates strict bounds, and returns an encrypted weighted sum.
- The transparent example result is 37.5/100. Formula, derivation, normalization, explanation, and fixture must change together.
- Glass supplies the shared theme tokens; opaque cards hold content. Dark/light, reduced-transparency, keyboard, focus, and mobile behavior are release requirements.

## Release contract

- Public URL: <https://shieldai-abheet19.fly.dev>
- Identity URL: <https://shieldai-abheet19.fly.dev/version>
- A deployment is accepted only when the public 40-character `source_commit` equals the reviewed Git commit.
- Docker receives `SOURCE_COMMIT`; CI/manual Fly workflow passes `GITHUB_SHA`; the app sanitizes invalid values to `unknown`.
- Fly runs one unprivileged Gunicorn worker with four threads, scale-to-zero, no database, and a process-local quota.

## Verification contract

Run `npm run check`, `npm run verify:load`, `npm audit --audit-level=high`, `python -m pip_audit -r requirements.txt`, the browser workflow, production Docker build/smoke, and post-deploy `/health`, `/version`, static-asset, security-header, mobile/theme, and encrypted-example checks. Current browser coverage includes every visible CTA, keyboard operation, 320 px overflow/targets, validation, consent, strict request payload, 429 and malformed response recovery, theme persistence, receipt, home/reset, request timing, and scroll-frame sampling.

## Known limits

1,024-bit Paillier parameters prioritize demo latency. There are no range proofs, trusted-client proof, authentication, global quota, database, external cryptographic audit, fairness/legal validation, or side-channel guarantee. Platform/network metadata remains visible. A malicious server could replace browser JavaScript. Do not weaken these statements.

## Change log for this release

- Added sanitized `/version` and `/health.source_commit` release proof.
- Wired source commit through Docker, CI, and Fly deployment.
- Added ESLint, Ruff, Prettier, Husky pre-commit, exact dev locks, and CI enforcement.
- Expanded browser verification from ten to sixteen groups and added bounded concurrency evidence.
- Removed startup opacity animation so primary content paints immediately.
- Added complete usage, testing, study, and AI context handoffs.
- Fixed Linux CI's 320 px font-metric overflow by allowing dense section headings and chips to wrap; the browser workflow was repeated five times locally before republishing.

Retired wizard/CSV/regression files remain tracked as historical, non-runtime material for compatibility and audit history. They are absent from the Docker image and must not be reconnected to the product path.
