import { createPublicKey, createVerify, X509Certificate } from "node:crypto";

type JsonRecord = Record<string, unknown>;

// Public trust anchor published by Apple at apple.com/certificateauthority.
// It is not a secret. APPLE_ROOT_CA_PEM can append future Apple roots without a code change.
export const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

function decodePart(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid JWS encoding");
  return Buffer.from(value, "base64url");
}

function jsonPart(value: string): JsonRecord {
  const decoded = JSON.parse(decodePart(value).toString("utf8")) as unknown;
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("Invalid JWS JSON");
  return decoded as JsonRecord;
}

function configuredRoots(pem: string): X509Certificate[] {
  const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  if (!blocks.length) throw new Error("Apple root certificate is not configured");
  return blocks.map((block) => new X509Certificate(block));
}

function assertCurrent(certificate: X509Certificate, now: Date) {
  const from = Date.parse(certificate.validFrom);
  const to = Date.parse(certificate.validTo);
  if (!Number.isFinite(from) || !Number.isFinite(to) || now.getTime() < from || now.getTime() > to) {
    throw new Error("Apple signing certificate is outside its validity period");
  }
}

function verifyChain(chain: X509Certificate[], roots: X509Certificate[], now: Date) {
  if (chain.length < 2 || chain.length > 5) throw new Error("Invalid Apple certificate chain");
  chain.forEach((certificate) => assertCurrent(certificate, now));
  roots.forEach((certificate) => assertCurrent(certificate, now));
  if (chain[0].ca) throw new Error("Apple leaf certificate cannot be a CA");
  for (let index = 0; index < chain.length - 1; index += 1) {
    const child = chain[index];
    const issuer = chain[index + 1];
    if (!issuer.ca || !child.checkIssued(issuer) || !child.verify(issuer.publicKey)) {
      throw new Error("Invalid Apple certificate chain signature");
    }
  }
  const terminal = chain.at(-1)!;
  const trusted = roots.some((root) =>
    terminal.raw.equals(root.raw)
      || (terminal.checkIssued(root) && terminal.verify(root.publicKey)),
  );
  if (!trusted) throw new Error("Apple certificate chain is not trusted");
}

export function verifyAppleSignedData<T extends JsonRecord>(
  jws: string,
  rootCertificatePem: string,
  now = new Date(),
): T {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new Error("Invalid Apple JWS");
  const header = jsonPart(parts[0]);
  if (header.alg !== "ES256" || !Array.isArray(header.x5c) || header.x5c.some((value) => typeof value !== "string")) {
    throw new Error("Unsupported Apple JWS header");
  }
  const chain = (header.x5c as string[]).map((value) => new X509Certificate(Buffer.from(value, "base64")));
  verifyChain(chain, configuredRoots(rootCertificatePem), now);
  const verifier = createVerify("SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const valid = verifier.verify(
    { key: createPublicKey(chain[0].publicKey), dsaEncoding: "ieee-p1363" },
    decodePart(parts[2]),
  );
  if (!valid) throw new Error("Invalid Apple JWS signature");
  return jsonPart(parts[1]) as T;
}

export type AppleNotification = JsonRecord & {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  signedDate?: number;
  data?: JsonRecord & {
    bundleId?: string;
    environment?: string;
    signedTransactionInfo?: string;
  };
};

export type AppleTransaction = JsonRecord & {
  appAccountToken?: string;
  bundleId?: string;
  environment?: string;
  expiresDate?: number;
  originalTransactionId?: string;
  productId?: string;
  purchaseDate?: number;
  transactionId?: string;
};

export function isInitialAppleSubscription(notification: AppleNotification): boolean {
  return notification.notificationType === "SUBSCRIBED" && notification.subtype === "INITIAL_BUY";
}
