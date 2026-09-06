"""Reference training script: fits the same LinearRegression the live app
trains on every request (see linmodel.py) and prints its coefficients.

Not required at runtime - servercalc.py trains fresh from loan_data.csv on
every /company request via LinModel(). This script exists so the model's
behavior can be inspected/reproduced offline without spinning up the app.
"""

import pandas as pd
from linmodel import LinModel


def main():
    # Load the synthetic loan-risk data (see generate_loan_data.py for how
    # it was produced - it is not real applicant data).
    df = pd.read_csv('loan_data.csv')
    model = LinModel()
    reg, y_pred, rmse, r2 = model.getResults()
    print("features:", list(df.drop('risk_score', axis=1).columns))
    print("coefficients:", reg.coef_)
    print("intercept:", reg.intercept_)
    print(f"RMSE: {rmse:.2f}  R2: {r2:.3f}")


if __name__ == "__main__":
    main()
