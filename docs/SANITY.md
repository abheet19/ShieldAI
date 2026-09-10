# ShieldAI - sanity, acceptance, and release guide

> Snapshot: 10 September 2026 IST. Use disposable synthetic data. A successful encrypted calculation verifies the demonstrator flow; it does not validate the scoring formula as a real lending model.

## Reproduce the reviewed candidate

```powershell
Set-Location 'D:\Code\ShieldAI'
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
npm ci
npm run check
.\.venv\Scripts\python.exe -m tools.bounded_load
npm run verify:browser
```

Run the container check where Docker is available:

```powershell
docker build --build-arg SOURCE_COMMIT=(git rev-parse HEAD) -t shieldai-local .
docker run --rm -p 8080:8080 shieldai-local
```

## Reviewed acceptance evidence

- [x] Eight Flask tests cover health/version, valid encrypted evaluation, consent, malformed ciphertext, payload size, process quota, headers, and configured origin allowlisting.
- [x] Sixteen Playwright workflow groups cover empty and invalid form states, consent, keyboard use, theme persistence, rate-limit and malformed-response recovery, the full encrypted round trip, narrow-view layout, scroll responsiveness, receipt details, reset, and service identity.
- [x] The browser sends only the public modulus and four ciphertext strings; the synthetic raw income value is absent from the request.
- [x] The real browser-to-Flask-to-browser encrypted round trip returns and locally decrypts the documented synthetic score of 37.5/100.
- [x] A bounded 30-request load check produces exactly eight successful evaluations and 22 rate-limited responses for the per-process quota.
- [x] The final controlled local Lighthouse run scored 100 in Performance, Accessibility, Best Practices, and SEO. This is automated evidence, not WCAG certification.
- [x] Dependency audits report no known vulnerabilities in the locked npm tree or Python runtime requirements.

The durable machine-readable artifacts and screenshots are retained under `verification-work/portfolio-release-20260910/ShieldAI`. Each result applies only to the recorded tree and environment.

## Exact release sequence

1. Commit the reviewed tree and record its full 40-character SHA.
2. Push that commit through GitHub CI. Require tests, audits, browser checks, bounded load, and a production Docker build to pass for the same SHA.
3. Deploy with `SOURCE_COMMIT=<full SHA>` and retain the Fly release version and image reference.
4. Require public `/version` and `/health` to return that exact SHA, then run the public browser suite.

## Scope and limitations

- ShieldAI is an educational privacy-preserving calculation demonstrator, not a production credit-decision system.
- It has no malicious-client proof, identity-bound consent, distributed rate limiting, independent cryptographic audit, fairness validation, or legal basis for real lending decisions.
- The current Paillier parameters are intentionally small enough for an understandable browser demo and are not suitable for protecting real financial data.
- A green check applies to the exact recorded commit. Deployment is established only by the matching public source SHA and post-deploy evidence.
