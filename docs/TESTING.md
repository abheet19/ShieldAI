# ShieldAI — testing artifact

Recorded 2026-09-08. Tested source: final browser-key evaluator, blank-field and envelope allowlist fixes, timeout/stale-result handling, bundled Glass assets and single Gunicorn worker. Git/Fly identifiers are recorded in `release-verification.json` beside this artifact once published.

## Environment and reproduction

Local Flask on `http://127.0.0.1:5055`, real browser `paillier-bigint` key generation/encryption, real Python `phe` evaluation, browser-only decryption. Synthetic values only. No paid APIs/database are involved.

1. In the repo, create a Python venv and install `requirements.txt`; run `python -m pytest -q`.
2. Run `python -m flask --app app run --host 127.0.0.1 --port 5055`.
3. Install demo-tool dependencies with `npm ci`; run `node tools/verify-workflows.mjs`. The tool has a Windows Chrome default; adapt it to a Playwright browser on another OS. Set `VERIFICATION_DIR` to retain evidence outside the repo.
4. Enter 85000,12000,30,5,20000, confirm the synthetic-demo checkbox and evaluate. The result must be37.5/100. Expand the receipt and inspect the Network panel: POST has **only** `public_key` and `encrypted_values`, with four feature names, no raw inputs/private key.
5. Run `node tools/record-demo.mjs` then `python tools/build-demo-gif.py` (Pillow required for the GIF). The recorder targets localhost by default, captures the actual single-page flow and writes a frame manifest. The GIF builder reads that manifest so retired wizard frames cannot leak into the new recording.

## Scenario matrix

| Scenario | Expected | Actual |
|---|---|---|
| Empty form |Reject before encryption/network |Passed |
| Blank debt/other zero-min fields |Do not coerce blank to0 |Passed |
| Missing consent |Explain required synthetic-demo confirmation |Passed |
| Out-of-range utilization101 |Reject before request |Passed |
| Actual encrypted request |Exactly public modulus +4 ciphertext strings |Passed |
| Correctness |Real client decrypts weighted total into37.5/100 |Passed; local browser flow845ms in final recorded check |
| Receipt |Expand/collapse native details |Passed |
| Error after earlier success |Clear stale result, show error, restore button |Passed with **explicitly simulated HTTP429** browser response |
| Reload/mobile |Plaintext result disappears;390px has no horizontal overflow |Passed |
| Python tests |Health, invalid envelope/key, correctness, budget, extra raw fields, oversized body |6/6 passed |
| Concurrent budget |30 calls,6 concurrent local test threads, limit8 |Exactly8 accepted and22 HTTP429; mean28.92ms/max160.49ms in recorded in-process run |
| Oversized body |Reject above12000bytes without evaluator work |Passed413 |
| Extra raw field with valid ciphertext |Reject entire envelope |Passed400 |
| Appearance/media |Current Glass light/mobile and dark result/GIF |Screenshots visually inspected;9s current GIF regenerated |

The limiter burst uses Flask test clients with real encrypted calculation, not a public load test. Browser error rendering uses an intentionally mocked429 so repeated public evaluations are unnecessary. The normal encrypted success flow uses the real evaluator. No statement/branch coverage percentage is claimed.

## Evidence and limits

Evidence folder: `C:/Users/abhee/OneDrive/Documents/ChatGPT/code/job-search-context/project-verification-2026-09-08/ShieldAI/`; `browser-results.json`, `bounded-load.json`, desktop/mobile screenshots and release record. Repo media: `docs/demo/shieldai-demo.gif`, `docs/demo/browser-private-key-flow.png` and manifest-driven recorder.

This is guided browser verification with observation and backend assertions, not an external cryptographic audit or proof of production readiness. Not verified: maliciously replaced browser code, side-channel resistance, signed-client supply chain, result proofs, input range proofs, distributed quotas, large sustained load, target mobile CPU performance or financial fairness/decision validity. The1024-bit educational key size is not a production strength claim. Unknown raw fields are rejected, but the service cannot decrypt a user's ciphertext to prove the hidden plaintext came from allowed UI inputs.

One deployed process makes the default budget eight per client per hour on that one process; restart/another machine creates a new budget. No LLM token-cost path exists. A real product still needs stronger reviewed parameters and abuse controls. The privacy receipt is an explanation, not a cryptographic attestation.

## Deployment, secrets, CI and hooks

No `.husky`, `.pre-commit-config.yaml` or configured `core.hooksPath` was found: no enforced pre-commit checks are installed. `.github/workflows/deploy.yml` is an old Google Cloud workflow triggered on `main`; it is not the current Fly path and has no pytest gate. Current branch/source and explicit Fly deployment must not be described as having a new CI pipeline.

Run `python -m pytest -q`, then local `node tools/verify-workflows.mjs`, inspect media, review diff, commit and push without force. From repository root deploy with `fly deploy --app shieldai-abheet19`. The runtime needs no API secret, database, OpenAI or Anthropic key. Optional `SHIELDAI_EVALUATIONS_PER_HOUR` changes the process-local budget; `PORT` is supplied by the container runtime. Secret values must not be placed in Docker build args or commits.

Use `fly status --app shieldai-abheet19`, `fly releases --app shieldai-abheet19`, `fly logs --app shieldai-abheet19`, `/health` and one synthetic encrypted browser flow after a release. Health reports process/mode/budget, not cryptographic assurance. Payload-free request timing/status is the useful observability target; never add plaintext/key logging. Record commit + image/release. To roll back, deploy a previously verified image using `fly deploy --app shieldai-abheet19 --image <verified-image-reference>`, then repeat the smoke. There is no database migration to roll back.

The image runs as an unprivileged user, serves locally bundled assets and uses one Gunicorn worker/four threads. Fly provides HTTPS routing and stop/start-on-idle; first-request cold-start latency differs from warm response time. The256MB VM and bounded local burst are not a production capacity guarantee. The app is stateless across restarts, including its quota, so a distributed edge budget is required before claiming global limits.
