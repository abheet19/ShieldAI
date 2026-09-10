# ShieldAI testing and release plan

## Required local gate

```powershell
Set-Location 'D:\Code\ShieldAI'
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
npm ci
$env:PATH = (Resolve-Path '.\.venv\Scripts').Path + ';' + $env:PATH
npm run check
npm run verify:load
.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt
npm audit --audit-level=high
```

Start Flask on port 5055 and run `npm run verify:browser` from another terminal. Build the final Docker image with `--build-arg SOURCE_COMMIT=<40-character Git SHA>` and smoke `/`, `/health`, and `/version` as the unprivileged image user.

## Executable acceptance matrix

| Area            | Required evidence                                                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend         | Eight tests cover health/security/timing/log shape, release identity allowlist, malformed/raw/oversized envelopes, real ciphertext correctness, quota, and invalid-request budget behavior.          |
| Privacy         | Browser POST has only public modulus and four ciphertexts; logs exclude values, ciphertexts, keys, IPs, bodies, query strings, and score.                                                            |
| CTAs            | Brand home, theme, synthetic example, consent, submit, and native receipt disclosure all work with accessible names; theme/receipt work from keyboard.                                               |
| Errors          | Empty/blank/range/consent failures avoid provider work; 429 and malformed-success paths clear stale result and restore retry.                                                                        |
| Responsive/WCAG | One `h1`, main/footer landmarks, labels, focus behavior, 320 px no-overflow, and 24 CSS-pixel interactive targets; Lighthouse accessibility is recorded. This is not third-party WCAG certification. |
| Performance     | Record encrypted round-trip, navigation timing, 60-frame scroll p95/long frames, Lighthouse FCP/LCP/TBT/CLS, image size, and cold versus warm context.                                               |
| Load            | 30 local in-process requests at six workers with a limit of eight must produce exactly 8 HTTP 200 and 22 HTTP 429. This checks bounded behavior, not capacity.                                       |
| Supply chain    | Ruff, ESLint, Prettier, Husky, npm audit, pip-audit, locked dependencies, CI, and Docker build pass.                                                                                                 |

## Current candidate observations — 2026-09-10

- `npm run check`: ESLint, Ruff, Prettier, and **8/8 pytest** passed.
- Browser: **16 groups**, zero errors; encrypted example **37.5/100**; local evaluation **884 ms**; 60-frame scroll p95 **17.8 ms**, zero frames above 50 ms in that sample.
- Bounded concurrency: 30 requests/six workers -> **8 accepted, 22 rate-limited**; p95 **65.71 ms**, max **127.82 ms** in the recorded in-process run.
- Lighthouse 13.4.1 local desktop: **100 performance, 100 accessibility, 100 best practices, 100 SEO**; FCP 1.3 s, LCP 1.4 s, TBT 0 ms, CLS 0.
- npm audit reported zero vulnerabilities. Record the final pip-audit and Docker results in the release manifest.

These are controlled candidate observations. They do not establish external cryptographic review, production capacity, mobile-device performance, a global quota, legal/fairness validity, or formal WCAG certification.

## Deployment and rollback

Push the reviewed commit without force. CI must pass on that commit. Deploy using the manual workflow or `fly deploy --build-arg SOURCE_COMMIT=<exact SHA> --app shieldai-abheet19`. Verify HTTPS, `/health`, `/version`, headers, assets, theme/mobile layout, and one synthetic encrypted flow. Save release ID/image/commit and response evidence outside the repo. Roll back to the previous verified Fly image and repeat the same smoke; there is no data migration.
