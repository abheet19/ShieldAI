"""Server-side calculations for Homomorphic Encryption-based Salary Prediction."""

from linmodel import LinModel
import phe as paillier
import json

def getData():
    """
    Load encrypted customer data from data.json.
    
    Returns:
        dict: Encrypted data containing public key and encrypted values.
    """
    with open('data.json', 'r') as file: 
        d = json.load(file)
    data = d  # Changed from data = json.loads(d)
    return data

def computeData():
    """
    Compute the encrypted salary prediction using linear model coefficients.
    
    Steps:
    - Load encrypted data.
    - Retrieve linear model coefficients.
    - Initialize the Paillier public key.
    - Encrypt each feature value.
    - Compute the encrypted salary by summing the products of coefficients and encrypted features.
    
    Returns:
        tuple: (encrypted_salary, public_key)
    """
    # Load the encrypted customer data
    data = getData()
    # Retrieve linear model coefficients and intercept
    model = LinModel()
    mycoef = model.getCoef()
    myintercept = model.getIntercept()
    # Initialize the Paillier public key
    pk = data['public_key']
    pubkey = paillier.PaillierPublicKey(n=int(pk['n']))
    # Reconstruct encrypted numbers from stored ciphertext and exponent
    enc_nums_rec = [paillier.EncryptedNumber(pubkey, int(x[0]), int(x[1])) for x in data['values']]
    # Compute the encrypted risk score: sum of (coefficient * encrypted feature),
    # plus the model intercept. Adding a plaintext scalar to an encrypted number
    # is still a purely additive homomorphic operation (no decryption occurs
    # server-side) - the company never sees any of the underlying feature values.
    results = sum([mycoef[i] * enc_nums_rec[i] for i in range(len(mycoef))]) + myintercept
    return results, pubkey

def serializeDataCompany():
    """
    Serialize the computed encrypted salary and public key for the company.
    
    Returns:
        dict: Serialized data containing public key and encrypted salary values.
    """
    # Compute encrypted salary and retrieve public key
    results, pubkey = computeData()
    encrypted_data = {}
    # Store public key
    encrypted_data['pubkey'] = {'n': pubkey.n}
    # Store encrypted salary as ciphertext and exponent
    encrypted_data['values'] = (str(results.ciphertext()), results.exponent)
    return encrypted_data