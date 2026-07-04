// Signing module — Ed25519 primitives: keypairs, canonical-JSON document signing, and signed control-plane requests
export { canonicalStringify } from './canonical';
export { generateSigningKeyPair, type SignedDocument, signDocument, verifyDocument } from './document';
export {
  buildRequestCanonical,
  type RequestCanonicalInput,
  type SignRequestInput,
  signRequestHeaders,
  type VerifySignedRequestInput,
  verifySignedRequest,
} from './request';
