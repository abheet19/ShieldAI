# ShieldAI — sanity, acceptance, and release guide

> Snapshot: 10 September 2026 IST. Run this against disposable or synthetic data. Save the branch, commit, complete dirty-path list, command, exit code, environment, and artifact hashes with every result.

## Before running

Use synthetic values only. Inspect browser network and server logs while testing the privacy boundary. Never attach real financial data. A successful encrypted calculation does not validate the formula as a decision model.

```powershell
Set-Location 'D:\Code\ShieldAI'
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
npm ci
npm run verify:browser
docker build -t shieldai-local .
```

## Product sanity checklist

- [ ] Empty/malformed/range failures occur before encryption/network; example population never bypasses consent.
- [ ] Network request contains only public modulus and four ciphertext strings; logs contain no inputs/keys/decrypted score.
- [ ] Real browser encryption -> real Flask arithmetic -> local decryption yields 37.5/100.
- [ ] Receipt, theme, 429/retry, 390 px, reload-clears-result, and `/health` flows work.
- [ ] Oversized/count/string/modulus/range/coprimality checks and the eight-per-process quota fail boundedly.
- [ ] Production image runs unprivileged and the dependency audits apply to the exact image inputs.

## Retained evidence for the current candidate

- Seven pytest tests and ten browser groups passed; current browser JSON records zero errors and exact 37.5/100.
- Retained image size/audit/Lighthouse/quota evidence is bounded and dated in Study Pack 08.
- Fly v8 is older source; local branch and visual paths are not deployed.

## Release sequence

1. Review/commit the local branch and visual paths through a tracked merge path.
2. Run reusable CI and production image at that exact commit.
3. Deploy with approval; record source/image/release/machine and synthetic health/encrypted/theme/mobile smoke.
4. Retain v8; require stronger parameters, distributed controls, monitoring, and independent reviews before wider use.

## Claims this guide does not establish

- No production cryptographic assurance, malicious-client correctness, identity/origin binding, distributed quota, external audit, or fairness/legal basis.
- No AI/model behavior; current candidate is not live.

A green local run is evidence for the exact tested tree. Call a feature deployed only after recording `source commit -> CI run -> image/release -> post-deploy smoke` for the same bytes.
