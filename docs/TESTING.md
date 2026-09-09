# ShieldAI — testing artifact

## Current recheck — 2026-09-09

The dependency refresh to Flask 3.1.3, Gunicorn 26.2.0, `phe` 1.5.0 and pytest 9.1.1 passed 7/7 tests in Python 3.13 and the clean Python 3.12 production image built successfully. `pip-audit` reported no known vulnerabilities for the runtime requirement set. The patched local Chrome workflow passed ten groups with real browser Paillier encryption, real Flask/Python ciphertext arithmetic and browser decryption in 365 ms on the exact container-image run; its 429 path remains explicitly simulated. A separate deployed pre-patch run produced 37.5/100 and exposed the expected privacy receipt. Release identity is updated below only after deployment.

The minimal production image measured 48,524,146 bytes locally, down from 154,760,932 bytes before unused NumPy/pandas/scikit-learn packages and `loan_data.csv` were removed from the image. Its Gunicorn `/health` smoke returned 200 as the unprivileged `appuser`. The pre-release Fly observation used v8 (created 2026-09-08T17:17:40Z): `/health` returned in 3,364 ms from a suspended machine, and a live synthetic browser evaluation decrypted to 37.5/100 with only `public_key` and `encrypted_values` crossing the request boundary. This is cold-start evidence, not a warm-latency benchmark. The final release identity and live asset hashes are recorded only after deployment.

Recorded 2026-09-09. Tested source: final browser-key evaluator, blank-field and envelope allowlist fixes, timeout/stale-result handling, bundled Glass assets and single Gunicorn worker. Git/Fly identifiers belong in the release report only after the corresponding revision is published.

## Environment and reproduction

Local Flask on `http://127.0.0.1:5055`, real browser `paillier-bigint` key generation/encryption, real Python `phe` evaluation, browser-only decryption. Synthetic values only. No paid APIs/database are involved.

1. In the repo, create a Python venv and install `requirements-dev.txt`; run `python -m pytest -q`.
2. Run `python -m flask --app app run --host 127.0.0.1 --port 5055`.
3. Install demo-tool dependencies with `npm ci`, install the Playwright Chromium build, and run `npm run verify:browser`. Set `SHIELDAI_BROWSER_PATH` only when you intentionally want a system browser; the default is Playwright's portable browser. Set `VERIFICATION_DIR` to retain evidence outside the repo.
4. Enter 85000,12000,30,5,20000, confirm the synthetic-demo checkbox and evaluate. The result must be 37.5/100. Expand the receipt and inspect the Network panel: POST has **only** `public_key` and `encrypted_values`, with four feature names, no raw inputs/private key.
5. Run `node tools/record-demo.mjs` then `python tools/build-demo-gif.py` (Pillow required for the GIF). The recorder targets localhost by default, captures the actual single-page flow and writes a frame manifest. The GIF builder reads that manifest so retired wizard frames cannot leak into the new recording.

## Scenario matrix

| Scenario | Expected | Actual |
|---|---|---|
| Empty form |Reject before encryption/network |Passed |
| Blank debt/other zero-min fields |Do not coerce blank to0 |Passed |
| Missing consent |Explain required synthetic-demo confirmation |Passed |
| Out-of-range utilization101 |Reject before request |Passed |
| Actual encrypted request |Exactly public modulus +4 ciphertext strings |Passed |
| Correctness | Real client decrypts weighted total into 37.5/100 | Passed; exact-image browser flow completed in 365 ms |
| Receipt |Expand/collapse native details |Passed |
| Error after earlier success |Clear stale result, show error, restore button |Passed with **explicitly simulated HTTP429** browser response |
| Reload/mobile |Plaintext result disappears;390px has no horizontal overflow |Passed |
| Python tests |Health/security headers, invalid envelope/key, correctness, budget, invalid-request quota behavior, extra raw fields, oversized JSON response |7/7 passed |
| Concurrent budget | 30 calls, 6 concurrent local test threads, limit 8 | Exactly 8 accepted and 22 HTTP 429; mean 28.92 ms / max 160.49 ms in the recorded in-process run |
| Oversized body |Reject above12000bytes without evaluator work |Passed413 |
| Extra raw field with valid ciphertext |Reject entire envelope |Passed400 |
| Appearance/media |Current Glass light/mobile and dark result/GIF |Screenshots visually inspected;9s current GIF regenerated |

The exact-image browser run emitted 17 structured request events. Each was limited to `event`, generated `request_id`, method, route template, status, and duration; no form values, ciphertexts, key material, IPs, bodies, or query strings were logged. Responses expose `X-Request-ID` and `Server-Timing` for correlation.

The limiter burst uses Flask test clients with real encrypted calculation, not a public load test. Browser error rendering uses an intentionally mocked429 so repeated public evaluations are unnecessary. The normal encrypted success flow uses the real evaluator. No statement/branch coverage percentage is claimed.

## Performance and visual gate

A Lighthouse run against the exact production image scored **100/100** for performance, accessibility, best practices, and SEO. Observed metrics were FCP 1,302 ms, LCP 1,383 ms, TBT 0 ms, and CLS 0.000. These are one controlled desktop audit and do not predict every device or network. Desktop, alternate-theme, and 390 px screenshots were inspected for overflow, focus, errors, consent, result state, and receipt disclosure.

## Evidence and limits

Evidence folder: `C:/Users/abhee/OneDrive/Documents/ChatGPT/code/job-search-context/project-verification-2026-09-08/ShieldAI/`; `browser-results.json`, `bounded-load.json`, desktop/mobile screenshots and release record. Repo media: `docs/demo/shieldai-demo.gif`, `docs/demo/browser-private-key-flow.png` and manifest-driven recorder.

This is guided browser verification with observation and backend assertions, not an external cryptographic audit or proof of production readiness. Not verified: maliciously replaced browser code, side-channel resistance, signed-client supply chain, result proofs, input range proofs, distributed quotas, large sustained load, target mobile CPU performance or financial fairness/decision validity. The 1024-bit educational key size is not a production strength claim. Unknown raw fields are rejected, but the service cannot decrypt a user's ciphertext to prove the hidden plaintext came from allowed UI inputs.

One deployed process makes the default budget eight per client per hour on that one process; restart/another machine creates a new budget. No LLM token-cost path exists. A real product still needs stronger reviewed parameters and abuse controls. The privacy receipt is an explanation, not a cryptographic attestation.

## Deployment, secrets, CI and hooks

No `.husky`, `.pre-commit-config.yaml` or configured `core.hooksPath` was found: no enforced pre-commit checks are installed. `.github/workflows/ci.yml` now runs backend tests, dependency audits, the real portable browser flow, a production Docker build, and uploads browser evidence. `.github/workflows/fly-deploy.yml` is manual and cannot deploy until that reusable verification job passes. The retired Google Cloud workflow no longer runs on pushes.

Run `python -m pytest -q`, then local `npm run verify:browser`, inspect media, review the diff, commit, and push without force. Use the manual verified Fly workflow or run `fly deploy --app shieldai-abheet19` from the reviewed revision. The runtime needs no API secret, database, OpenAI or Anthropic key. Optional `SHIELDAI_EVALUATIONS_PER_HOUR` changes the process-local budget; `PORT` is supplied by the container runtime. Secret values must not be placed in Docker build args or commits.

Use `fly status --app shieldai-abheet19`, `fly releases --app shieldai-abheet19`, `fly logs --app shieldai-abheet19`, `/health` and one synthetic encrypted browser flow after a release. Health reports process/mode/budget, not cryptographic assurance. Payload-free request timing/status is emitted by the application and is the useful observability boundary; never add plaintext/key logging. Record commit + image/release. To roll back, deploy a previously verified image using `fly deploy --app shieldai-abheet19 --image <verified-image-reference>`, then repeat the smoke. There is no database migration to roll back.

The image runs as an unprivileged user, serves locally bundled assets and uses one Gunicorn worker/four threads. Fly provides HTTPS routing and stop/start-on-idle; first-request cold-start latency differs from warm response time. The 256 MB VM and bounded local burst are not a production capacity guarantee. The app is stateless across restarts, including its quota, so a distributed edge budget is required before claiming global limits.
