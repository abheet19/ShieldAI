<div align="center">

<br>

# 🛡️ &nbsp;S H I E L D A I

### **Compute on it. Never see it.**

A salary predictor where the company's model never once touches a raw number —<br>
every value it computes on is homomorphically encrypted, start to finish.

<br>

![Python](https://img.shields.io/badge/Python-3.13-3776ab?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-backend-000000?logo=flask&logoColor=white)
![Paillier](https://img.shields.io/badge/Paillier-partial_HE-2557b0)
![scikit--learn](https://img.shields.io/badge/scikit--learn-linear_regression-f7931e?logo=scikitlearn&logoColor=white)
![Status](https://img.shields.io/badge/status-personal_project_·_demo-8a94a6)

<br>

<sub>A personal project by <b><a href="https://github.com/abheet19">Abheet</a></b> — a small, honest demo of partial homomorphic encryption applied to ML inference. Not production-hardened; see <a href="#-what-it-doesnt-do-yet">what it doesn't do yet</a>.</sub>

<br>

</div>

> [!NOTE]
> **No live deployment yet.** The Dockerfile and Cloud Run pipeline below are real and tested locally,
> but there's no hosted instance right now — that needs a backend hosting account I haven't set up.
> Run it locally with the steps in [Install & run](#-install--run); there is no live link to give you.

<div align="center">

`Predict` &nbsp;→&nbsp; `Encrypt` &nbsp;→&nbsp; `Compute` &nbsp;→&nbsp; `Reveal`

</div>

---

<details open>
<summary><b>Contents</b></summary>

- [The problem](#the-problem)
- [How it actually works](#-how-it-actually-works)
- [Tech stack](#-tech-stack)
- [Install & run](#-install--run)
- [Design](#-design)
- [Screenshots](#-screenshots)
- [What it doesn't do yet](#-what-it-doesnt-do-yet)

</details>

---

## The problem

Finance, healthcare, and insurance all want to run predictive models over sensitive data — but
sending that data anywhere in the clear is a compliance problem and a breach waiting to happen.
The usual answer is "we promise not to look." ShieldAI is a small proof that you don't have to
take that promise on faith: the company's model can compute a real prediction **while every
value it touches stays encrypted**, because Paillier encryption lets you add ciphertexts and
scale them by a plaintext constant, and the result decrypts to exactly what you'd get from doing
the arithmetic on the plaintext.

A linear regression model is just weighted sums — which is exactly the arithmetic Paillier
supports. That's the whole trick.

---

## 🔍 How it actually works

```mermaid
sequenceDiagram
    participant U as You (browser)
    participant C as cust.py<br/>(your keys)
    participant S as servercalc.py<br/>(the "company")

    U->>C: age, health score, activity score, gender
    C->>C: generate Paillier keypair (public + private)
    C->>C: encrypt each value with the public key
    C->>S: encrypted values + public key only
    Note over S: linmodel.py's regression coefficients<br/>are plaintext — that part is public
    S->>S: encrypted_salary = Σ (coefficient × encrypted_value)
    Note over S: every operand on the right is still ciphertext;<br/>S never reconstructs a plaintext feature
    S->>U: encrypted_salary + public key
    U->>U: decrypt with the private key that never left this session
```

Four moving pieces, one per step in the nav bar:

1. **`cust.py` — keys and encryption.** `storeKeys()` generates a fresh Paillier keypair
   (`generate_paillier_keypair()`) and writes it to `custkeys.json`. `serializeDataCustomer()`
   encrypts each feature (age, healthy-eating score, active-lifestyle score, gender) individually
   with the public key — four separate ciphertexts, not one blob.
2. **`linmodel.py` — the model.** A plain `scikit-learn` `LinearRegression` trained on
   `employee_data.csv`. Its coefficients are ordinary floats; they are the *only* thing about the
   model that's public, and floats aren't sensitive the way a customer's raw inputs are.
3. **`servercalc.py` — the computation.** `computeData()` reconstructs the four `EncryptedNumber`
   objects from what the client sent and computes
   `sum(coefficient[i] * encrypted_feature[i] for i in range(4))`. Paillier's homomorphic
   properties make `plaintext × ciphertext` and `ciphertext + ciphertext` both valid operations
   that stay encrypted — so this line runs real modular exponentiation on numbers the server can
   never read, and the accumulated result is still one ciphertext.
4. **`app.py`'s `/result` route — the reveal.** The encrypted salary comes back to the browser
   along with the public key it was encrypted under. Only the private key — generated in step 1
   and never sent anywhere — can turn that ciphertext into the number `21767.82`. The result page
   now shows both side by side: the ciphertext blob the server computed on, and the plaintext only
   you can see, so the claim is something you can look at rather than just read.

The one place this demo cuts a corner on purpose: `custkeys.json`, `data.json`, and `answer.json`
are server-side files, not session-scoped, so it's a single-user demo, not a multi-tenant service.
That's a demo simplification, not a claim about the crypto.

---

## 🛠 Tech stack

| Layer | Technology | Role |
|---|---|---|
| **Encryption** | [`phe`](https://github.com/data61/python-paillier) | Paillier partial homomorphic encryption — keygen, encrypt, homomorphic add/scale |
| **ML** | scikit-learn | `LinearRegression` trained on `employee_data.csv` |
| **Data handling** | numpy, pandas | Feature/target prep for training |
| **Backend** | Flask | Routes for each step of the pipeline; Jinja2 templates |
| **Frontend** | Bootstrap 5 (grid/forms) + hand-written CSS | Steel-blue glass UI, no JS framework |
| **Server** | Gunicorn | WSGI server for the Docker image |
| **Deploy config** | Docker, Cloud Build, GitHub Actions | Present and tested locally; not currently deployed |

---

## 🚀 Install & run

The pinned `requirements.txt` (`cryptography==2.8`, Flask 1.1.1, etc.) targets Python 3.8 and
doesn't build on current Python — `cryptography==2.8` has no wheel for modern CPython and no
working sdist build under current toolchains. Nothing in this app imports `cryptography` directly,
so the fix is to install current, unpinned versions of what's actually used:

```powershell
git clone https://github.com/abheet19/ShieldAI.git
cd ShieldAI

pip install flask gunicorn phe numpy pandas scikit-learn

python app.py
```

Open `http://localhost:8080` (or whatever port you see in the console — `8080` is sometimes taken
by something else on Windows, in which case pass a different port to `app.run()`).

<details>
<summary><b>Retraining the model</b></summary>

<br>

```powershell
python train.py
```

Regenerates the linear regression coefficients from `employee_data.csv`. The live prediction path
(`servercalc.py`) trains fresh from the CSV on each request rather than loading a pickle, so this
step is optional unless you've changed the training data.

</details>

---

## 🎨 Design

Dark ground (`#0A0D12`) with glass-morphism cards, matching the visual family of my other
side projects but with its own palette: a steel-blue gradient family —
`#7CA6F7` → `#4F8EF7` → `#2557B0` — rather than the violet/copper/emerald/rose accents used
elsewhere. The brand mark is a hexagonal shield plate built in the same three-depth-plane
construction (cast / flank / face) as those other marks, which is a deliberate nod to what the
product actually is: privacy as a shield around your data. That same beveled-edge motif reappears
as a thin top facet on every card, rather than drawing a literal shield on each one.

Typography is Space Grotesk (display) + Inter (body) + JetBrains Mono (keys and ciphertext blocks)
— monospace specifically so a 300-digit ciphertext doesn't visually apologize for its size.

---

## 📸 Screenshots

> Placeholders — real captures still need to be taken and dropped in under `docs/screenshots/`.

| Step | Preview |
|---|---|
| 1 · Predict (validation) | `docs/screenshots/01-predict.png` *(needs capture)* |
| 2 · Encrypt (keypair) | `docs/screenshots/02-encrypt.png` *(needs capture)* |
| 3 · Compute (ciphertext) | `docs/screenshots/03-compute.png` *(needs capture)* |
| 4 · Reveal (side by side) | `docs/screenshots/04-reveal.png` *(needs capture)* |

---

## 🚧 What it doesn't do yet

- **Single-user only.** Keys and intermediate payloads are process-wide files
  (`custkeys.json`, `data.json`, `answer.json`), not per-session state — two people using the app
  at once would collide.
- **No live deployment.** The Dockerfile and Cloud Build config work; there's no hosted instance
  because that needs a backend hosting account I haven't set up.
- **Regression only.** The README this replaced also claimed classification support; the code in
  this repo only implements linear regression, so that claim is dropped here rather than repeated.
- **No transport encryption.** This is a local demo over plain HTTP — real deployment would need
  TLS in front of it, which is a hosting concern, not a crypto one.

---

<div align="center">

<br>

Built by **[Abheet Singh Isher](https://github.com/abheet19)**

*Privacy shouldn't be a promise. It should be math.*

<br>

</div>
