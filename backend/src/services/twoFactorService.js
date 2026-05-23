import QRCode from "qrcode";
import { generateSecret, generateURI, verify } from "otplib";

const ISSUER = "TechFinances";

export function createTwoFactorSecret(email) {
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: ISSUER,
    label: email,
    secret
  });

  return { secret, otpauthUrl };
}

export async function createQrCodeDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl, {
    margin: 1,
    width: 220,
    color: {
      dark: "#031007",
      light: "#f5fff8"
    }
  });
}

export async function verifyTwoFactorCode(secret, code) {
  if (!secret || !code) return false;

  const result = await verify({
    token: String(code).trim(),
    secret
  });

  return result.valid;
}
