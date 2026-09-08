import phe as paillier

from app import FEATURES, WEIGHTS, create_app


def make_envelope(values: dict[str, int]):
    public_key, private_key = paillier.generate_paillier_keypair(n_length=1024)
    payload = {
        "public_key": {"n": str(public_key.n)},
        "encrypted_values": {field: str(public_key.encrypt(value).ciphertext()) for field, value in values.items()},
    }
    return public_key, private_key, payload


def sample_values() -> dict[str, int]:
    return {
        "debt_to_income_bps": 1400,
        "loan_to_income_bps": 2350,
        "utilization_bps": 3000,
        "stability_gap_months": 60,
    }


def test_health_describes_browser_private_key_boundary():
    response = create_app().test_client().get("/health")
    assert response.status_code == 200
    assert response.json["raw_input_handling"] == "not accepted by the evaluator"


def test_rejects_raw_incomplete_or_expensive_key_envelopes():
    client = create_app().test_client()
    assert client.post("/api/v1/private-evaluations", json={"annual_income": 85_000}).status_code == 400
    assert client.post("/api/v1/private-evaluations", json={"public_key": {"n": "7"}, "encrypted_values": {}}).status_code == 400
    too_large_key = str((1 << 2048) - 159)
    payload = {"public_key": {"n": too_large_key}, "encrypted_values": {field: "1" for field in FEATURES}}
    assert client.post("/api/v1/private-evaluations", json=payload).status_code == 400


def test_evaluator_returns_a_ciphertext_that_the_client_key_can_decrypt():
    values = sample_values()
    public_key, private_key, payload = make_envelope(values)
    response = create_app().test_client().post("/api/v1/private-evaluations", json=payload)

    assert response.status_code == 200
    encrypted = paillier.EncryptedNumber(public_key, int(response.json["encrypted_result"]["ciphertext"]), exponent=0)
    assert private_key.decrypt(encrypted) == sum(WEIGHTS[field] * value for field, value in values.items())
    assert "private key" in response.json["privacy_notice"].lower()
    assert response.headers["Cache-Control"] == "no-store"


def test_evaluator_enforces_a_per_client_budget():
    client = create_app(evaluation_limit=1).test_client()
    _, _, payload = make_envelope(sample_values())
    assert client.post("/api/v1/private-evaluations", json=payload).status_code == 200
    limited = client.post("/api/v1/private-evaluations", json=payload)
    assert limited.status_code == 429
    assert int(limited.headers["Retry-After"]) >= 1
