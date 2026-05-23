import crypto from "crypto";
import { config } from "../config.js";

const EMAIL_VERIFICATION_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_MINUTES = 30;

export function createRawToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createEmailVerificationToken() {
  const token = createRawToken();
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: addHours(new Date(), EMAIL_VERIFICATION_TTL_HOURS)
  };
}

export function createPasswordResetToken() {
  const token = createRawToken();
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: addMinutes(new Date(), PASSWORD_RESET_TTL_MINUTES)
  };
}

export function isFutureDate(value) {
  return value && new Date(value).getTime() > Date.now();
}

export function buildEmailVerificationLink(token) {
  return `${config.frontendOrigin}/?verifyEmailToken=${encodeURIComponent(token)}`;
}

export function buildPasswordResetLink(token) {
  return `${config.frontendOrigin}/?resetPasswordToken=${encodeURIComponent(token)}`;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
