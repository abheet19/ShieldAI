# ShieldAI usage guide

## Try the public demo

Open <https://shieldai-abheet19.fly.dev>. Use synthetic values only. Select **Use synthetic example**, review the five values, confirm the educational-demo notice, and select **Encrypt locally and evaluate**. A successful run displays **37.5/100** for the built-in example. Expand **View the privacy receipt** to inspect the browser/server boundary. The theme control persists only the theme name; refreshing clears form values, private key, and result.

## What to inspect

In browser developer tools, the evaluation POST must contain exactly `public_key` and `encrypted_values`. It must not contain income, debt, utilization, requested amount, employment years, a private key, or a plaintext result. `GET /version` returns the deployed source commit. `GET /health` reports service mode, persistence, quota, and the same commit; neither endpoint is a cryptographic assurance claim.

## Run locally

```powershell
Set-Location 'D:\Code\ShieldAI'
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
npm ci
$env:PATH = (Resolve-Path '.\.venv\Scripts').Path + ';' + $env:PATH
npm run check
npm run verify:load
.\.venv\Scripts\python.exe -m flask --app app run --host 127.0.0.1 --port 5055
```

In a second terminal, run `npm run verify:browser`. Use `VERIFICATION_DIR` to keep screenshots/JSON outside the repository. The browser gate requires Playwright Chromium (`npx playwright install chromium`).

## Failure and recovery

- Validation failures happen before key generation or network work; correct the focused field and retry.
- HTTP 429 means the process-local evaluation budget is exhausted. Honor `Retry-After` or wait for the one-hour window.
- Timeout or malformed-response errors discard the in-memory key when the submission handler exits and leave the form retryable.
- If `/version` differs from the intended commit, stop release claims and redeploy the reviewed image.

## Scope

ShieldAI is a privacy-protocol demonstration. It is not an AI model, credit score, eligibility decision, lending product, or production cryptographic assurance. See `docs/STUDY_GUIDE.md` for the protocol and threat model and `docs/TESTING.md` for exact evidence boundaries.
