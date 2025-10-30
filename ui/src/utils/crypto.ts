const HEX_REGEX = /^0x?[0-9a-fA-F]*$/;

export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `0x${hex}` as `0x${string}`;
}

export function hexToBytes(value: string): Uint8Array {
  if (!HEX_REGEX.test(value)) {
    throw new Error('Invalid hex value');
  }

  const normalized = value.startsWith('0x') ? value.slice(2) : value;
  if (normalized.length % 2 !== 0) {
    throw new Error('Hex string must have an even length');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

export function generateRandomAddress(): `0x${string}` {
  const buffer = new Uint8Array(20);
  crypto.getRandomValues(buffer);
  return bytesToHex(buffer);
}

async function deriveAesKeyFromAddress(address: string): Promise<CryptoKey> {
  const normalized = address.startsWith('0x') ? address.slice(2) : address;
  const addressBytes = hexToBytes(normalized.padStart(40, '0'));
  const digest = await crypto.subtle.digest('SHA-256', addressBytes);
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(message: string, passwordAddress: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKeyFromAddress(passwordAddress);
  const encryptedBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const ciphertext = new Uint8Array(encryptedBuffer);

  return {
    ciphertext,
    iv,
    ciphertextHex: bytesToHex(ciphertext),
    ivHex: bytesToHex(iv),
  };
}

export async function decryptSecret(ciphertextHex: string, ivHex: string, passwordAddress: string): Promise<string> {
  const ciphertext = hexToBytes(ciphertextHex);
  const iv = hexToBytes(ivHex);
  const key = await deriveAesKeyFromAddress(passwordAddress);
  const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

export function normalizeDecryptedAddress(value: string): `0x${string}` {
  if (value.startsWith('0x')) {
    const normalized = value.slice(2).padStart(40, '0');
    return `0x${normalized}` as `0x${string}`;
  }

  const bigIntValue = BigInt(value);
  const hex = bigIntValue.toString(16).padStart(40, '0');
  return `0x${hex}` as `0x${string}`;
}
