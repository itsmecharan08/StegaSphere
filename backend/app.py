
# ------------------ Place this after Flask app initialization ------------------ #

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv() # Load environment variables from .env file

import threading
import time
import requests
import numpy as np
import cv2
import wave
import tempfile
import base64
import os
import hashlib
import zlib  # Added for compression
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from Crypto.Util.Padding import pad, unpad
from Crypto.Util import Counter
from web3 import Web3

# Fix for web3.py v7+ middleware change
try:
    from web3.middleware import geth_poa_middleware
except ImportError:
    from web3.middleware import ExtraDataToPOAMiddleware as geth_poa_middleware

import json
import google.generativeai as genai

# Configure Gemini
GENAI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GENAI_API_KEY:
    genai.configure(api_key=GENAI_API_KEY)
else:
    print("WARNING: GEMINI_API_KEY not found. Chatbot will not function.")

# ------------------ Initialize Flask ------------------ #
app = Flask(__name__)
CORS(app, expose_headers=["Content-Disposition"])

# Add request logging for debugging
@app.before_request
def log_request():
    print(f"DEBUG: Request to {request.endpoint} - {request.method} {request.path}")
    # print(f"DEBUG: Files: {list(request.files.keys())}")
    # print(f"DEBUG: Form: {dict(request.form)}")


# ==========================================
#      BLOCKCHAIN RELAYER SYSTEM
# ==========================================

# 1. DETAILS (Update these in .env or hardcode here for testing)
# TODO: User must provide these values
RPC_URL = os.environ.get("RELAYER_RPC_URL", "https://eth-sepolia.g.alchemy.com/v2/i5jbjdp0FVV6781EUxn1a")
RELAYER_PRIVATE_KEY = os.environ.get("RELAYER_PRIVATE_KEY", "ed8f404df66809acfaca30062ece3bb9c13821aa3d83ec9080281dfd74b83e26") 
CONTRACT_ADDRESS = os.environ.get("CONTRACT_ADDRESS", "0x79086465d35Bb9672820C4582d06cc14691FE383")

# 2. CONTRACT ABI (Minimal version for 'addLog')
CONTRACT_ABI = [
    {
        "inputs": [
            {"internalType": "string", "name": "action", "type": "string"},
            {"internalType": "string", "name": "technique", "type": "string"},
            {"internalType": "string", "name": "dataHash", "type": "string"},
            {"internalType": "string", "name": "vaultId", "type": "string"}
        ],
        "name": "addLog",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

# 3. INITIALIZE CONNECTION
w3 = None
relayer_account = None
contract = None

def init_relayer():
    global w3, relayer_account, contract
    try:
        # Check if dummy values are still present
        if "YOUR_" in RPC_URL or "YOUR_" in RELAYER_PRIVATE_KEY:
            print("DEBUG: Relayer credentials not set. Relayer disabled.")
            return

        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        # Inject middleware for PoA chains like Sepolia
        w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
        if w3.is_connected():
            relayer_account = w3.eth.account.from_key(RELAYER_PRIVATE_KEY)
            contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)
            print(f"DEBUG: Relayer System Online. Gas Payer: {relayer_account.address}")
        else:
            print("DEBUG: Could not connect to Blockchain RPC")
    except Exception as e:
        print(f"DEBUG: Relayer Init Failed (Check config): {e}")

# Initialize on startup
init_relayer()

def execute_blockchain_transaction(action, technique, data_hash, vault_id):
    """
    Signs and sends a transaction from the Python Backend
    """
    if not w3 or not contract:
        # Try re-init in case env vars changed or transient issue
        init_relayer()
        if not w3 or not contract:
            return {"success": False, "error": "Blockchain relayer not configured or unreachable"}

    try:
        # 1. Get the 'Nonce' (Transaction Count for the admin wallet)
        nonce = w3.eth.get_transaction_count(relayer_account.address)

        # 2. Build the Transaction
        # Fetch dynamic chain ID to avoid mismatch errors
        chain_id = w3.eth.chain_id
        
        # FIX: 'replacement transaction underpriced'
        # This happens if a pending tx exists with same nonce but lower gas price.
        # We fetch pending transaction count to ensure we use the next available nonce.
        nonce = w3.eth.get_transaction_count(relayer_account.address, 'pending')
        
        # Increase Gas Price slightly (10%) to ensure it goes through
        gas_price = int(w3.eth.gas_price * 1.1)

        tx_build = contract.functions.addLog(
            action,
            technique,
            data_hash,
            vault_id
        ).build_transaction({
            'chainId': chain_id, 
            'gas': 500000,       
            'gasPrice': gas_price,
            'nonce': nonce,
        })

        # 3. Sign the Transaction
        signed_tx = w3.eth.account.sign_transaction(tx_build, RELAYER_PRIVATE_KEY)

        # 4. Broadcast to Network
        # IMPORTANT: in web3.py Python, use .raw_transaction (snake_case)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        
        return {"success": True, "tx_hash": w3.to_hex(tx_hash)}

    except Exception as e:
        print(f"TX Error: {e}")
        return {"success": False, "error": str(e)}

@app.route('/api/log-transaction', methods=['POST'])
def relay_log_endpoint():
    """
    Frontend calls this endpoint. Backend pays the gas.
    """
    try:
        data = request.json
        if not data:
             return jsonify({"error": "No JSON data provided"}), 400

        user_wallet = data.get('userWallet', 'Anonymous')
        raw_action = data.get('action', 'Encode')
        technique = data.get('technique', 'Unknown')
        data_hash = data.get('dataHash', '0x')
        vault_id = data.get('vaultId', 'na')

        # Combine Action + UserWallet for accountability in the log
        # because the blockchain sender is now the Admin/Relayer.
        final_action = f"{raw_action}|{user_wallet}"

        print(f"DEBUG: Relaying transaction (User: {user_wallet})")
        
        result = execute_blockchain_transaction(final_action, technique, data_hash, vault_id)
        
        if result.get("success"):
            return jsonify(result), 200
        else:
            return jsonify(result), 500
    except Exception as e:
        print(f"Relay Endpoint Error: {e}")
        return jsonify({"error": str(e)}), 500

# ==========================================
#      MULTILAYER SPECIFIC FUNCTIONS
# ==========================================
# Isolated functions to ensure Multilayer stability regardless of Single-Layer tool changes.

def multilayer_txt_encode(text, cover_text_path, output_file):
    """
    Dedicated Text Encoder for Multilayer.
    - Uses ZWC (Zero Width Characters).
    - Robust reading of cover file.
    - Does NOT use '111111111111' terminator in the same way? 
      Actually, we should use it to be consistent, but we can make it more unique if needed.
      For now, exact replication of the working logic is best, but ISOLATED.
    """
    try:
        encoded_bytes = text.encode('utf-8')
        binary_text = ''.join([format(b, '08b') for b in encoded_bytes])
        binary_text += '111111111111'  # 12-bit terminator

        with open(cover_text_path, "r", encoding="utf-8", errors='ignore') as file:
            cover_data = file.read()
            words = cover_data.split()

        if not words: words = ["Safe", "Cover", "Generated"]

        required_words = (len(binary_text) // 12) + 1
        if required_words > len(words):
            multiplier = (required_words // len(words)) + 1
            words = words * multiplier

        with open(output_file, "w", encoding="utf-8") as file:
            for i, word in enumerate(words):
                if i * 12 < len(binary_text): 
                    start_idx = i * 12
                    end_idx = min((i + 1) * 12, len(binary_text))
                    bits = binary_text[start_idx:end_idx]
                    zwc_chars = ''.join(ZWC[bits[j:j+2]] for j in range(0, len(bits), 2))
                    file.write(word + zwc_chars + " ")
                else:
                    file.write(word + " ")
        return True
    except Exception as e:
        print(f"ERROR: multilayer_txt_encode failed: {e}")
        return False

def multilayer_txt_decode(stego_file):
    """
    Dedicated Text Decoder for Multilayer.
    - Optimized for large files (Chunk reading).
    - Robust error handling.
    """
    binary_data_list = []
    try:
        with open(stego_file, "r", encoding="utf-8", errors='ignore') as file:
            while True:
                chunk = file.read(1024 * 1024) # 1MB chunks
                if not chunk: break
                for char in chunk:
                    if char in ZWC_reverse:
                        binary_data_list.append(ZWC_reverse[char])
        
        binary_data = "".join(binary_data_list)
        
        term_pos = binary_data.find("111111111111")
        if term_pos != -1:
            binary_data = binary_data[:term_pos]
            
        byte_array = bytearray()
        for i in range(0, len(binary_data), 8):
            if i + 8 <= len(binary_data):
                byte_array.append(int(binary_data[i:i+8], 2))
        
        # Multilayer payloads are often Base64 or ZLIB, so Utf-8 decode should work.
        # But if it's raw binary data (unlikely if formatted correctly), we fallback.
        try: return byte_array.decode('utf-8')
        except: return byte_array.decode('latin-1', errors='ignore')
        
    except Exception as e:
        print(f"ERROR: multilayer_txt_decode failed: {e}")
        return ""

def multilayer_img_encode(img, secret_string, output_file):
    """Isolated Image Encoder (Vectorized for Speed)"""
    # NO TRY/EXCEPT here - let the specific error bubble up to the user
    data = secret_string + '*^*^*'
    
    # 1. Convert data to bytes for faster processing
    if isinstance(data, str):
        data_bytes = data.encode('utf-8')
    else:
        data_bytes = data
        
    # 2. Convert to bits using numpy
    payload_arr = np.frombuffer(data_bytes, dtype=np.uint8)
    payload_bits = np.unpackbits(payload_arr)
    
    needed_bits = len(payload_bits)
    flat_img = img.reshape(-1)
    
    if needed_bits > len(flat_img):
         # Calculate readable sizes for the error message
         needed_pixels = needed_bits
         available_pixels = len(flat_img)
         # Assuming 1 bit per pixel LSB
         raise ValueError(f"The Image is too small. We need {needed_pixels} pixels to hide this data, but the image only has {available_pixels} pixels. Please choose a larger image or a smaller secret.")
         
    # 3. Vectorized Embedding
    # Only modify the exact number of pixels needed
    
    # Get target slice
    target_pixels = flat_img[:needed_bits]
    
    # Apply LSB steganography: clear LSB, OR with payload bit
    # (pixel & 0xFE) | bit
    target_pixels[:] = (target_pixels & 0xFE) | payload_bits
    
    # Update the main array
    flat_img[:needed_bits] = target_pixels
    
    # Reshape back (actually flat_img is a view so img might be updated? 
    # But reshape(-1) usually returns a copy if non-contiguous, or view if contiguous.
    # cv2 images are usually contiguous. But to be safe we assign back.)
    
    img_result = flat_img.reshape(img.shape)
        
    cv2.imwrite(output_file, img_result)
    return True

def multilayer_img_decode(img):
    """Isolated Image Decoder"""
    try:
        # Optimized: We can't easily extract ALL bits then check. 
        # We should check for terminator on the fly if possible, OR just grab a large chunk?
        # Standard implementation grabs all bits. For 4K images this is slow.
        # Let's use a generator or limits?
        # For now, replicate standard logic but isolated.
        
        # Flatten for performance (Vectorized LSB collection)
        # 1. Flatten into 1D array of channels
        flat = img.flatten()
        
        # 2. Get LSBs
        # Only take bit 0
        bits = flat & 1
        
        # 3. Pack bits into bytes
        # We need groups of 8 bits.
        # Truncate to multiple of 8
        n_bytes = len(bits) // 8
        bits_truncated = bits[:n_bytes*8]
        
        # Reshape to (N, 8)
        bits_reshaped = bits_truncated.reshape(-1, 8)
        
        # Convert bits to byte values:
        # bit0<<7 | bit1<<6 ...
        # Actually our convention: '01000001' -> int(..., 2). MSB first?
        # In the loop above: `data_binary += str(pixel[k] & 1)` then `int(byte, 2)`
        # This implies standard Big Endian bit interpretation? No.
        # "01000001" means first bit extracted is MSB.
        # Let's verify encoding... 
        # `binary_data += format(ord(i), '08b')` -> 65 = '01000001'.
        # `pixel ... | int(binary_data[index])` -> First pixel gets MSB ('0').
        # So yes, bit 0 is MSB (128).
        
        powers_of_two = np.array([128, 64, 32, 16, 8, 4, 2, 1], dtype=np.uint8)
        bytes_vals = np.packbits(bits_reshaped, axis=1) # packbits default assumes MSB at index 0?
        # packbits: "Elements of input array are treated as... bits... The first ... matches the MSB" (so index 0 is MSB)
        # This matches our expectation.
        
        # Convert to raw bytes string
        # bytes_vals is shape (N, 1) or (N,). Packbits reduces dimension.
        # It actually returns uint8 array.
        
        # Convert to python string/bytes efficiently
        # We need to find the delimiter "*^*^*"
        # Converting entire array to bytes is fast.
        
        raw_data = bytes_vals.tobytes()
        
        delimiter = b"*^*^*"
        end_index = raw_data.find(delimiter)
        
        if end_index != -1:
            return raw_data[:end_index].decode('latin-1') # Return extracted payload (which is encrypted b64 string)
        else:
             # If delimiter not found, return empty or full?
             # If file is full, maybe we missed it or it got cut off.
             # Return everything - user might have huge data filling image.
             return raw_data.decode('latin-1')
             
    except Exception as e:
        print(f"ERROR: multilayer_img_decode failed: {e}")
        return ""


# ------------------ TEXT STEGANOGRAPHY ------------------ #
# Using safer Zero-Width Characters to avoid Bidi state issues and stripping
# ZWSP, ZWNJ, ZWJ, Word Joiner
ZWC = {"00": u'\u200B', "01": u'\u200C', "11": u'\u200D', "10": u'\u2060'}
ZWC_reverse = {v: k for k, v in ZWC.items()}

def txt_encode(text, cover_text_path, output_file):
    # convert text to binary (Robust UTF-8)
    # Ensure we use bytes for consistent 8-bit chunks
    encoded_bytes = text.encode('utf-8')
    binary_text = ''.join([format(b, '08b') for b in encoded_bytes])
    
    # termination marker
    binary_text += '111111111111'  # 12-bit termination marker

    with open(cover_text_path, "r", encoding="utf-8") as file:
        words = file.read().split()

    required_words = (len(binary_text) // 12) + 1
    # Be more lenient with cover text - repeat it if necessary?
    # Or just append dummy words?
    # For now, let's just create a larger word list by repeating
    if required_words > len(words):
        multiplier = (required_words // len(words)) + 1
        words = words * multiplier
        # raise ValueError(f"Cover text too short! Needs at least {required_words} words, but only {len(words)} provided.")

    with open(output_file, "w", encoding="utf-8") as file:
        for i, word in enumerate(words):
            if i * 12 < len(binary_text): 
                # Note: Original logic: 12 bits per word.
                start_idx = i * 12
                end_idx = min((i + 1) * 12, len(binary_text))
                bits = binary_text[start_idx:end_idx]
                zwc_chars = ''.join(ZWC[bits[j:j+2]] for j in range(0, len(bits), 2))
                file.write(word + zwc_chars + " ")
            else:
                file.write(word + " ")

def decode_txt_data(stego_file):
    binary_data_list = []
    try:
        # Optimization: Read in larger chunks and use list append (faster than string concatenation)
        with open(stego_file, "r", encoding="utf-8", errors='ignore') as file:
            while True:
                chunk = file.read(1024 * 1024) # Read 1MB chunks
                if not chunk: 
                    break
                
                # Filter bits from chunk
                for char in chunk:
                    if char in ZWC_reverse:
                        binary_data_list.append(ZWC_reverse[char])
        
        binary_data = "".join(binary_data_list)
                    
    except Exception as e:
        print(f"DEBUG: File Read Error in decode_txt_data: {e}")
        return ""

    term_pattern = "111111111111"
    term_pos = binary_data.find(term_pattern)
    if term_pos != -1:
        binary_data = binary_data[:term_pos]

    # Convert binary to bytes then decode
    byte_array = bytearray()
    for i in range(0, len(binary_data), 8):
        if i + 8 <= len(binary_data):
            byte_str = binary_data[i:i+8]
            byte_array.append(int(byte_str, 2))
            
    try:
        # Strict decode first
        return byte_array.decode('utf-8')
    except Exception as e:
        print(f"DEBUG: Strict decode failed: {e}. Trying replace mode.")
        try:
           # Robust text extraction
           return byte_array.decode('utf-8', errors='ignore') # Changed to ignore to prevent crash
        except Exception as e2:
           print(f"DEBUG: Replace decode also failed: {e2}. Returning latin-1.")
           return byte_array.decode('latin-1', errors='ignore')

# ------------------ IMAGE STEGANOGRAPHY ------------------ #
def msgtobinary(msg):
    if isinstance(msg, str):
        return ''.join([format(ord(i), "08b") for i in msg])
    elif isinstance(msg, (bytes, np.ndarray)):
        return [format(i, "08b") for i in msg]
    elif isinstance(msg, (int, np.uint8)):
        return format(msg, "08b")
    else:
        raise TypeError("Unsupported input type")

def encode_img_data(img, secret_text, output_file):
    data = secret_text + '*^*^*'
    binary_data = msgtobinary(data)
    
    # 2-bit LSB encoding
    flat = img.reshape(-1)
    for i in range(0, len(binary_data), 2):
        if i // 2 < len(flat):
            bits = binary_data[i:i+2]
            if len(bits) == 2:
                flat[i // 2] = (flat[i // 2] & 0xFC) | int(bits, 2)
    
    cv2.imwrite(output_file, flat.reshape(img.shape))

def decode_img_data(img):
    binary_data = ""
    flat = img.reshape(-1)
    for pixel in flat:
        binary_data += format(pixel & 3, '02b')
    
    all_bytes = [binary_data[i:i+8] for i in range(0, len(binary_data), 8)]
    decoded_data = ""
    for byte in all_bytes:
        if len(byte) == 8:
            decoded_data += chr(int(byte, 2))
            if decoded_data.endswith("*^*^*"):
                return decoded_data[:-5]
    return decoded_data

# ------------------ VIDEO STEGANOGRAPHY (AES Version) ------------------ #

def derive_key(password, salt=None):
    """Derive a 32-byte (256-bit) key from password"""
    if salt is None:
        salt = get_random_bytes(16)
    # Use SHA-256 for key derivation
    key = hashlib.sha256(password.encode() + salt).digest()
    return key, salt

def encryption(plaintext, key):
    """Encrypt using AES-CTR mode"""
    try:
        # Derive key from password
        derived_key, salt = derive_key(key)
        
        # Generate random nonce for CTR mode
        nonce = get_random_bytes(8)
        
        # Create counter for CTR mode
        ctr = Counter.new(64, prefix=nonce, initial_value=0)
        
        # Create AES-CTR cipher
        cipher = AES.new(derived_key, AES.MODE_CTR, counter=ctr)
        
        # Encrypt the plaintext
        ciphertext = cipher.encrypt(plaintext.encode())
        
        # Return salt + nonce + ciphertext (all as base64)
        combined = salt + nonce + ciphertext
        return base64.b64encode(combined).decode()
    except Exception as e:
        print(f"Encryption error: {e}")
        return ""

def decryption(ciphertext, key):
    """Decrypt using AES-CTR mode"""
    try:
        # Clean and Fix Base64 Padding
        ciphertext = ciphertext.strip()
        missing_padding = len(ciphertext) % 4
        if missing_padding:
            ciphertext += '=' * (4 - missing_padding)
            
        # Decode from base64
        combined = base64.b64decode(ciphertext)
        
        # Extract components: salt(16) + nonce(8) + actual_ciphertext
        if len(combined) < 24: # Validation
            print("DEBUG: Decryption failed - payload too short")
            return ""

        salt = combined[:16]
        nonce = combined[16:24]
        actual_ciphertext = combined[24:]
        
        # Derive key using the same salt
        derived_key, _ = derive_key(key, salt)
        
        # Recreate counter for CTR mode
        ctr = Counter.new(64, prefix=nonce, initial_value=0)
        
        # Create AES-CTR cipher
        cipher = AES.new(derived_key, AES.MODE_CTR, counter=ctr)
        
        # Decrypt
        plaintext = cipher.decrypt(actual_ciphertext)
        
        try:
             # Strict decode first
             return plaintext.decode('utf-8')
        except UnicodeDecodeError:
             print("DEBUG: UnicodeDecodeError in decryption. Returning raw bytes (likely binary or garbage).")
             # IF IT IS ZLIB, IT WILL BE BINARY HERE if we return bytes?
             # But the callers expect String usually?
             # For ZLIB detection to work downstream:
             # If it starts with ZLIB: (as bytes), we need to handle it.
             # "ZLIB:" is 90 76 73... in ASCII.
             # If we decode as latin-1, it preserves bytes 1-to-1.
             return plaintext.decode('latin-1')

    except Exception as e:
        print(f"DEBUG: Decryption error: {e}")
        # Return empty string on error (matching original behavior)
        return ""

def embed_frame(frame, secret_text, key):
    """Embed encrypted secret text into video frame using LSB steganography"""
    frame = frame.copy()
    
    # Encrypt the secret text
    data = encryption(secret_text, key)
    if data == "":  # Encryption failed
        raise ValueError("Encryption failed")
    
    # Add termination marker (same as original)
    data_with_marker = data + '*^*^*'
    
    # Convert to binary
    binary_data = ''.join([format(ord(i), '08b') for i in data_with_marker])
    
    # Embed in LSB of pixels
    index_data = 0
    height, width = frame.shape[:2]
    
    for i in range(height):
        for j in range(width):
            pixel = frame[i][j]
            for k in range(3):  # R, G, B channels
                if index_data < len(binary_data):
                    # Preserve 7 MSBs, replace LSB with our data bit
                    pixel[k] = (pixel[k] & 0b11111110) | int(binary_data[index_data])
                    index_data += 1
            if index_data >= len(binary_data):
                return frame
    
    return frame

def extract_frame(frame, key):
    """Extract and decrypt secret text from video frame"""
    data_binary = ""
    
    # Extract LSBs from all pixels
    for row in frame:
        for pixel in row:
            for k in range(3):  # R, G, B channels
                data_binary += str(pixel[k] & 1)
    
    # Convert binary to text
    all_bytes = [data_binary[i:i+8] for i in range(0, len(data_binary), 8)]
    decoded_data = ''
    
    for b in all_bytes:
        try:
            if len(b) == 8:
                decoded_data += chr(int(b, 2))
        except:
            continue
    
    # Find termination marker
    if "*^*^*" in decoded_data:
        encoded_ciphertext = decoded_data.split("*^*^*")[0]
        
        # Try to decrypt
        try:
            return decryption(encoded_ciphertext, key)
        except:
            return ""
    
    return ""

# ------------------ AUDIO STEGANOGRAPHY ------------------ #
def encode_aud_data(audio_path, secret_text, output_file):
    try:
        song = wave.open(audio_path, mode='rb')
    except wave.Error:
        raise ValueError("Invalid audio format! Audio Steganography requires uncompressed WAV files.")
        
    params = song.getparams()
    n_frames = song.getnframes()
    frames = song.readframes(n_frames)
    
    # Convert audio frames to numpy array (mutable)
    # wav frames are just bytes (uint8)
    cover_arr = np.frombuffer(frames, dtype=np.uint8).copy()
    
    # Prepare payload
    # Add terminator
    data = secret_text + '*^*^*'
    # Convert string to bytes
    data_bytes = data.encode('utf-8', errors='surrogatepass') # Use surrogatepass to handle binary data hidden in string
    
    # Create numpy array of payload bits
    payload_arr = np.frombuffer(data_bytes, dtype=np.uint8)
    payload_bits = np.unpackbits(payload_arr)
    
    if len(payload_bits) > len(cover_arr):
        song.close()
        raise ValueError(f"Audio file too short. Needed {len(payload_bits)} samples, got {len(cover_arr)}.")
        
    # Vectorized Embedding using slicing
    # We only modify the first N bytes where N is len(payload_bits)
    # LSB substitution: (byte & 0xFE) | bit
    
    # Mask out LSB of cover
    cover_arr[:len(payload_bits)] &= 0b11111110
    # OR with payload bits
    cover_arr[:len(payload_bits)] |= payload_bits
    
    with wave.open(output_file, 'wb') as fd:
        fd.setparams(params)
        fd.writeframes(cover_arr.tobytes())
    song.close()

def decode_aud_data(audio_path):
    try:
        song = wave.open(audio_path, mode='rb')
    except wave.Error:
        return ""
        
    frames = song.readframes(song.getnframes())
    cover_arr = np.frombuffer(frames, dtype=np.uint8)
    
    # Vectorized Extraction
    # Extract LSBs
    bits = cover_arr & 1
    
    # Pack bits back into bytes
    # np.packbits packs 8 bits into a byte. 
    # It assumes bits are [b7, b6, ... b0] (big endian within byte) by default or can vary.
    # Our encode was: char -> bin(x) -> bits. bin(x) gives high-to-low.
    # np.unpackbits also gives high-to-low (most significant bit first).
    # So packing simply reverses unpacking.
    
    try:
        # We process all bytes, so we might have trailing garbage bits that don't make full bytes.
        # Truncate to multiple of 8
        valid_bits = bits[:len(bits)//8 * 8]
        packed_bytes = np.packbits(valid_bits)
        
        # We need to find the terminator in the byte string
        # Decoding might fail if we just blindly decode 'utf-8' on random noise at the end of file.
        # So we work with bytes first.
        
        raw_bytes = packed_bytes.tobytes()
        TERMINATOR = b'*^*^*'
        
        # Find terminator
        t_index = raw_bytes.find(TERMINATOR)
        if t_index != -1:
            raw_bytes = raw_bytes[:t_index]
            
        # Decode to string
        return raw_bytes.decode('utf-8', errors='surrogatepass')
        
    except Exception as e:
        print(f"Audio Decode Error: {e}")
        return ""

# ------------------ FLASK ENDPOINTS ------------------ #
@app.route('/text/encode', methods=['POST'])
def text_encode_endpoint():
    try:
        text = request.form['text']
        cover_file = request.files['file']
        tmp_cover = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
        tmp_cover.close()
        cover_file.save(tmp_cover.name)
        output_file = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
        output_file.close()
        txt_encode(text, tmp_cover.name, output_file.name)
        try: os.remove(tmp_cover.name)
        except: pass
        return send_file(output_file.name, as_attachment=True, download_name="stego_text.txt")
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/text/decode', methods=['POST'])
def text_decode_endpoint():
    try:
        print("DEBUG: /text/decode endpoint called")
        
        stego_file = request.files['file']
        # Default key handled inside decryption if needed, or ignored if not encrypted
        key = request.form.get('key', 'default-key')
        
        tmp_stego = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
        tmp_stego.close()
        stego_file.save(tmp_stego.name)
        
        # 1. RAW EXTRACTION (The steganography part)
        extracted_content = decode_txt_data(tmp_stego.name)
        
        try: os.remove(tmp_stego.name)
        except: pass
        
        if not extracted_content:
            return jsonify({"error": "No hidden data found"}), 400
            
        print(f"DEBUG: Raw extracted content: {extracted_content[:50]}...")

        # 2. DECISION LOGIC: Is it Encrypted or Plain?
        
        # A) Secure Mode (STG-SEC header) - Return RAW for frontend to unlock
        if extracted_content.startswith("STG-SEC:"):
             print("DEBUG: Detected STG-SEC payload. Returning raw.")
             return jsonify({"decoded_text": extracted_content})

        # B) Multilayer / Encrypted Payload Handling
        # Multilayer steganography encrypts the payload (Base64 or Text) before embedding.
        # If we can decrypt it using the provided key, we should return the decrypted content.
        # This handles the case where "Audio -> Text" was used, and the text contains Encrypted Base64 of Audio.
        if key:
            print(f"DEBUG: Attempting decryption with key: {key[:3]}***")
            decrypted = decryption(extracted_content, key)
            if decrypted and decrypted != "":
                print("DEBUG: Decryption successful! Returning decrypted content.")
                # If the decrypted content is valid JSON (standard msg), return it? No, return string.
                return jsonify({"decoded_text": decrypted})
            else:
                print("DEBUG: Decryption returned empty (not encrypted or wrong key).")

        # C) Fallback: Return Raw Extracted Content
        # This covers Plain Text Steganography and failed decryption attempts
        print("DEBUG: Returning raw extracted content.")
        return jsonify({"decoded_text": extracted_content})

    except Exception as e:
        print(f"DEBUG: Exception in text_decode_endpoint: {e}")
        return jsonify({"error": str(e)}), 400

@app.route('/image/encode', methods=['POST'])
def image_encode_endpoint():
    try:
        file = request.files['image']
        secret_text = request.form.get('text', '')
        tmp_image = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        tmp_image.close()
        file.save(tmp_image.name)
        img = cv2.imread(tmp_image.name)
        if img is None:
            try: os.remove(tmp_image.name)
            except: pass
            return jsonify({"error": "Invalid image"}), 400
        output_file = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        output_file.close()
        encode_img_data(img, secret_text, output_file.name)
        try: os.remove(tmp_image.name)
        except: pass
        return send_file(output_file.name, as_attachment=True, download_name="stego_image.png")
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/image/decode', methods=['POST'])
def image_decode_endpoint():
    try:
        file = request.files['image']
        tmp_image = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        tmp_image.close()
        file.save(tmp_image.name)
        img = cv2.imread(tmp_image.name)
        if img is None:
            try: os.remove(tmp_image.name)
            except: pass
            return jsonify({"error": "Invalid image"}), 400
        decoded_text = decode_img_data(img)
        try: os.remove(tmp_image.name)
        except: pass
        return jsonify({"decoded_text": decoded_text})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/audio/encode', methods=['POST'])
def audio_encode_endpoint():
    try:
        file = request.files['audio']
        secret_text = request.form.get('text', '')
        tmp_audio = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        tmp_audio.close()
        file.save(tmp_audio.name)
        output_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        output_file.close()
        encode_aud_data(tmp_audio.name, secret_text, output_file.name)
        try: os.remove(tmp_audio.name)
        except: pass
        return send_file(output_file.name, as_attachment=True, download_name="stego_audio.wav")
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/audio/decode', methods=['POST'])
def audio_decode_endpoint():
    try:
        file = request.files['audio']
        tmp_audio = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        tmp_audio.close()
        file.save(tmp_audio.name)
        decoded_text = decode_aud_data(tmp_audio.name)
        try: os.remove(tmp_audio.name)
        except: pass
        return jsonify({"decoded_text": decoded_text})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ------------------ CHATBOT ENDPOINT ------------------ #
@app.route('/chat', methods=['POST'])
def chat_endpoint():
    try:
        data = request.json
        message = data.get('message')
        history_context = data.get('history', '')

        if not message:
            return jsonify({"error": "No message provided"}), 400

        # Inject history into the message if available
        if history_context:
            full_prompt = f"Context (User's Blockchain History):\n{history_context}\n\nUser Question: {message}"
        else:
            full_prompt = message
        print(full_prompt)
        SYSTEM_PROMPT = """
You are the AI Assistant for StegaSphere, a cutting-edge multi-media steganography platform.
Your goal is to help users protect their data using the tools available on this website.

### Website Overview: StegaSphere
StegaSphere is a platform for hiding data within media files (Image, Text, Audio, Video) using advanced steganography and encryption.

### Key Features & Techniques:
1. **Image Steganography**:
   - Uses **LSB (Least Significant Bit)** manipulation to hide data in pixel values.
   - Supports PNG/JPG.
   - Analysis tools available to detect hidden data.

2. **Text Steganography**:
   - Uses **Zero-Width Characters (ZWC)** (invisible Unicode characters) to hide secret text within cover text.
   - This method is invisible to the naked eye.

3. **Audio Steganography**:
   - Embeds data into **WAV** files using LSB modification.
   - Robust and effective for audio messages.

4. **Video Steganography (Premium)**:
   - Uses **Frame-based LSB Injection**.
   - **Dual Security**: Payloads are first encrypted with **AES-CTR (256-bit)** before embedding.
   - Requires an encryption key/password.

5. **Multilayer Steganography** (Advanced):
   - recursive hiding: Hide text in Audio -> Hide that Audio in Image.
   - Creates an onion-layered security structure.

6. **Blockchain Transparency**:
   - All critical operations (Encode/Decode) are logged to the **Sepolia Ethereum Testnet**.
   - This ensures an immutable history of data provenance.
   - Users can verify logs using the "History" button.

7. **Secure Vault**:
   - Generates temporary access tokens for encoded content.
   - Encrypts payloads with an expiration timer.

### Pricing (Pro Plan):
- **Monthly**: ₹299/month.
- **Yearly**: ₹1599/year (Save ~55%).
- Unlocks: Video Steganography, Multilayer, and Higher Logic Limits.
- Payment secured by Razorpay.

### How to Use:
- Navigate to the **"Tools"** section.
- Select the media type (Image, Text, Audio, Video).
- Drag & Drop your cover file.
- Enter your secret message (or upload a file to hide).
- Click **Encode** to download the stego-file.
- To retrieve data, upload the stego-file and click **Decode**.

### Your Personality:
- Professional, security-focused, yet accessible.
- Explain technical terms (LSB, AES, Blockchain) simply if asked.
- If a user asks "How do I hide data?", guide them to the specific tool on the page.
- Using emojis is encouraged for a friendly tone. 🛡️🔒

### IMPORTANT RESPONSE GUIDELINES:
- **BE CONCISE**: Keep responses short and to the point. Avoid unnecessary fluff.
- **FORMATTING**: Use Markdown (bold, bullet points) to make text readable.
- **LENGTH**: specific max length is not set, but strive for < 3 sentences for simple queries.
"""

        if not GENAI_API_KEY:
             return jsonify({"response": "Chatbot is not configured (Missing API Key)."}), 200

        # Use gemini-1.5-flash for free tier / broad availability
        model = genai.GenerativeModel('gemini-2.5-flash', system_instruction=SYSTEM_PROMPT)
        response = model.generate_content(full_prompt)
        
        return jsonify({"response": response.text})
    except Exception as e:
        print(f"Chat Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/video/encode', methods=['POST'])
def video_encode_endpoint():
    try:
        video_file = request.files['video']
        secret_text = request.form.get('text', '')
        key = request.form.get('key', 'defaultkey')
        frame_number = int(request.form.get('frame_number', 1))

        tmp_video = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        tmp_video.close()
        video_file.save(tmp_video.name)

        cap = cv2.VideoCapture(tmp_video.name)
        if not cap.isOpened():
            try: os.remove(tmp_video.name)
            except: pass
            return jsonify({"error": "Cannot open video file"}), 400

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            try: os.remove(tmp_video.name)
            except: pass
            return jsonify({"error": "Invalid/empty video"}), 400
        if frame_number < 1 or frame_number > total_frames:
            try: os.remove(tmp_video.name)
            except: pass
            return jsonify({"error": f"Frame number must be between 1 and {total_frames}"}), 400

        # Prefer lossless container/codec: try FFV1 in .avi
        out_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".avi")
        out_tmp.close()
        out_file = out_tmp.name
        
        fourcc = cv2.VideoWriter_fourcc(*'FFV1')
        writer = cv2.VideoWriter(out_file, fourcc, fps, (width, height))

        # If that didn't open (FFV1 not available), fallback to MJPG but warn (MJPG is lossy)
        used_lossless = True
        if not writer.isOpened():
            fourcc = cv2.VideoWriter_fourcc(*'MJPG')
            writer = cv2.VideoWriter(out_file, fourcc, fps, (width, height))
            used_lossless = False

        current_frame = 0
        ok, frame = cap.read()
        while ok:
            current_frame += 1
            if current_frame == frame_number:
                try:
                    frame = embed_frame(frame, secret_text, key)
                except ValueError as ve:
                    cap.release()
                    writer.release()
                    # delete partial file
                    try: os.remove(out_file)
                    except: pass
                    try: os.remove(tmp_video.name)
                    except: pass
                    return jsonify({"error": str(ve)}), 400
            writer.write(frame)
            ok, frame = cap.read()

        cap.release()
        writer.release()
        
        try: os.remove(tmp_video.name)
        except: pass

        resp = send_file(out_file, as_attachment=True, download_name=("stego_video.avi" if used_lossless else "stego_video_fallback.avi"))
        # include header so frontend can know if codec was lossy fallback
        resp.headers['X-StegaSphere-Lossless'] = '1' if used_lossless else '0'
        if not used_lossless:
            # also warn in body (frontend should show toast)
            # NOTE: send_file with custom headers still returns file; we include header above
            pass
        return resp

    except Exception as e:
        return jsonify({"error": f"Video encoding error: {str(e)}"}), 500

@app.route('/video/decode', methods=['POST'])
def video_decode_endpoint():
    try:
        video_file = request.files['video']
        key = request.form.get('key', 'defaultkey')
        frame_number = int(request.form.get('frame_number', 1))

        tmp_video = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        tmp_video.close()
        video_file.save(tmp_video.name)

        cap = cv2.VideoCapture(tmp_video.name)
        if not cap.isOpened():
            try: os.remove(tmp_video.name)
            except: pass
            return jsonify({"error": "Cannot open video file"}), 400

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if frame_number < 1 or frame_number > total_frames:
            cap.release()
            try: os.remove(tmp_video.name)
            except: pass
            return jsonify({"error": f"Frame number must be between 1 and {total_frames}"}), 400

        current_frame = 0
        extracted_text = ""
        while True:
            success, frame = cap.read()
            if not success:
                break
            current_frame += 1
            if current_frame == frame_number:
                extracted_text = extract_frame(frame, key)
                break

        cap.release()
        try: os.remove(tmp_video.name)
        except: pass

        if not extracted_text:
            return jsonify({"error": "No data found"}), 400

        return jsonify({"decoded_text": extracted_text})
    except Exception as e:
        return jsonify({"error": f"Video decoding error: {str(e)}"}), 500

# ------------------ DETECTION HELPERS ------------------ #
def detect_txt_stego(file_path):
    # Check for ZWC
    with open(file_path, "r", encoding="utf-8") as file:
        content = file.read()
        for char in content:
            if char in ZWC_reverse:
                # Found at least one ZWC, likely stego
                # To be more robust, we could check for the termination marker pattern
                # But simple presence is a strong indicator for this algorithm
                return True
    return False

def detect_img_stego(img):
    data_binary = ""
    # Process only enough to find the marker? 
    # Or strict check? The existing decode runs sequentially.
    # To be safe, we use a similar logic to decode but return boolean.
    
    # Flattening logic from decode_img_data
    # Optimization: processing line by line instead of full flatten first
    # might save memory but let's stick to the known working logic from decode_img_data
    # but abort early if we find the marker.
    
    for row in img:
        for pixel in row:
            for k in range(3):
                data_binary += str(pixel[k] & 1)
                
                # Check every byte (8 bits)
                if len(data_binary) >= 40: # minimal length (5 chars * 8 bits = 40)
                     if len(data_binary) % 8 == 0:
                        # Extract the string ending
                        # Only need to check the last few bytes newly added
                        pass

    # Re-using strict logic from decode_img_data basically:
    all_bytes = [data_binary[i:i+8] for i in range(0, len(data_binary), 8)]
    decoded_data = ""
    for byte in all_bytes:
        try:
            decoded_data += chr(int(byte, 2))
            if decoded_data.endswith("*^*^*"):
                return True
        except:
            continue
    return False

def detect_aud_stego(audio_path):
    song = wave.open(audio_path, mode='rb')
    frames = song.readframes(song.getnframes())
    frame_bytes = bytearray(list(frames))
    song.close()
    
    extracted = ''.join([str(b & 1) for b in frame_bytes])
    all_bytes = [extracted[i:i+8] for i in range(0, len(extracted), 8)]
    decoded_data = ""
    for byte in all_bytes:
        try:
            decoded_data += chr(int(byte, 2))
            if decoded_data.endswith("*^*^*"):
                return True
        except:
            continue
    return False

def detect_vid_stego(video_path):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return False

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    # Checking every frame might be slow for large videos.
    # But "drag and drop" implies we should check.
    # We'll check first 50 frames, or maybe every Nth frame?
    # The encoding allows picking a specific frame. User could have picked frame 100.
    # If we want to be thorough, we must check all.
    # Let's check all but break early.
    
    while True:
        success, frame = cap.read()
        if not success:
            break
        
        # Check this frame
        if detect_img_stego(frame): # Reusing image detection logic for frame
             cap.release()
             return True

    cap.release()
    return False

@app.route('/detect', methods=['POST'])
def detect_steganography():
    try:
        file = None
        for key in request.files:
            file = request.files[key]
            break
        
        if not file:
            return jsonify({"error": "No file provided"}), 400

        filename = (file.filename or "").lower()
        is_stego = False
        msg = "No hidden data detected."

        if filename.endswith(".txt"):
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
            tmp.close()
            file.save(tmp.name)
            if detect_txt_stego(tmp.name):
                is_stego = True
                msg = "Hidden data detected in text file!"
            os.remove(tmp.name)
            
        elif filename.endswith((".png", ".jpg", ".jpeg")):
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            tmp.close()
            file.save(tmp.name)
            img = cv2.imread(tmp.name)
            if img is not None:
                if detect_img_stego(img):
                    is_stego = True
                    msg = "Hidden data detected in image!"
            os.remove(tmp.name)

        elif filename.endswith(".wav"):
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
            tmp.close()
            file.save(tmp.name)
            if detect_aud_stego(tmp.name):
                is_stego = True
                msg = "Hidden data detected in audio file!"
            os.remove(tmp.name)

        elif filename.endswith((".mp4", ".avi", ".mov")):
             tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
             tmp.close()
             file.save(tmp.name)
             if detect_vid_stego(tmp.name):
                 is_stego = True
                 msg = "Hidden data detected in video file!"
             os.remove(tmp.name)
        else:
            return jsonify({"error": "Unsupported file type"}), 400

        return jsonify({
            "detected": is_stego,
            "message": msg
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ------------------ ANALYZE ------------------ #
@app.route('/analyze', methods=['POST'])
def analyze_cover():
    try:
        file = None
        filename = None
        secret_text = request.form.get('text', '')

        for field_name in ['file', 'image', 'audio', 'video']:
            if field_name in request.files:
                file = request.files[field_name]
                break

        if not file:
            return jsonify({"error": "No file provided"}), 400

        filename = (file.filename or "").lower()
        payload_bits = len(secret_text.encode('utf-8')) * 8

        # Helper to compute score based on utilization
        def compute_score(payload_bits, capacity_bits, format_multiplier=1.0):
            if capacity_bits <= 0:
                return 0, 100  # No capacity, score 0, utilization 100%
            
            utilization = payload_bits / capacity_bits
            
            # Score is higher when utilization is lower (more space available)
            # We want a score of 100 when utilization is 0%, and 0 when utilization is 100%+
            base_score = max(0, 100 - (utilization * 100))
            
            # Apply format multiplier
            score = min(100, base_score * format_multiplier)
            
            return round(score), min(100, utilization * 100)

        # ---------------- Image ----------------
        if filename.endswith((".png", ".jpg", ".jpeg")):
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            tmp.close()
            file.save(tmp.name)
            img = cv2.imread(tmp.name)
            if img is None:
                tmp_fn = tmp.name
                try: os.remove(tmp_fn)
                except: pass
                return jsonify({"error": "Could not read image file"}), 400

            h, w, _ = img.shape
            # clean up temp file immediately? No, analyze might need it? 
            # Actually analyze just reads img. So we can remove it.
            # But wait, logic continues. 
            # We should probably remove it at the end of the block or use try/finally.
            # For now just closing it prevents the lock.
            try: os.remove(tmp.name)
            except: pass

            capacity_bits = h * w * 3  # 3 bits per pixel (1 per channel)
            format_info = "image/png" if filename.endswith(".png") else "image/jpeg"
            safe_format = filename.endswith(".png")

            # PNG gets a bonus, JPEG gets a penalty
            mult = 1.2 if safe_format else 0.8
            score, util_percent = compute_score(payload_bits, capacity_bits, mult)
            fits = payload_bits <= capacity_bits

            reasons = [
                f"Image dimensions: {w}x{h} pixels",
                f"Total capacity: {capacity_bits} bits",
                f"Payload size: {payload_bits} bits",
                f"Utilization: {util_percent:.1f}%"
            ]
            
            if safe_format:
                reasons.append("✓ Lossless PNG format is ideal for steganography")
            else:
                reasons.append("⚠ JPEG is lossy and may corrupt hidden data")

            return jsonify({
                "score": score,
                "fits": fits,
                "metrics": {
                    "payload_bits": payload_bits,
                    "capacity_bits": capacity_bits,
                    "format": format_info,
                    "utilization_percent": util_percent
                },
                "reasons": reasons,
                "advice": "Use PNG format for better results" if not safe_format else "Good cover choice"
            })

        # ---------------- Audio (WAV) ----------------
        elif filename.endswith(".wav"):
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
            tmp.close()
            file.save(tmp.name)
            try:
                song = wave.open(tmp.name, 'rb')
                frames = song.getnframes()
                channels = song.getnchannels()
                sample_width = song.getsampwidth()
                song.close()
                try: os.remove(tmp.name)
                except: pass
                
                # Calculate capacity more accurately
                capacity_bits = frames * channels * 8  # 1 bit per sample
                format_info = "audio/wav"
                
                # Audio gets a moderate bonus
                mult = 1.1
                score, util_percent = compute_score(payload_bits, capacity_bits, mult)
                fits = payload_bits <= capacity_bits
                
                reasons = [
                    f"Audio frames: {frames}",
                    f"Channels: {channels}",
                    f"Sample width: {sample_width} bytes",
                    f"Total capacity: {capacity_bits} bits",
                    f"Payload size: {payload_bits} bits",
                    f"Utilization: {util_percent:.1f}%",
                    "✓ WAV format is good for audio steganography"
                ]
                
                return jsonify({
                    "score": score,
                    "fits": fits,
                    "metrics": {
                        "payload_bits": payload_bits,
                        "capacity_bits": capacity_bits,
                        "format": format_info,
                        "utilization_percent": util_percent
                    },
                    "reasons": reasons,
                    "advice": "Payload fits well" if fits else "Payload too large for this audio file"
                })
            except Exception as e:
                return jsonify({"error": f"Invalid audio file: {str(e)}"}), 400

        # ---------------- Text ----------------
        elif filename.endswith(".txt"):
            content = file.read().decode("utf-8")
            words = content.split()
            
            # 12 bits per word (6 ZWC characters, each representing 2 bits)
            capacity_bits = len(words) * 12
            format_info = "text/plain"
            
            # Text gets a neutral multiplier
            mult = 1.0
            score, util_percent = compute_score(payload_bits, capacity_bits, mult)
            fits = payload_bits <= capacity_bits
            
            reasons = [
                f"Words in cover: {len(words)}",
                f"Total capacity: {capacity_bits} bits",
                f"Payload size: {payload_bits} bits",
                f"Utilization: {util_percent:.1f}%",
                "✓ Text steganography uses zero-width characters"
            ]
            
            return jsonify({
                "score": score,
                "fits": fits,
                "metrics": {
                    "payload_bits": payload_bits,
                    "capacity_bits": capacity_bits,
                    "format": format_info,
                    "utilization_percent": util_percent
                },
                "reasons": reasons,
                "advice": "Add more text to increase capacity" if not fits else "Good text cover"
            })

        # ---------------- Video ----------------
        elif filename.endswith((".mp4", ".avi", ".mov")):
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
            tmp.close()
            file.save(tmp.name)

            cap = cv2.VideoCapture(tmp.name)
            if not cap.isOpened():
                try: os.remove(tmp.name)
                except: pass
                return jsonify({"error": "Could not open video file"}), 400

            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

            # Estimate capacity based on 10 frames
            frame_capacity = width * height * 3  # 3 bits per pixel
            capacity_bits = frame_capacity * 10  # Use 10 frames
            
            format_info = "video/mp4"
            
            # Video gets a small penalty due to complexity
            mult = 0.9
            score, util_percent = compute_score(payload_bits, capacity_bits, mult)
            fits = payload_bits <= capacity_bits
            
            cap.release()
            try: os.remove(tmp.name)
            except: pass
            
            reasons = [
                f"Video dimensions: {width}x{height}",
                f"Frame count: {frame_count}",
                f"Estimated capacity: {capacity_bits} bits",
                f"Payload size: {payload_bits} bits",
                f"Utilization: {util_percent:.1f}%",
                "✓ Video offers good hiding capacity"
            ]
            
            return jsonify({
                "score": score,
                "fits": fits,
                "metrics": {
                    "payload_bits": payload_bits,
                    "capacity_bits": capacity_bits,
                    "format": format_info,
                    "utilization_percent": util_percent
                },
                "reasons": reasons,
                "advice": "Video has plenty of space for your payload" if fits else "Payload too large for video"
            })

        else:
            return jsonify({"error": "Unsupported file type"}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500
# ------------------ MULTILAYER STEGANOGRAPHY - PURE LSB (ISOLATED) ------------------ #
# Rebuilt from scratch to ensure stability, simplicity, and speed.
# Dependencies: Numpy, OpenCV, Wave. No ZLIB. No external links.

ML_HEADER = b'<<START>>'
ML_FOOTER = b'<<END>>'

def _ml_get_ftype(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in ['.png', '.jpg', '.jpeg']: return 'image'
    if ext in ['.wav']: return 'audio'
    if ext in ['.avi', '.mp4', '.mov']: return 'video'
    if ext in ['.txt']: return 'text'
    return 'unknown'

# --- 1. TEXT (Zero Width Characters) ---
def _ml_text_encode(cover_path, secret_str, output_path):
    print("   [Text] Encoding started...")
    with open(cover_path, 'r', encoding='utf-8', errors='ignore') as f:
        cover_text = f.read()

    # Convert secret -> bytes -> bits -> ZWC
    payload = ML_HEADER + secret_str.encode('utf-8') + ML_FOOTER
    bits_list = []
    for byte in payload:
        for i in range(7, -1, -1):
            bits_list.append((byte >> i) & 1)
    
    # 0 -> \u200c (Zero Width Non-Joiner), 1 -> \u200d (Zero Width Joiner)
    zwc_payload = "".join(['\u200c' if b == 0 else '\u200d' for b in bits_list])
    
    # Inject after the first character
    if not cover_text: cover_text = " "
    final_text = cover_text[:1] + zwc_payload + cover_text[1:]
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(final_text)
    print("   [Text] Encoding done.")

def _ml_text_decode(stego_path):
    print("   [Text] Decoding started...")
    with open(stego_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    bits = []
    for char in content:
        if char == '\u200c': bits.append(0)
        elif char == '\u200d': bits.append(1)
    
    if not bits: 
        print("   [Text] No hidden ZWC data found.")
        return ""
        
    # Convert bits -> bytes
    byte_vals = []
    for i in range(0, len(bits), 8):
        chunk = bits[i:i+8]
        if len(chunk) < 8: break
        val = 0
        for b in chunk: val = (val << 1) | b
        byte_vals.append(val)
        
    all_bytes = bytes(byte_vals)
    
    start = all_bytes.find(ML_HEADER)
    end = all_bytes.find(ML_FOOTER)
    
    if start != -1 and end != -1:
        return all_bytes[start+len(ML_HEADER):end].decode('utf-8', errors='ignore')
    return ""

# --- 2. AUDIO (WAV 1-Bit LSB) ---
def _ml_audio_encode(cover_path, secret_str, output_path):
    print("   [Audio] Encoding started...")
    song = wave.open(cover_path, mode='rb')
    # Read frames as simple bytes
    frame_bytes = bytearray(list(song.readframes(song.getnframes())))
    params = song.getparams()
    song.close()
    
    payload = ML_HEADER + secret_str.encode('utf-8') + ML_FOOTER
    needed_bits = len(payload) * 8
    
    if needed_bits > len(frame_bytes):
        raise ValueError(f"Audio file is too short! Need {needed_bits} samples, but only have {len(frame_bytes)} samples.\n\nTIP: If using Multilayer, move this Audio file to a LATER layer so it can hold the previous implementation.")

    # Convert payload to bits
    bits = np.unpackbits(np.frombuffer(payload, dtype=np.uint8))
    
    # Vectorized Embedding
    # We only modify the first N bytes
    # Safe to use numpy for speed
    arr = np.array(frame_bytes, dtype=np.uint8)
    
    # Clear LSB of target area
    target_len = len(bits)
    arr[:target_len] = (arr[:target_len] & 0xFE) | bits
    
    with wave.open(output_path, 'wb') as fd:
        fd.setparams(params)
        fd.writeframes(arr.tobytes())
    print("   [Audio] Encoding done.")

def _ml_audio_decode(stego_path):
    print("   [Audio] Decoding started...")
    song = wave.open(stego_path, mode='rb')
    frame_bytes = song.readframes(song.getnframes())
    song.close()
    
    # Convert to numpy to extract LSBs fast
    arr = np.frombuffer(frame_bytes, dtype=np.uint8)
    lsb_bits = arr & 1
    
    # Pack bits back to bytes
    # np.packbits packs 8 bits into a byte
    # But packbits assumes [b7 b6 ... b0], we might correspond element 0 to b7?
    # Actually arr[0] is first bit, arr[1] is second...
    # packbits default is 'C' (big endian bits). 
    # If we have stream 1, 0, 1... 
    # Byte constructed should be (1<<7) | (0<<6)... NO.
    # Usually LSB stego fills MSB of the message byte first?
    # unpackbits gives [b7, b6, ..., b0].
    # So yes, bit 0 in our stream corresponds to MSB of the char.
    
    extracted_bytes = np.packbits(lsb_bits).tobytes()
    
    start = extracted_bytes.find(ML_HEADER)
    end = extracted_bytes.find(ML_FOOTER)
    
    if start != -1 and end != -1:
        return extracted_bytes[start+len(ML_HEADER):end].decode('utf-8', errors='ignore')
    return ""

# --- 3. IMAGE (2-Bit LSB) ---
def _ml_image_encode(cover_path, secret_str, output_path):
    print("   [Image] Encoding started...")
    img = cv2.imread(cover_path)
    if img is None: raise ValueError("Could not read image file.")
    
    flat = img.reshape(-1)
    
    payload = ML_HEADER + secret_str.encode('utf-8') + ML_FOOTER
    # 2 bits per pixel channel
    # Capacity in bytes = (Total Pixels * 1) / 4  (since 4 pixels hold 1 byte of payload)
    total_pixels_available = len(flat)
    capacity_bytes = total_pixels_available // 4 
    
    if len(payload) > capacity_bytes:
        raise ValueError(f"Image is too small! Secret needs {len(payload)} bytes space (approx {len(payload)*4} pixels), but image only has {capacity_bytes} bytes capacity.\n\nTIP: If you are doing Multilayer, try SWAPPING the order. Use this Image as the FIRST layer (to hold the small secret), and use larger files (like Audio/Video) as the later layers.")
        
    # Payload bytes -> Bits -> 2-bit chunks
    # 1 byte = [b7b6, b5b4, b3b2, b1b0]
    payload_arr = np.frombuffer(payload, dtype=np.uint8)
    bits = np.unpackbits(payload_arr)
    chunks = bits.reshape(-1, 2)
    # Convert pair of bits to value 0-3
    chunk_vals = (chunks[:, 0] << 1) | chunks[:, 1]
    
    count = len(chunk_vals)
    
    # Write to image LSBs
    flat[:count] = (flat[:count] & 0xFC) | chunk_vals
    
    cv2.imwrite(output_path, flat.reshape(img.shape))
    print("   [Image] Encoding done.")

def _ml_image_decode(stego_path):
    print("   [Image] Decoding started...")
    img = cv2.imread(stego_path)
    if img is None: return ""
    
    flat = img.reshape(-1)
    
    # Extract last 2 bits
    vals = flat & 0x03
    
    # We need multiple of 4 to make full bytes
    limit = (len(vals) // 4) * 4
    vals = vals[:limit]
    
    # Reshape to groups of 4 (representing 1 byte)
    groups = vals.reshape(-1, 4)
    # Reconstruct: (p0<<6) + (p1<<4) + (p2<<2) + p3
    bytes_arr = (groups[:,0] << 6) | (groups[:,1] << 4) | (groups[:,2] << 2) | groups[:,3]
    
    all_bytes = bytes_arr.astype(np.uint8).tobytes()
    
    start = all_bytes.find(ML_HEADER)
    end = all_bytes.find(ML_FOOTER)
    
    if start != -1 and end != -1:
        return all_bytes[start+len(ML_HEADER):end].decode('utf-8', errors='ignore')
    return ""

# --- 4. VIDEO (Frame-by-Frame 2-Bit LSB) ---
def _ml_video_encode(cover_path, secret_str, output_path):
    print("   [Video] Encoding started...")
    cap = cv2.VideoCapture(cover_path)
    if not cap.isOpened(): raise ValueError("Could not open video source.")
    
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Payload
    payload = ML_HEADER + secret_str.encode('utf-8') + ML_FOOTER
    
    # Capacity Check
    pixels_per_frame = width * height * 3
    bytes_per_frame = pixels_per_frame // 4
    total_capacity = bytes_per_frame * total_frames
    
    if len(payload) > total_capacity:
        cap.release()
        raise ValueError(f"Video is too short! Secret needs {len(payload)} bytes space, but video capacity is {total_capacity} bytes.")

    # Prepare Payload Data Stream
    payload_arr = np.frombuffer(payload, dtype=np.uint8)
    bits = np.unpackbits(payload_arr)
    chunks = bits.reshape(-1, 2)
    chunk_vals = (chunks[:, 0] << 1) | chunks[:, 1]
    
    total_chunks = len(chunk_vals)
    current_chunk_idx = 0
    
    fourcc = cv2.VideoWriter_fourcc(*'FFV1')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    processed_frames = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        
        if current_chunk_idx < total_chunks:
            flat = frame.reshape(-1)
            space_in_frame = len(flat)
            
            remaining = total_chunks - current_chunk_idx
            to_write = min(remaining, space_in_frame)
            
            data_slice = chunk_vals[current_chunk_idx : current_chunk_idx + to_write]
            
            # Embed
            flat[:to_write] = (flat[:to_write] & 0xFC) | data_slice
            
            current_chunk_idx += to_write
            frame = flat.reshape((height, width, 3))
            
        out.write(frame)
        processed_frames += 1
        
    cap.release()
    out.release()
    print("   [Video] Encoding done.")

def _ml_video_decode(stego_path):
    print("   [Video] Decoding started...")
    cap = cv2.VideoCapture(stego_path)
    if not cap.isOpened(): return ""
    
    all_bytes = bytearray()
    
    header_found = False
    footer_found = False
    
    # Optimization: Check chunks periodically
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        
        flat = frame.reshape(-1)
        
        # Extract 2 bits
        vals = flat & 0x03
        
        # Trim to multiple of 4
        n = (len(vals) // 4) * 4
        vals = vals[:n]
        
        groups = vals.reshape(-1, 4)
        bytes_arr = (groups[:,0] << 6) | (groups[:,1] << 4) | (groups[:,2] << 2) | groups[:,3]
        
        chunk_bytes = bytes_arr.astype(np.uint8).tobytes()
        all_bytes.extend(chunk_bytes)
        
        # Search for footer in the tail to stop early
        tail = all_bytes[-(len(chunk_bytes) + 20):]
        if ML_FOOTER in tail:
            footer_found = True
            break
            
    cap.release()
    
    full_data = bytes(all_bytes)
    start = full_data.find(ML_HEADER)
    end = full_data.find(ML_FOOTER)
    
    if start != -1 and end != -1:
        return full_data[start+len(ML_HEADER):end].decode('utf-8', errors='ignore')
    
    return ""

# --- GENERIC WRAPPERS (Interface for Routes) ---

def generic_encode(cover_path, secret_b64, output_path, key=None):
    # Encrypt the Secret Base64 String (returns Base64 String)
    # The 'secret_b64' is the payload we want to hide.
    # We encrypt it first for security.
    encrypted_result = encryption(secret_b64, key)
    # `encryption` may return a base64 string or raw bytes depending on implementation.
    # If it's already a string (base64), use it directly; otherwise base64-encode the bytes.
    if isinstance(encrypted_result, str):
        encrypted_payload_b64 = encrypted_result
    else:
        encrypted_payload_b64 = base64.b64encode(encrypted_result).decode('utf-8')
    
    ftype = _ml_get_ftype(cover_path)
    
    if ftype == 'text':
        _ml_text_encode(cover_path, encrypted_payload_b64, output_path)
    elif ftype == 'image':
        _ml_image_encode(cover_path, encrypted_payload_b64, output_path)
    elif ftype == 'audio':
        _ml_audio_encode(cover_path, encrypted_payload_b64, output_path)
    elif ftype == 'video':
        _ml_video_encode(cover_path, encrypted_payload_b64, output_path)
    else:
        raise ValueError(f"Unsupported file type: {ftype}")
    
    # Verification
    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
         raise ValueError("Encoding produced an empty file. Check logs.")

def generic_decode(stego_path, key=None):
    ftype = _ml_get_ftype(stego_path)
    extracted_data = ""
    
    if ftype == 'text':
        extracted_data = _ml_text_decode(stego_path)
    elif ftype == 'image':
        extracted_data = _ml_image_decode(stego_path)
    elif ftype == 'audio':
        extracted_data = _ml_audio_decode(stego_path)
    elif ftype == 'video':
        extracted_data = _ml_video_decode(stego_path)
        
    if not extracted_data:
        return ""
        
    # Decrypt
    # Extracted data should be the encrypted_payload_b64 from encode step
    try:
        # `extracted_data` should already be the base64 string produced during encode.
        return decryption(extracted_data, key)
    except Exception as e:
        print(f"Decryption failed: {e}. Returning raw data for debug.")
        return ""

@app.route('/multilayer/encode', methods=['POST'])
def multilayer_encode():
    cleanup_files = []
    try:
        secret_text = request.form.get('secret_text')
        secret_file = request.files.get('secret_file')
        key = request.form.get('key', 'default-key')

        layers = []
        i = 0
        while True:
            f = request.files.get(f'layer_{i}')
            if not f and i == 0: f = request.files.get('file1')
            if not f and i == 1: f = request.files.get('file2')
            
            if f and f.filename:
                layers.append(f)
                i += 1
            else:
                if i > 1 and not request.files.get(f'layer_{i}'): break
                if i == 0 and not request.files.get('file1'): break
                if i == 1 and not request.files.get('file2'): break
                break
        
        if not layers:
             return jsonify({"error": "At least one carrier file is required"}), 400

        # Initial Payload
        if secret_text:
            current_payload = secret_text
        elif secret_file:
            current_payload = base64.b64encode(secret_file.read()).decode('utf-8')
        else:
            return jsonify({"error": "No secret provided"}), 400

        final_file_path = None
        
        for idx, carrier_file in enumerate(layers):
            print(f"DEBUG: Processing Layer {idx+1}/{len(layers)} - Carrier: {carrier_file.filename}")
            
            ext = os.path.splitext(carrier_file.filename)[1].lower()
            if not ext: ext = '.png'
            
            tmp_carrier = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
            tmp_carrier.close()
            carrier_file.save(tmp_carrier.name)
            cleanup_files.append(tmp_carrier.name)
            
            # Output extension
            out_ext = ext
            ftype = _ml_get_ftype(carrier_file.filename)
            if ftype == 'video': out_ext = '.avi'
            elif ftype == 'audio': out_ext = '.wav'
            elif ftype == 'image': out_ext = '.png'
            
            tmp_out = tempfile.NamedTemporaryFile(delete=False, suffix=out_ext)
            tmp_out.close()
            cleanup_files.append(tmp_out.name)
            
            # ENCODE
            generic_encode(tmp_carrier.name, current_payload, tmp_out.name, key)
            
            if idx < len(layers) - 1:
                with open(tmp_out.name, "rb") as f_read:
                    layer_bytes = f_read.read()
                current_payload = base64.b64encode(layer_bytes).decode('utf-8')
            else:
                final_file_path = tmp_out.name
                final_ext = out_ext

        if final_file_path:
             return send_file(final_file_path, as_attachment=True, download_name=f"multilayer_result{final_ext}")
        else:
             return jsonify({"error": "Encoding failed unexpectedly"}), 500

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"System error: {str(e)}"}), 500
    finally:
        for f in cleanup_files:
            if f != final_file_path: 
                try: os.remove(f)
                except: pass

@app.route('/multilayer/decode', methods=['POST'])
def multilayer_decode():
    temp_file = None
    try:
        f = request.files.get('file')
        key = request.form.get('key', 'default-key')
        
        if not f: return jsonify({"error": "No file provided"}), 400
            
        ext = os.path.splitext(f.filename)[1].lower()
        if not ext: ext = ".tmp"

        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        temp_file.close()
        f.save(temp_file.name)
        
        # Decode
        decrypted = generic_decode(temp_file.name, key)
        
        if not decrypted:
            return jsonify({"error": "No hidden data found or incorrect key."}), 400

        # --- AUTO-UNWRAP TEXT STEGO (Full Recursion) ---
        # If the extracted data contains ZWC, keep peeling until no more ZWC found.
        def _unwrap_zwc_layer(text):
            bits = []
            for char in text:
                if char == '\u200c': bits.append(0)
                elif char == '\u200d': bits.append(1)
            if not bits:
                return text
            byte_vals = []
            for i in range(0, len(bits), 8):
                chunk = bits[i:i+8]
                if len(chunk) < 8: break
                val = 0
                for b in chunk: val = (val << 1) | b
                byte_vals.append(val)
            all_bytes = bytes(byte_vals)
            start = all_bytes.find(ML_HEADER)
            end = all_bytes.find(ML_FOOTER)
            if start != -1 and end != -1:
                inner_secret = all_bytes[start+len(ML_HEADER):end].decode('utf-8', errors='ignore')
                return inner_secret
            return text

        # Recursively unwrap all ZWC layers
        max_recursion = 5
        unwrap_count = 0
        while isinstance(decrypted, str) and ('\u200c' in decrypted or '\u200d' in decrypted):
            prev = decrypted
            decrypted = _unwrap_zwc_layer(decrypted)
            unwrap_count += 1
            if decrypted == prev or unwrap_count >= max_recursion:
                break
        if unwrap_count > 0:
            print(f"DEBUG: Auto-unwrapped {unwrap_count} ZWC text layer(s)")

        # Handle Result (File vs Text)
        is_file = False
        out_name = "secret.txt"
        mime = "text/plain"
        file_bytes = None
        

        try:
            # Check if decrypted is base64 of a FILE
            candidate_bytes = base64.b64decode(decrypted, validate=True)

            if candidate_bytes.startswith(b'RIFF') and b'WAVE' in candidate_bytes[:16]:
                is_file = True; out_name="secret.wav"; mime="audio/wav"
            elif candidate_bytes.startswith(b'RIFF') and b'AVI ' in candidate_bytes[:16]:
                is_file = True; out_name="secret.avi"; mime="video/x-msvideo"
            elif candidate_bytes.startswith(b'\x89PNG'):
                is_file = True; out_name="secret.png"; mime="image/png"
            elif candidate_bytes.startswith(b'\xFF\xD8\xFF'):
                is_file = True; out_name="secret.jpg"; mime="image/jpeg"
            else:
                # If not a known binary, treat as text file and return as download
                is_file = True; out_name = "secret.txt"; mime = "application/octet-stream"; file_bytes = candidate_bytes

            if is_file:
                file_bytes = candidate_bytes

        except:
            # Not valid base64 -> must be plain text
            pass

        if is_file and file_bytes:
            tmp_out = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(out_name)[1])
            tmp_out.close()
            with open(tmp_out.name, "wb") as fo: fo.write(file_bytes)
            return send_file(tmp_out.name, as_attachment=True, download_name=out_name, mimetype=mime)
        else:
            # For plain text, return as downloadable text file
            tmp_out = tempfile.NamedTemporaryFile(delete=False, suffix='.txt')
            tmp_out.close()
            with open(tmp_out.name, "w", encoding='utf-8') as fo: fo.write(decrypted)
            return send_file(tmp_out.name, as_attachment=True, download_name="secret.txt", mimetype="application/octet-stream")

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        if temp_file:
            try: os.remove(temp_file.name)
            except: pass
@app.route('/text/decode', methods=['POST'])
def text_decode():
    f = request.files.get('file')
    if not f:
        return jsonify({"error": "No file provided"}), 400
    try:
        content = f.read().decode('utf-8', errors='ignore')
        # Recursively decode ZWC layers
        max_recursion = 5
        unwrap_count = 0
        def _unwrap_zwc_layer(text):
            bits = []
            for char in text:
                if char == '\u200c': bits.append(0)
                elif char == '\u200d': bits.append(1)
            if not bits:
                return text
            byte_vals = []
            for i in range(0, len(bits), 8):
                chunk = bits[i:i+8]
                if len(chunk) < 8: break
                val = 0
                for b in chunk: val = (val << 1) | b
                byte_vals.append(val)
            all_bytes = bytes(byte_vals)
            start = all_bytes.find(ML_HEADER)
            end = all_bytes.find(ML_FOOTER)
            if start != -1 and end != -1:
                inner_secret = all_bytes[start+len(ML_HEADER):end].decode('utf-8', errors='ignore')
                return inner_secret
            return text
        prev = content
        while ('\u200c' in prev or '\u200d' in prev) and unwrap_count < max_recursion:
            next_val = _unwrap_zwc_layer(prev)
            if next_val == prev:
                break
            prev = next_val
            unwrap_count += 1
        return prev, 200, {'Content-Type': 'text/plain'}
    except Exception as e:
        return jsonify({"error": f"Text decode failed: {str(e)}"}), 400

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        if temp_file:
            try: os.remove(temp_file.name)
            except: pass

# ------------------ Keep-Alive Mechanism ------------------ #
# REMOVED

# ------------------ HOME ------------------ #
@app.route('/')
def home():
    return jsonify({
        "message": "StegaSphere API is running",
        "endpoints": {
            "text_encode": "/text/encode",
            "text_decode": "/text/decode",
            "image_encode": "/image/encode",
            "image_decode": "/image/decode",
            "audio_encode": "/audio/encode",
            "audio_decode": "/audio/decode",
            "video_encode": "/video/encode",
            "video_decode": "/video/decode",
            "analyze": "/analyze"
        }
    })

if __name__ == '__main__':
    # debug True is helpful during dev; set to False in production
    app.run(debug=True, host="0.0.0.0", port=5000)