#!/usr/bin/env node
// Prints a fresh Ed25519 license key pair as env lines (cloud keeps SIGNING, deployments get PUBLIC)
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');

console.log(`LICENSE_SIGNING_KEY=${privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')}`);
console.log(`LICENSE_PUBLIC_KEY=${publicKey.export({ type: 'spki', format: 'der' }).toString('base64')}`);
