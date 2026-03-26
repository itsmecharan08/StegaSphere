import CryptoJS from 'crypto-js';

/**
 * Generates a random 6-character Access Token
 */
export const generateAccessToken = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 1, 0 to avoid confusion
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result; // e.g., "7K9M2X"
};

/**
 * Encrypts the secret data with the Token and embeds rules (Expiration)
 * @param {string} payloadString - The full string payload (usually JSON of message + metadata)
 * @param {string} token - The access token
 * @param {number|null} hoursValid - How many hours until files expires (null for infinite)
 * @param {boolean} isOneTime - (Metadata only) Marks if it should be treated as one-time
 */
export const securePayload = (payloadString, token, hoursValid = null, isOneTime = false) => {
  const rules = {
    content: payloadString,
    expiry: hoursValid ? Date.now() + (hoursValid * 60 * 60 * 1000) : null, // Future timestamp
    oneTime: isOneTime,
    isSecure: true
  };

  // Encrypt the entire JSON package using the Token as the key
  const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(rules), token).toString();
  // Add a prefix to easily identify it as our secure packet
  return `STG-SEC:${ciphertext}`;
};

/**
 * Decrypts and Validates the payload
 */
export const unlockPayload = (encryptedContent, tokenInput) => {
  try {
    if (!encryptedContent || !tokenInput) return { success: false, error: "Missing data" };

    // Standardize inputs
    const cleanToken = tokenInput.trim();
    const rawInput = encryptedContent.trim();
    
    // 2. Extract strictly the Base64 ciphertext using Regex 
    // Captures standard Base64 characters only
    const match = rawInput.match(/STG-SEC:([A-Za-z0-9+/=]+)/);
    
    let rawCipher;
    if (match && match[1]) {
       rawCipher = match[1];
    } else {
       // Fallback: simple replace
       rawCipher = rawInput.replace('STG-SEC:', '').trim();
    }
    
    // 3. Decrypt
    // catch malformed payload errors from CryptoJS
    let bytes;
    try {
        bytes = CryptoJS.AES.decrypt(rawCipher, cleanToken);
    } catch(e) {
        return { success: false, error: "Decryption failed. Check token." };
    }

    let decryptedString;
    try {
        decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        decryptedString = "";
    }
    
    if (!decryptedString) {
        // Empty result usually means wrong key (token) or Salt mismatch
        return { success: false, error: "Invalid Access Token." };
    }

    let data;
    try {
        data = JSON.parse(decryptedString);
    } catch (e) {
        return { success: false, error: "Corrupted Data (JSON parse failed)" };
    }

    // 1. Check Expiration
    if (data.expiry && Date.now() > data.expiry) {
      return { 
        success: false, 
        error: "This Secure File has EXPIRED. Access denied." 
      };
    }

    // 2. Check One-Time (Client-side warning only without DB)
    if (data.oneTime) {
       // Ideally trigger a callback here to log consumption
    }
    
    // Return original content (which is the payloadString to be parsed later)
    return { success: true, content: data.content, oneTime: data.oneTime };

  } catch (error) {
    // console.error("Unlock Error:", error); 
    return { success: false, error: "Invalid Access Token or Corrupted Data." };
  }
};
