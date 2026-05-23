import crypto from "node:crypto";
import { prisma } from "../prisma.js";

export function getDeviceHash(req) {
  const deviceId = String(req.headers["x-device-id"] || "").trim();

  if (!/^[a-zA-Z0-9_-]{24,160}$/.test(deviceId)) {
    return null;
  }

  return crypto.createHash("sha256").update(deviceId).digest("hex");
}

export async function isTrustedDevice(userId, deviceHash) {
  if (!deviceHash) return false;

  const trustedDevice = await prisma.trustedDevice.findUnique({
    where: {
      userId_deviceHash: {
        userId,
        deviceHash
      }
    }
  });

  if (!trustedDevice) return false;

  await prisma.trustedDevice.update({
    where: { id: trustedDevice.id },
    data: { lastUsedAt: new Date() }
  });

  return true;
}

export async function trustDevice(userId, deviceHash) {
  if (!deviceHash) return;

  await prisma.trustedDevice.upsert({
    where: {
      userId_deviceHash: {
        userId,
        deviceHash
      }
    },
    update: { lastUsedAt: new Date() },
    create: { userId, deviceHash }
  });
}

export async function clearTrustedDevices(userId) {
  await prisma.trustedDevice.deleteMany({ where: { userId } });
}

export async function listTrustedDevices(userId, currentDeviceHash) {
  const devices = await prisma.trustedDevice.findMany({
    where: { userId },
    orderBy: { lastUsedAt: "desc" }
  });

  return devices.map((device, index) => ({
    id: device.id,
    label: currentDeviceHash && device.deviceHash === currentDeviceHash ? "Este dispositivo" : `Dispositivo ${index + 1}`,
    trustedAt: device.trustedAt,
    lastUsedAt: device.lastUsedAt,
    current: Boolean(currentDeviceHash && device.deviceHash === currentDeviceHash)
  }));
}

export async function clearOtherTrustedDevices(userId, currentDeviceHash) {
  if (!currentDeviceHash) {
    await clearTrustedDevices(userId);
    return;
  }

  await prisma.trustedDevice.deleteMany({
    where: {
      userId,
      deviceHash: { not: currentDeviceHash }
    }
  });
}
