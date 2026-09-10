# ShieldAI — current implementation context

> Release context updated 10 September 2026 IST. Canonical repository: `D:\Code\ShieldAI`. Public demo: `https://shieldai-abheet19.fly.dev`; `/version` is the authoritative source-commit proof. Never infer deployment from repository configuration or a reachable older image. Current source and executable tests win if an older design note disagrees.

## Product contract

ShieldAI is an educational Paillier partially homomorphic encryption demonstration with synthetic inputs. The browser derives four bounded integer indicators from five form fields, generates a 1,024-bit demonstration key, encrypts the indicators, sends only public modulus/ciphertexts, decrypts the returned weighted ciphertext locally, and displays a deterministic normalized score. It is not AI, a trained model, a credit score, an eligibility decision, a lending product, or production cryptography.

## Architecture and end-to-end flow

```text
synthetic inputs + explicit consent
  -> browser validation/indicator derivation/keygen/encryption
  -> POST public n + four ciphertext strings
  -> Flask structure/range/coprimality validation
  -> homomorphic public-weight combination
  -> encrypted total -> browser decrypt/normalize -> score + receipt
```

Flask serves the page, `/health`, and `/api/v1/private-evaluations`; it has no database/provider. Vendored browser Paillier code keeps private-key operations client-side. The server computes encrypted `5*DTI-bps + 4*loan-income-bps + 3*utilization-bps + 200*stability-gap-months`. Request/ciphertext bounds and process-local quota limit expensive arithmetic. Logs contain a request ID, route/status, and timing, never form values, ciphertext lists, keys, or decrypted result.

## Code map

| Path                                                         | Responsibility                                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `app.py`                                                     | routes, validation, quota, homomorphic calculation, headers, and payload-free logging                     |
| `templates/index.html`                                       | synthetic form, consent, educational copy, result, and receipt structure                                  |
| `static/shield-client.js`                                    | validation, indicators, key generation, encrypt/request/decrypt/normalize, and UI state                   |
| `static/vendor`                                              | vendored Paillier implementation and provenance/license                                                   |
| `static/vendor/glass; brand/mark.svg; static/brand/mark.svg` | vendored design layer and canonical/runtime brand                                                         |
| `tests; tools`                                               | backend contracts, all-CTA browser flow, bounded concurrency, recorder, Lighthouse, and retained evidence |
| `Dockerfile; fly.toml; .github/workflows`                    | unprivileged image, baked source identity, Fly config, reusable CI, and manual release                    |

## Invariants and trust boundaries

- Raw form fields, plaintext indicators, private key, decrypted total, and displayed score never go to the server.
- Formula, client derivation, server weights, normalization, explanation, and exact 37.5 fixture change atomically.
- Validate request size, count, decimal strings/length, modulus, ciphertext range, and coprimality before modular arithmetic.
- Consent is required for the demo, but it is explanatory UI rather than a legal consent system.
- Client-generated ciphertexts are not proofs of honest bounded plaintext; the protocol has no range/zero-knowledge proof.
- Educational/non-lending language stays adjacent to inputs/results.

## User workflows to preserve

- Populate the synthetic example, edit five fields, exercise required/range/malformed errors, and give explicit consent.
- Run real browser keygen/encryption -> Flask homomorphic arithmetic -> browser decryption and verify 37.5/100.
- Expand/collapse the privacy receipt, trigger a bounded server/quota error, retry, and verify old results clear.
- Switch theme and complete the 390 px flow; reload must clear plaintext result.
- Verify `/health`, request headers/timing, payload-free logs, and process quota behavior.

## Concepts this project teaches

| Concept                     | How it appears here                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| Paillier PHE                | ciphertexts can be combined for addition and public-scalar multiplication without decryption |
| Public/private key boundary | browser holds the private key; server needs only public modulus/ciphertexts                  |
| Modular arithmetic          | ciphertext validation and weighted exponentiation operate in the Paillier group              |
| Threat modeling             | honest-but-curious privacy differs from malicious-client correctness and production security |
| DoS bounds                  | byte/string/count/coprimality limits and quotas bound expensive math                         |
| Privacy-safe observability  | request IDs and Server-Timing support debugging without input/result logging                 |

## CI, packaging, deployment, and rollback

CI runs ESLint, Ruff, Prettier, eight backend tests, the bounded-load assertion, npm/pip dependency audits, the real browser workflow, and a production image build. Husky runs the fast lint/format/backend gate before local commits. The image embeds `GITHUB_SHA` as `SHIELDAI_SOURCE_COMMIT`; `/version` and `/health` expose it for exact-release verification. Fly is stateless and has no database migration. Retain the prior verified image for rollback, then repeat health and synthetic encrypted-flow smoke tests.

## Current measured evidence

| Result                                                                                                                                                                            | Evidence                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Eight backend tests passed                                                                                                                                                        | `tests/test_app.py`                            |
| Sixteen all-CTA browser groups passed with zero errors; encrypted flow produced 37.5/100                                                                                          | `tools/verify-workflows.mjs`; release evidence |
| Live acceptance at 320x800, 768x1024, 1366x768, and 1920x1080 checks every visible CTA, post-result semantics, overflow, target size, keyboard access, and automated WCAG signals | four-viewport release evidence                 |
| 30-request, six-worker probe accepted 8 and bounded 22 with HTTP 429                                                                                                              | `tools/bounded_load.py`; release evidence      |
| Lighthouse 13.4.1: 100/100/100/100; FCP 1.3 s, LCP 1.4 s, TBT 0 ms, CLS 0                                                                                                         | release evidence; controlled local desktop run |
| Ruff, ESLint, Prettier, npm audit, pip-audit, Docker, and Husky are wired into the release path                                                                                   | configuration and release evidence             |

Evidence is scoped to the named tree/environment. WCAG-related checks are strong automated and keyboard evidence, not third-party certification.

## Open limits

- 1,024-bit Paillier is for a timed educational demo and below modern production recommendations.
- No range proof, proof of honest derivation, malicious-client protection, replay binding, authenticated user/origin, distributed quota, or external crypto audit.
- The formula has no empirical lending, fairness, legal, or decision-quality validation.
- Process quota resets on restart and does not coordinate across machines; local timing is not device-fleet or load evidence.
- Scale-to-zero cold starts and process-local quotas remain; use `/version` to verify the running revision.

## Reading order

1. `CONTEXT.md` — educational/privacy/release boundary
2. `docs/USAGE.md` — complete user and operator flow
3. `D:\Work\ShieldAI Study Pack\02_ShieldAI_Concepts_From_Zero.md` — cryptography and web foundations
4. `D:\Work\ShieldAI Study Pack\01_ShieldAI_Architecture_And_Encryption.md` — protocol and threat boundary
5. `static/shield-client.js; app.py` — client/server flow
6. `tests; tools` — executable privacy and behavior evidence
7. `D:\Work\ShieldAI Study Pack\05_ShieldAI_System_Design_Cryptography_ML_Python_Walkthrough.md` — system-design walkthrough; keep deterministic/non-ML wording
8. `docs/SANITY.md; docs/TESTING.md; Study Pack 08` — verification and release

Use `docs/SANITY.md` in the repository, or `09_SANITY_CHECK.md` in the Study Pack, before claiming that a new change works.

## Rules for the next coding agent

1. Never send/log plaintext, derived indicators, private key, decrypted total, or displayed score.
2. Keep the project labeled educational, synthetic, non-lending, and non-AI.
3. Change formula/derivation/normalization/explanation/fixture together.
4. Do not weaken arithmetic/size/quota checks without focused negative tests.
5. Call a release live only when the public `/version` commit equals the reviewed Git commit.
