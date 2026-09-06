"""Generate a small, honestly-synthetic loan-risk training set.

ShieldAI is a demo of Paillier homomorphic encryption, not a real credit
model. There is no real lender data behind this file. Risk scores below are
built from a simple, documented linear formula plus Gaussian noise, so that
a plain LinearRegression trained on it recovers sensible, demo-appropriate
coefficients (safer borrowers -> lower score). Do not use this data or the
model trained on it for any real underwriting decision.

Run with `python generate_loan_data.py` to regenerate loan_data.csv.
"""

import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)
N = 600


def main():
    annual_income = RNG.uniform(15000, 180000, N).round(0)
    existing_debt = RNG.uniform(0, 80000, N).round(0)
    credit_utilization_pct = RNG.uniform(0, 100, N).round(1)
    employment_years = RNG.uniform(0, 35, N).round(1)
    requested_loan_amount = RNG.uniform(2000, 120000, N).round(0)

    # Ground-truth formula (documented assumption, not a real risk model):
    # higher income / longer employment -> lower risk; higher debt, higher
    # utilization, and a bigger ask relative to income -> higher risk.
    risk_score = (
        50
        - 0.00075 * annual_income
        + 0.0011 * existing_debt
        + 0.32 * credit_utilization_pct
        - 1.1 * employment_years
        + 0.00035 * requested_loan_amount
    )
    risk_score = risk_score + RNG.normal(0, 4, N)
    risk_score = risk_score.clip(0, 100).round(1)

    df = pd.DataFrame(
        {
            "annual_income": annual_income,
            "existing_debt": existing_debt,
            "credit_utilization_pct": credit_utilization_pct,
            "employment_years": employment_years,
            "requested_loan_amount": requested_loan_amount,
            "risk_score": risk_score,
        }
    )
    df.to_csv("loan_data.csv", index=False)
    print(f"Wrote loan_data.csv with {len(df)} synthetic rows.")


if __name__ == "__main__":
    main()
