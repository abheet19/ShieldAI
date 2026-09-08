"""ShieldAI: browser-key Paillier privacy demonstration.

The browser creates the Paillier keypair, keeps the private key in memory, and
sends only a public modulus plus encrypted derived indicator values. The server
computes a transparent weighted sum without seeing raw financial values.
Educational demo only: never a lending, eligibility, or financial-advice tool.
"""
from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from math import gcd
from threading import Lock
from typing import Mapping

import phe as paillier
from flask import Flask, jsonify, render_template, request

FEATURES = ("debt_to_income_bps", "loan_to_income_bps", "utilization_bps", "stability_gap_months")
WEIGHTS = {
    "debt_to_income_bps": 5,
    "loan_to_income_bps": 4,
    "utilization_bps": 3,
    "stability_gap_months": 200,
}
PAILLIER_MODULUS_BITS = 1024
MAX_CIPHERTEXT_CHARS = 700
MAX_REQUEST_BYTES = 12_000
DEFAULT_EVALUATIONS_PER_HOUR = 8


class ValidationError(ValueError):
    """Raised when an encrypted evaluation envelope is malformed."""


class RequestLimiter:
    """Small process-local budget for the CPU-bound educational evaluator."""

    def __init__(self, limit: int, window_seconds: int = 3600) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self.events: dict[str, deque[float]] = defaultdict(deque)
        self.lock = Lock()

    def retry_after(self, key: str) -> int | None:
        now = time.monotonic()
        with self.lock:
            events = self.events[key]
            cutoff = now - self.window_seconds
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= self.limit:
                return max(1, int(events[0] + self.window_seconds - now))
            events.append(now)
        return None


@dataclass(frozen=True)
class EncryptedEvaluation:
    public_key: paillier.PaillierPublicKey
    values: Mapping[str, paillier.EncryptedNumber]

    @classmethod
    def from_payload(cls, raw: object) -> "EncryptedEvaluation":
        if not isinstance(raw, dict):
            raise ValidationError("Send a JSON object.")
        if set(raw) != {"public_key", "encrypted_values"}:
            raise ValidationError("Send only public_key and encrypted_values; raw inputs are not accepted.")
        key = raw.get("public_key")
        values = raw.get("encrypted_values")
        if not isinstance(key, dict) or not isinstance(values, dict):
            raise ValidationError("Include public_key and encrypted_values objects.")
        if set(key) != {"n"} or set(values) != set(FEATURES):
            raise ValidationError("Send exactly the documented public key and encrypted indicator fields.")
        try:
            modulus = int(key["n"])
        except (KeyError, TypeError, ValueError) as error:
            raise ValidationError("public_key.n must be a decimal integer.") from error
        if modulus.bit_length() != PAILLIER_MODULUS_BITS or modulus % 2 == 0:
            raise ValidationError(f"public_key.n must be an odd {PAILLIER_MODULUS_BITS}-bit Paillier modulus.")

        public_key = paillier.PaillierPublicKey(modulus)
        n_square = modulus * modulus
        encrypted: dict[str, paillier.EncryptedNumber] = {}
        for field in FEATURES:
            ciphertext_text = values[field]
            if not isinstance(ciphertext_text, str) or not ciphertext_text.isdecimal():
                raise ValidationError(f"encrypted_values.{field} must be a decimal ciphertext.")
            if len(ciphertext_text) > MAX_CIPHERTEXT_CHARS:
                raise ValidationError(f"encrypted_values.{field} is too large.")
            ciphertext = int(ciphertext_text)
            if not 0 < ciphertext < n_square or gcd(ciphertext, modulus) != 1:
                raise ValidationError(f"encrypted_values.{field} is not a valid Paillier ciphertext.")
            encrypted[field] = paillier.EncryptedNumber(public_key, ciphertext, exponent=0)
        return cls(public_key=public_key, values=encrypted)


def encrypted_weighted_sum(evaluation: EncryptedEvaluation) -> paillier.EncryptedNumber:
    """Compute only on ciphertexts; this process never has a private key."""
    result = evaluation.public_key.encrypt(0)
    for field, weight in WEIGHTS.items():
        result += evaluation.values[field] * weight
    return result


def client_key() -> str:
    """Use Fly's proxy-supplied client address; do not trust user X-Forwarded-For."""
    return request.headers.get("Fly-Client-IP", "").strip() or request.remote_addr or "unknown"


def create_app(*, evaluation_limit: int | None = None) -> Flask:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_REQUEST_BYTES
    limit = evaluation_limit if evaluation_limit is not None else int(os.getenv("SHIELDAI_EVALUATIONS_PER_HOUR", DEFAULT_EVALUATIONS_PER_HOUR))
    if limit < 1:
        raise ValueError("SHIELDAI_EVALUATIONS_PER_HOUR must be positive.")
    limiter = RequestLimiter(limit)
    app.extensions["private_evaluation_limiter"] = limiter

    @app.after_request
    def security_headers(response):
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        return response

    @app.get("/")
    def home():
        return render_template("index.html")

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "service": "shieldai",
            "mode": "browser-private-key-paillier-demo",
            "persistence": "none",
            "raw_input_handling": "not accepted by the evaluator",
            "evaluation_budget": f"{limit} requests per client per hour",
        }

    @app.post("/api/v1/private-evaluations")
    def private_evaluation():
        retry_after = limiter.retry_after(client_key())
        if retry_after is not None:
            response = jsonify({"error": "Evaluation budget reached. Try again later."})
            response.headers["Retry-After"] = str(retry_after)
            return response, 429
        try:
            evaluation = EncryptedEvaluation.from_payload(request.get_json(silent=True))
        except ValidationError as error:
            return jsonify({"error": str(error)}), 400
        result = encrypted_weighted_sum(evaluation)
        return jsonify(
            {
                "encrypted_result": {"ciphertext": str(result.ciphertext()), "exponent": result.exponent},
                "model": {
                    "id": "transparent-pressure-indicator-v1",
                    "normalization_divisor": 1000,
                    "weights": WEIGHTS,
                },
                "privacy_notice": (
                    "The evaluator received a public key and encrypted derived indicators only. "
                    "The browser retains the private key in memory and decrypts the result locally."
                ),
            }
        )

    return app


app = create_app()
