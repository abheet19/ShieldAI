"""Customer-side encryption handling for Homomorphic Encryption-based Salary Prediction."""

import phe as paillier
import json

def storeKeys():
    """
    Generate and store the Paillier public and private keys.
    
    The keys are saved to 'custkeys.json' in JSON format.
    """
    # Generate Paillier key pair
    public_key, private_key = paillier.generate_paillier_keypair()
    keys = {}
    # Serialize public key
    keys['public_key'] = {'n': public_key.n}
    # Serialize private key components
    keys['private_key'] = {'p': private_key.p, 'q': private_key.q}
    # Save keys to custkeys.json
    with open('custkeys.json', 'w') as file: 
        json.dump(keys, file)

def getKeys():
    """
    Retrieve the Paillier public and private keys from 'custkeys.json'.
    
    Returns:
        tuple: (PaillierPublicKey, PaillierPrivateKey)
    """
    with open('custkeys.json', 'r') as file:
        keys = json.load(file)
    # Reconstruct public key
    pub_key = paillier.PaillierPublicKey(n=int(keys['public_key']['n']))
    # Reconstruct private key
    priv_key = paillier.PaillierPrivateKey(pub_key, int(keys['private_key']['p']), int(keys['private_key']['q']))
    return pub_key, priv_key 

def serializeDataCustomer(public_key, data):
    """
    Encrypt customer data using the provided public key.
    
    Args:
        public_key (PaillierPublicKey): The public key for encryption.
        data (list): List of integer features to encrypt.
    
    Returns:
        dict: Serialized encrypted data containing public key and encrypted values.
    """
    # Encrypt each data feature
    encrypted_data_list = [public_key.encrypt(x) for x in data]
    encrypted_data = {}
    # Store public key
    encrypted_data['public_key'] = {'n': public_key.n}
    # Store encrypted features as ciphertext and exponent tuples
    encrypted_data['values'] = [(str(x.ciphertext()), x.exponent) for x in encrypted_data_list]
    # Return as a dictionary instead of a JSON string
    return encrypted_data

def loadAnswer():
    """
    Load the encrypted answer data from 'answer.json'.
    
    Returns:
        dict: Encrypted answer data.
    """
    with open('answer.json', 'r') as file:
        ans = json.load(file)
        return ans

