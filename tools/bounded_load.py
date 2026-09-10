"""Run a bounded, local concurrency probe against the real encrypted evaluator."""

from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from statistics import mean, median

import phe as paillier

from app import create_app

TOTAL_REQUESTS = 30
CONCURRENCY = 6
EVALUATION_LIMIT = 8


def percentile(values: list[float], percentile_value: float) -> float:
    ordered = sorted(values)
    index = min(len(ordered) - 1, round((len(ordered) - 1) * percentile_value))
    return ordered[index]


public_key, _ = paillier.generate_paillier_keypair(n_length=1024)
sample = {
    "debt_to_income_bps": 1400,
    "loan_to_income_bps": 2350,
    "utilization_bps": 3000,
    "stability_gap_months": 60,
}
envelope = {
    "public_key": {"n": str(public_key.n)},
    "encrypted_values": {name: str(public_key.encrypt(value).ciphertext()) for name, value in sample.items()},
}
app = create_app(evaluation_limit=EVALUATION_LIMIT)
app.logger.disabled = True


def evaluate(_: int) -> tuple[int, float]:
    started = time.perf_counter()
    with app.test_client() as client:
        response = client.post("/api/v1/private-evaluations", json=envelope)
    return response.status_code, (time.perf_counter() - started) * 1000


with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
    results = list(executor.map(evaluate, range(TOTAL_REQUESTS)))

statuses = [status for status, _ in results]
durations = [duration for _, duration in results]
report = {
    "environment": "Flask in-process clients using real Paillier ciphertext arithmetic",
    "requests": TOTAL_REQUESTS,
    "concurrency": CONCURRENCY,
    "evaluation_limit": EVALUATION_LIMIT,
    "status_counts": {str(status): statuses.count(status) for status in sorted(set(statuses))},
    "duration_ms": {
        "mean": round(mean(durations), 2),
        "median": round(median(durations), 2),
        "p95": round(percentile(durations, 0.95), 2),
        "max": round(max(durations), 2),
    },
}

assert report["status_counts"] == {"200": EVALUATION_LIMIT, "429": TOTAL_REQUESTS - EVALUATION_LIMIT}
output_path = os.getenv("SHIELDAI_LOAD_EVIDENCE")
if output_path:
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, separators=(",", ":")))
