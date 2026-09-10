# ShieldAI — current implementation context

> Evidence snapshot updated 10 September 2026 IST. Canonical repository: `D:\Code\ShieldAI`; the reviewed candidate through `a10775a204d64525dcad9ca2790f5a0749ce05d8` is three commits ahead of public `master` `e3e1f0db3e8aba14bd146ba651eda34d7a8ab92a`, and this documentation-only commit is layered on that candidate. Local branch `codex/shieldai-release` has no upstream. Retained deployment evidence maps Fly v8 to the older public source; a current anonymous `/health` request returned 200 but exposes no release SHA. Neither the reviewed candidate nor this documentation update is pushed or deployed.
>
> This is the short, AI-readable map. Current source and executable tests win if an older design note disagrees. A dirty working tree is a candidate, not a release; a configured URL is not proof that the candidate is deployed.

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

| Path | Responsibility |
| --- | --- |
| `app.py` | routes, validation, quota, homomorphic calculation, headers, and payload-free logging |
| `templates/index.html` | synthetic form, consent, educational copy, result, and receipt structure |
| `static/shield-client.js` | validation, indicators, key generation, encrypt/request/decrypt/normalize, and UI state |
| `static/vendor` | vendored Paillier implementation and provenance/license |
| `static/vendor/glass; brand/mark.svg; static/brand/mark.svg` | vendored design layer and canonical/runtime brand |
| `tests; tools` | backend contracts, real-browser flow, audits, recorder, Lighthouse, and bounded timing |
| `Dockerfile; fly.toml; .github/workflows` | unprivileged Python image, Fly config, reusable CI, and manual release |

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

| Concept | How it appears here |
| --- | --- |
| Paillier PHE | ciphertexts can be combined for addition and public-scalar multiplication without decryption |
| Public/private key boundary | browser holds the private key; server needs only public modulus/ciphertexts |
| Modular arithmetic | ciphertext validation and weighted exponentiation operate in the Paillier group |
| Threat modeling | honest-but-curious privacy differs from malicious-client correctness and production security |
| DoS bounds | byte/string/count/coprimality limits and quotas bound expensive math |
| Privacy-safe observability | request IDs and Server-Timing support debugging without input/result logging |

## CI, packaging, deployment, and rollback

CI installs/audits Python dependencies, runs seven backend tests, audits Node tooling, runs the real browser encrypted flow, and builds the production Docker image. The image installs only Flask, Gunicorn, and `phe` and runs unprivileged. Manual Fly deployment depends on CI and `FLY_API_TOKEN`.

Fly v8 maps to older `e3e1f0d...`; reviewed candidate `a10775a...` and this documentation-only commit are not deployed. Review the three candidate commits through `a10775a...` plus this documentation commit through a tracked publication path, rerun reusable CI/image/browser evidence on the final documentation tree, deploy with approval, record source/image/release/machine and a synthetic post-smoke, and retain v8 for rollback. No database migration is involved. Wider release needs modern production parameters, distributed edge limits/monitoring, and independent cryptographic/security/fairness/legal review.

## Current measured evidence

| Result | Evidence |
| --- | --- |
| Seven backend tests passed | `D:\Code\ShieldAI\tests; Study Pack 08` |
| Ten real-browser groups passed, zero errors; exact encrypted flow produced 37.5/100 | `D:\Code\ShieldAI\docs\verification\browser-results.json` |
| Image reduced from 154.8 MB to 48.5 MB; retained dependency audit clean; local Lighthouse 100/100/100/100 | `D:\Work\ShieldAI Study Pack\08_TESTING_ARTIFACT.md` |
| 30-request quota probe accepted 8 and rate-limited 22; bounded behavior, not capacity | `D:\Work\ShieldAI Study Pack\08_TESTING_ARTIFACT.md` |
| Fly v8/public `master` are `e3e1f0d...`; reviewed candidate `a10775a...` is three commits ahead, with this documentation update layered above it; both remain unpublished | `C:\Users\abhee\OneDrive\Documents\ChatGPT\code\verification-work\shieldai-release-20260910\RELEASE_MANIFEST.md; D:\Work\ShieldAI Study Pack\release-verification.json` |

The evidence above belongs to the named local working-tree snapshot unless it explicitly names a release/image. It does not become live evidence merely because a deployment configuration exists.

## Open limits

- 1,024-bit Paillier is for a timed educational demo and below modern production recommendations.
- No range proof, proof of honest derivation, malicious-client protection, replay binding, authenticated user/origin, distributed quota, or external crypto audit.
- The formula has no empirical lending, fairness, legal, or decision-quality validation.
- Process quota resets on restart and does not coordinate across machines; local timing is not device-fleet or load evidence.
- Neither reviewed candidate `a10775a...` nor this documentation update is live in Fly v8.

## Reading order

1. `CONTEXT.md` — educational/privacy/release boundary
2. `D:\Work\ShieldAI Study Pack\02_ShieldAI_Concepts_From_Zero.md` — cryptography and web foundations
3. `D:\Work\ShieldAI Study Pack\01_ShieldAI_Architecture_And_Encryption.md` — protocol and threat boundary
4. `static/shield-client.js; app.py` — client/server flow
5. `tests; tools` — executable privacy and behavior evidence
6. `D:\Work\ShieldAI Study Pack\05_ShieldAI_System_Design_Cryptography_ML_Python_Walkthrough.md` — system-design walkthrough; keep deterministic/non-ML wording
7. `docs/SANITY.md; docs/TESTING.md; Study Pack 08` — verification and release

Use `docs/SANITY.md` in the repository, or `09_SANITY_CHECK.md` in the Study Pack, before claiming that a new change works.

## Rules for the next coding agent

1. Never send/log plaintext, derived indicators, private key, decrypted total, or displayed score.
2. Keep the project labeled educational, synthetic, non-lending, and non-AI.
3. Change formula/derivation/normalization/explanation/fixture together.
4. Do not weaken arithmetic/size/quota checks without focused negative tests.
5. Keep local candidate and v8 separate; do not commit, publish, or deploy without authorization.
