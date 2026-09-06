"""Flask application for Homomorphic Encryption-based Loan Risk Assessment."""

from flask import Flask, request, render_template
import json
from os import path
from cust import *
from servercalc import *

app = Flask(__name__)

@app.route('/', methods=['GET', 'POST'])
def home():
    """
    Render the home page.
    
    Returns:
        Rendered index.html template.
    """
    return render_template('index.html')

@app.route('/customerEncryption', methods=['GET', 'POST'])
def customerEncryption():
    """
    Handle customer encryption data submission.
    
    - Generates encryption keys if not present.
    - Encrypts customer data and saves it to data.json.
    - Renders the cust.html template with encryption keys.
    
    Returns:
        Rendered cust.html template with keys.
    """
    # Check if encryption keys exist; if not, generate and store them
    if not path.exists('custkeys.json'):
        storeKeys()
        
    # Retrieve existing encryption keys
    pub_key, priv_key = getKeys()
    
    # Extract features from the form and convert them to integers
    features = [int(x) for x in request.form.values()]
    # Serialize and encrypt the customer data
    datafileCustomer = serializeDataCustomer(pub_key, features)
    # Save encrypted data to data.json
    with open('data.json', 'w') as file: 
        json.dump(datafileCustomer, file)
    
    # Prepare keys to send to the frontend
    keys = {'public_key': pub_key, 'private_key': priv_key}
    # Render the customer details page with keys
    return render_template('cust.html', keys=keys)

@app.route('/company', methods=['GET', 'POST'])
def company():
    """
    Handle company data submission for salary prediction.
    
    - Serializes and computes encrypted data.
    - Saves the result to answer.json.
    - Renders the company.html template with encrypted data.
    
    Returns:
        Rendered company.html template with encrypted data.
    """
    # Serialize data for the company and compute encrypted results
    datafileCompany = serializeDataCompany()
    # Save encrypted company data to answer.json
    with open('answer.json', 'w') as file:
        json.dump(datafileCompany, file)
        
    # Render the company details page with encrypted data
    return render_template('company.html', datafileCompany=datafileCompany)

# Risk bands for the decrypted score. This banding only ever runs on
# plaintext the customer just decrypted with their own private key - the
# company/server side never sees the score or the band, only ciphertext.
RISK_BANDS = [
    (35, 'low', 'Low risk', 'Likely approved'),
    (65, 'medium', 'Review recommended', 'Falls in a manual-review range'),
    (101, 'high', 'High risk', 'Likely declined'),
]


def bandForScore(score):
    """
    Map a numeric risk score to a (level, label, detail) band.

    Args:
        score (float): risk score, expected roughly in 0-100 (lower = safer).

    Returns:
        dict: {'level', 'label', 'detail'} describing the band.
    """
    for threshold, level, label, detail in RISK_BANDS:
        if score < threshold:
            return {'level': level, 'label': label, 'detail': detail}
    return {'level': 'high', 'label': 'High risk', 'detail': 'Likely declined'}


@app.route('/result', methods=['GET', 'POST'])
def result():
    """
    Process the encrypted data to decrypt and display the loan risk score.

    Steps:
    - Load encrypted answer from answer.json.
    - Decrypt the result using customer's private key.
    - Clamp/round the score and map it to a risk band.
    - Render the result.html template with the final result.

    Returns:
        Rendered result.html template with the final risk score and band.
    """
    # Load the encrypted answer data
    answer_file = loadAnswer()
    # Initialize the public key from the answer file
    answer_key = paillier.PaillierPublicKey(n=int(answer_file['pubkey']['n']))
    # Unpack the ciphertext and exponent
    ciphertext_str, exponent = answer_file['values']  # Changed from answer_file['values'][0]
    # Create an EncryptedNumber instance
    answer = paillier.EncryptedNumber(answer_key, int(ciphertext_str), exponent)
    # Retrieve customer's keys
    pub_key, priv_key = getKeys()
    band = None
    gauge_pct = None
    if answer_key.n == pub_key.n:
        # Decrypt the answer using the private key
        raw_result = priv_key.decrypt(answer)
        # The model is a plain linear regression fit on synthetic data, so a
        # prediction can land slightly outside [0, 100]; clamp for display
        # since the score is only ever presented as a 0-100 scale.
        final_result = round(max(0.0, min(100.0, raw_result)), 1)
        band = bandForScore(final_result)
        gauge_pct = final_result
    else:
        final_result = "Keys do not match."

    # Render the result page with both the encrypted payload the company
    # computed on and the final plaintext risk score, so the "computed
    # without seeing plaintext" claim is visible side by side, not just
    # asserted.
    encrypted_payload = {
        'public_key': answer_file['pubkey'],
        'ciphertext': ciphertext_str,
        'exponent': exponent,
    }
    return render_template(
        'result.html',
        final_result=final_result,
        band=band,
        gauge_pct=gauge_pct,
        encrypted_payload=encrypted_payload,
    )

if __name__ == "__main__":
    app.run(debug=False, host='0.0.0.0', port=8080)