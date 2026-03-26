import numpy as np
import cv2
import os
import wave

# ------------------ TEXT STEGANOGRAPHY ------------------ #
# Using safer Zero-Width Characters to avoid Bidi state issues
ZWC = {"00": u'\u200B', "01": u'\u200C', "11": u'\u200D', "10": u'\u2060'}
ZWC_reverse = {v: k for k, v in ZWC.items()}

def txt_encode(text, cover_text_path, output_file):
    print(f"DEBUG txt_encode: Input text length: {len(text)}")
    
    # Improved robust encoding: Convert to UTF-8 bytes then to bits
    try:
        encoded_bytes = text.encode('utf-8')
        res1 = ""
        for byte in encoded_bytes:
            res1 += format(byte, '08b')
        
        # Add Terminator (Using 111111111111 as it's invalid in UTF-8 byte stream context)
        res1 += "111111111111"
        
        print(f"DEBUG txt_encode: Binary data length: {len(res1)} bits")

        HM_SK = ""
        with open(cover_text_path, "r", encoding="utf-8", errors='ignore') as file1, open(output_file, "w", encoding="utf-8") as file3:
            word = []
            for line in file1:
                word += line.split()
            
            if not word:
                word = ["Safe", "Cover", "Text", "Generated", "By", "System"]

            len_words = len(word)
            zwc_chars_written = 0
            i = 0
            
            # Map 8 bits (4 ZWCs) per word for density, or stick to stream
            while i < len(res1):
                s = word[int(i/8) % len_words] # Use simpler index progression
                j = 0
                HM_SK = ""
                
                # Write 8 bits (4 ZWCs) per chunk
                chunk_size = 8 
                current_bits = res1[i:i+chunk_size]
                
                for k in range(0, len(current_bits), 2):
                    if k+1 < len(current_bits):
                        x = current_bits[k] + current_bits[k+1]
                        HM_SK += ZWC[x]
                        zwc_chars_written += 1
                
                file3.write(s + HM_SK + " ")
                i += chunk_size
                
    except Exception as e:
        print(f"DEBUG txt_encode ERROR: {e}")
        return f"Error: {e}"
        
    print("DEBUG txt_encode: Encoding completed successfully")
    return "Stego text file generated successfully"

def decode_txt_data(stego_file):
    temp = ''
    debug_info = []
    
    try:
        # Read the entire file content
        with open(stego_file, "r", encoding="utf-8", errors='ignore') as file4:
            content = file4.read()
            
        debug_info.append(f"File size: {len(content)} chars")
        
        # Count ZWC characters found
        zwc_count = 0
        for char in content:
            if char in ZWC_reverse:
                temp += ZWC_reverse[char]
                zwc_count += 1
                
        debug_info.append(f"ZWC characters found: {zwc_count}")
        debug_info.append(f"Binary bits extracted: {len(temp)}")
        
        # Check for terminator
        if "111111111111" in temp:
             temp = temp.split("111111111111")[0]
             debug_info.append("Terminator found and removed")
        else:
            debug_info.append("No terminator found")
             
    except Exception as e:
        debug_info.append(f"Read error: {e}")

    if len(temp) == 0:
        print("DEBUG decode_txt_data:", "; ".join(debug_info))
        return ""

    # Decode the binary data (Robust UTF-8)
    try:
        byte_array = bytearray()
        for i in range(0, len(temp), 8):
            byte_str = temp[i:i+8]
            # Ensure we only take full bytes (8 bits)
            if len(byte_str) == 8:
                byte_array.append(int(byte_str, 2))
        
        # Use errors='replace' to safely handle any minor corruption or terminator artifacts
        result = byte_array.decode('utf-8', errors='replace')
        
        # Strip potential BOM or null bytes
        result = result.replace('\ufeff', '').replace('\x00', '').strip()
        
        debug_info.append(f"Final result length: {len(result)}")
        
    except Exception as e:
        debug_info.append(f"Decode error: {e}")
        result = ""
    
    print("DEBUG decode_txt_data:", "; ".join(debug_info))
    return result

# ------------------ IMAGE STEGANOGRAPHY ------------------ #
def msgtobinary(msg):
    if type(msg) == str:
        return ''.join([format(ord(i), "08b") for i in msg])
    elif type(msg) in [bytes, np.ndarray]:
        return [format(i, "08b") for i in msg]
    elif type(msg) in [int, np.uint8]:
        return format(msg, "08b")
    else:
        raise TypeError("Unsupported input type")

def encode_img_data(img, secret_text, output_file='stego_image.png'):
    data = secret_text + '*^*^*'
    binary_data = msgtobinary(data)
    index_data = 0
    for i in img:
        for pixel in i:
            r, g, b = msgtobinary(pixel)
            if index_data < len(binary_data):
                pixel[0] = int(r[:-1] + binary_data[index_data], 2)
                index_data += 1
            if index_data < len(binary_data):
                pixel[1] = int(g[:-1] + binary_data[index_data], 2)
                index_data += 1
            if index_data < len(binary_data):
                pixel[2] = int(b[:-1] + binary_data[index_data], 2)
                index_data += 1
            if index_data >= len(binary_data):
                break
    cv2.imwrite(output_file, img)
    return output_file

def decode_img_data(img):
    bits_list = []
    flattened_img = img.reshape(-1, 3)
    
    for pixel in flattened_img:
        bits_list.append(str(pixel[0] & 1))
        bits_list.append(str(pixel[1] & 1))
        bits_list.append(str(pixel[2] & 1))
        
        # Check for terminator every 1000 pixels (3000 bits ≈ 375 bytes)
        if len(bits_list) % 3000 == 0 and len(bits_list) >= 3000:
            bit_string = "".join(bits_list)
            decoded_data = ""
            for i in range(0, len(bit_string) - (len(bit_string) % 8), 8):
                byte = bit_string[i:i+8]
                decoded_data += chr(int(byte, 2))
            
            if "*^*^*" in decoded_data:
                return decoded_data.split("*^*^*")[0]
    
    # If not found early, process the entire bit string
    bit_string = "".join(bits_list)
    decoded_data = ""
    for i in range(0, len(bit_string) - (len(bit_string) % 8), 8):
        byte = bit_string[i:i+8]
        decoded_data += chr(int(byte, 2))
    
    if "*^*^*" in decoded_data:
        return decoded_data.split("*^*^*")[0]
    return ""

# ------------------ AUDIO STEGANOGRAPHY ------------------ #
def encode_aud_data(audio_path, secret_text, output_file='stego_audio.wav'):
    song = wave.open(audio_path, mode='rb')
    nframes = song.getnframes()
    frames = song.readframes(nframes)
    frame_bytes = bytearray(list(frames))
    data = secret_text + '*^*^*'
    result = []
    for c in data:
        bits = bin(ord(c))[2:].zfill(8)
        result.extend([int(b) for b in bits])
    j = 0
    for i in range(len(result)):
        res = bin(frame_bytes[j])[2:].zfill(8)
        if res[-4] == result[i]:
            frame_bytes[j] = frame_bytes[j] & 253
        else:
            frame_bytes[j] = (frame_bytes[j] & 253) | 2
            frame_bytes[j] = (frame_bytes[j] & 254) | result[i]
        j += 1
    frame_modified = bytes(frame_bytes)
    with wave.open(output_file, 'wb') as fd:
        fd.setparams(song.getparams())
        fd.writeframes(frame_modified)
    song.close()
    return output_file

def decode_aud_data(audio_path):
    song = wave.open(audio_path, mode='rb')
    nframes = song.getnframes()
    frames = song.readframes(nframes)
    frame_bytes = bytearray(list(frames))
    extracted = ""
    p = 0
    for i in range(len(frame_bytes)):
        if p == 1:
            break
        res = bin(frame_bytes[i])[2:].zfill(8)
        if res[-2] == '0':
            extracted += res[-4]
        else:
            extracted += res[-1]
        all_bytes = [extracted[i:i+8] for i in range(0, len(extracted), 8)]
        decoded_data = ""
        for byte in all_bytes:
            decoded_data += chr(int(byte, 2))
            if decoded_data[-5:] == "*^*^*":
                return decoded_data[:-5]

# ------------------ VIDEO STEGANOGRAPHY ------------------ #
def encryption(plaintext, key):
    """Encrypt using AES-CTR mode with PyCryptodome"""
    try:
        from Crypto.Cipher import AES
        from Crypto.Random import get_random_bytes
        from Crypto.Util import Counter
        from Crypto.Protocol.KDF import PBKDF2
        import base64
        
        # Derive key
        salt = get_random_bytes(16)
        derived_key = PBKDF2(key, salt, dkLen=32, count=1000)
        
        # Generate random nonce for CTR mode
        nonce = get_random_bytes(8)
        
        # Create counter for CTR mode
        ctr = Counter.new(64, prefix=nonce, initial_value=0)
        
        # Create AES-CTR cipher
        cipher = AES.new(derived_key, AES.MODE_CTR, counter=ctr)
        
        # Encrypt the plaintext
        ciphertext = cipher.encrypt(plaintext.encode('utf-8'))
        
        # Return salt + nonce + ciphertext (all as base64)
        combined = salt + nonce + ciphertext
        return base64.b64encode(combined).decode('utf-8')
    except Exception as e:
        print(f"Encryption error: {e}")
        return ""

def decryption(ciphertext, key):
    """Decrypt using AES-CTR mode with PyCryptodome"""
    try:
        from Crypto.Cipher import AES
        from Crypto.Util import Counter
        from Crypto.Protocol.KDF import PBKDF2
        import base64
        
        # Clean and Fix Base64 Padding
        ciphertext = ciphertext.strip()
        missing_padding = len(ciphertext) % 4
        if missing_padding:
            ciphertext += '=' * (4 - missing_padding)
            
        # Decode from base64
        try:
             combined = base64.b64decode(ciphertext)
        except:
             # If base64 fails, it might be raw garbage or legacy text
             return ciphertext

        # Extract components: salt(16) + nonce(8) + actual_ciphertext
        if len(combined) < 24: # Validation
            return ciphertext # Return raw if not valid encrypted packet

        salt = combined[:16]
        nonce = combined[16:24]
        actual_ciphertext = combined[24:]
        
        # Derive key using the same salt
        derived_key = PBKDF2(key, salt, dkLen=32, count=1000)
        
        # Recreate counter for CTR mode
        ctr = Counter.new(64, prefix=nonce, initial_value=0)
        
        # Create AES-CTR cipher
        cipher = AES.new(derived_key, AES.MODE_CTR, counter=ctr)
        
        # Decrypt
        plaintext = cipher.decrypt(actual_ciphertext)
        
        try:
             return plaintext.decode('utf-8')
        except UnicodeDecodeError:
             return plaintext.decode('latin-1') 

    except Exception as e:
        print(f"DEBUG: Decryption error: {e}")
        return ciphertext
