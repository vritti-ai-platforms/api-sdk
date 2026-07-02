import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { canonicalStringify } from './canonical';
import type { SignedDocument } from './types';

// Generates an Ed25519 key pair as base64 DER strings (pkcs8 private / spki public)
export function generateLicenseKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  };
}

// Signs a payload's canonical JSON with an Ed25519 private key (base64 pkcs8 DER)
export function signDocument<T>(payload: T, privateKeyBase64: string): SignedDocument<T> {
  const key = createPrivateKey({ key: Buffer.from(privateKeyBase64, 'base64'), format: 'der', type: 'pkcs8' });
  const signature = sign(null, Buffer.from(canonicalStringify(payload), 'utf8'), key).toString('base64');
  return { payload, signature };
}

// Verifies a signed document against an Ed25519 public key (base64 spki DER); malformed input ⇒ false
export function verifyDocument<T>(doc: SignedDocument<T>, publicKeyBase64: string): boolean {
  try {
    const key = createPublicKey({ key: Buffer.from(publicKeyBase64, 'base64'), format: 'der', type: 'spki' });
    return verify(
      null,
      Buffer.from(canonicalStringify(doc.payload), 'utf8'),
      key,
      Buffer.from(doc.signature, 'base64'),
    );
  } catch {
    return false;
  }
}
