import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { ensureUserDefaults } from "../services/financeService.js";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import {
  buildEmailVerificationLink,
  buildPasswordResetLink,
  createEmailVerificationToken,
  createPasswordResetToken,
  hashToken,
  isFutureDate
} from "../services/accountTokenService.js";
import {
  createQrCodeDataUrl,
  createTwoFactorSecret,
  verifyTwoFactorCode
} from "../services/twoFactorService.js";
import {
  clearTrustedDevices,
  clearOtherTrustedDevices,
  getDeviceHash,
  isTrustedDevice,
  listTrustedDevices,
  trustDevice
} from "../services/trustedDeviceService.js";

export const authRoutes = Router();

const registerSchema = z.object({
  name: z.string().min(2, "Nome precisa ter pelo menos 2 caracteres."),
  email: z.string().email("Email invalido.").toLowerCase(),
  password: z.string().min(8, "Senha precisa ter pelo menos 8 caracteres.")
});

const loginSchema = z.object({
  email: z.string().email("Email invalido.").toLowerCase(),
  password: z.string().min(1, "Senha obrigatoria."),
  twoFactorCode: z.string().optional()
});

const twoFactorCodeSchema = z.object({
  code: z.string().min(6, "Informe o codigo de 6 digitos.").max(8)
});

const disableTwoFactorSchema = z.object({
  password: z.string().min(1, "Senha obrigatoria."),
  code: z.string().min(6, "Informe o codigo de 6 digitos.").max(8)
});

const updateProfileSchema = z.object({
  name: z.string().min(2, "Nome precisa ter pelo menos 2 caracteres.").optional(),
  email: z.string().email("Email invalido.").toLowerCase().optional()
}).refine((data) => data.name || data.email, "Informe nome ou email para atualizar.");

const emailSchema = z.object({
  email: z.string().email("Email invalido.").toLowerCase()
});

const tokenSchema = z.object({
  token: z.string().min(32, "Token invalido.")
});

const resetPasswordSchema = z.object({
  token: z.string().min(32, "Token invalido."),
  password: z.string().min(8, "Senha precisa ter pelo menos 8 caracteres.")
});

authRoutes.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });

    if (existing) {
      throw new HttpError(409, "Ja existe uma conta com este email.");
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const verification = createEmailVerificationToken();
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        emailVerificationTokenHash: verification.tokenHash,
        emailVerificationExpiresAt: verification.expiresAt
      }
    });
    await ensureUserDefaults(user.id);
    await trustDevice(user.id, getDeviceHash(req));

    return res.status(201).json({
      ...buildSession(user),
      emailVerification: buildDevEmailVerification(verification.token)
    });
  } catch (error) {
    return next(error);
  }
});

authRoutes.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const deviceHash = getDeviceHash(req);
    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user) {
      throw new HttpError(401, "Email ou senha invalidos.");
    }

    const passwordMatches = await bcrypt.compare(data.password, user.passwordHash);
    if (!passwordMatches) {
      throw new HttpError(401, "Email ou senha invalidos.");
    }

    const trustedDevice = await isTrustedDevice(user.id, deviceHash);

    if (user.twoFactorEnabled && !trustedDevice) {
      if (!data.twoFactorCode) {
        return res.status(202).json({
          requiresTwoFactor: true,
          message: "Novo dispositivo detectado. Informe o codigo do aplicativo autenticador."
        });
      }

      const codeMatches = await verifyTwoFactorCode(user.twoFactorSecret, data.twoFactorCode);
      if (!codeMatches) {
        throw new HttpError(401, "Codigo 2FA invalido.");
      }

      await trustDevice(user.id, deviceHash);
    } else if (!user.twoFactorEnabled) {
      await trustDevice(user.id, deviceHash);
    }

    return res.json(buildSession(user));
  } catch (error) {
    return next(error);
  }
});

authRoutes.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    const currentDeviceHash = getDeviceHash(req);
    const trustedDevices = await listTrustedDevices(user.id, currentDeviceHash);

    return res.json({
      user: publicUser(user),
      trustedDevices
    });
  } catch (error) {
    return next(error);
  }
});

authRoutes.put("/profile", requireAuth, async (req, res, next) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    const currentUser = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    const updateData = {};
    let emailVerification = null;

    if (data.name) {
      updateData.name = data.name.trim();
    }

    if (data.email && data.email !== currentUser.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing && existing.id !== currentUser.id) {
        throw new HttpError(409, "Ja existe uma conta com este email.");
      }

      const verification = createEmailVerificationToken();
      updateData.email = data.email;
      updateData.emailVerifiedAt = null;
      updateData.emailVerificationTokenHash = verification.tokenHash;
      updateData.emailVerificationExpiresAt = verification.expiresAt;
      emailVerification = buildDevEmailVerification(verification.token);
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData
    });

    return res.json({
      user: publicUser(user),
      emailVerification,
      message: emailVerification
        ? "Perfil atualizado. Confirme o novo email para concluir a verificacao."
        : "Perfil atualizado."
    });
  } catch (error) {
    return next(error);
  }
});

authRoutes.post("/email-verification/resend", requireAuth, async (req, res, next) => {
  try {
    const currentUser = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    if (currentUser.emailVerifiedAt) {
      return res.json({ user: publicUser(currentUser), message: "Email ja confirmado." });
    }

    const verification = createEmailVerificationToken();
    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        emailVerificationTokenHash: verification.tokenHash,
        emailVerificationExpiresAt: verification.expiresAt
      }
    });

    return res.json({
      user: publicUser(user),
      emailVerification: buildDevEmailVerification(verification.token),
      message: "Novo link de confirmacao gerado."
    });
  } catch (error) {
    return next(error);
  }
});

authRoutes.post("/email-verification/confirm", async (req, res, next) => {
  try {
    const { token } = tokenSchema.parse(req.body);
    const tokenHash = hashToken(token);
    const user = await prisma.user.findFirst({ where: { emailVerificationTokenHash: tokenHash } });

    if (!user || !isFutureDate(user.emailVerificationExpiresAt)) {
      throw new HttpError(400, "Link de confirmacao invalido ou expirado.");
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null
      }
    });

    return res.json({
      user: publicUser(updatedUser),
      message: "Email confirmado com sucesso."
    });
  } catch (error) {
    return next(error);
  }
});

authRoutes.post("/password/forgot", async (req, res, next) => {
  try {
    const { email } = emailSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({ message: "Se o email existir, enviaremos instrucoes de recuperacao." });
    }

    const reset = createPasswordResetToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: reset.tokenHash,
        passwordResetExpiresAt: reset.expiresAt
      }
    });

    return res.json({
      passwordReset: buildDevPasswordReset(reset.token),
      message: "Se o email existir, enviaremos instrucoes de recuperacao."
    });
  } catch (error) {
    return next(error);
  }
});

authRoutes.post("/password/reset", async (req, res, next) => {
  try {
    const data = resetPasswordSchema.parse(req.body);
    const tokenHash = hashToken(data.token);
    const user = await prisma.user.findFirst({ where: { passwordResetTokenHash: tokenHash } });

    if (!user || !isFutureDate(user.passwordResetExpiresAt)) {
      throw new HttpError(400, "Link de recuperacao invalido ou expirado.");
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null
      }
    });
    await clearTrustedDevices(user.id);

    return res.json({ message: "Senha redefinida. Faca login novamente." });
  } catch (error) {
    return next(error);
  }
});

authRoutes.get("/trusted-devices", requireAuth, async (req, res, next) => {
  try {
    const devices = await listTrustedDevices(req.user.id, getDeviceHash(req));
    return res.json({ trustedDevices: devices });
  } catch (error) {
    return next(error);
  }
});

authRoutes.delete("/trusted-devices", requireAuth, async (req, res, next) => {
  try {
    const currentDeviceHash = getDeviceHash(req);
    await clearOtherTrustedDevices(req.user.id, currentDeviceHash);
    await trustDevice(req.user.id, currentDeviceHash);
    const devices = await listTrustedDevices(req.user.id, currentDeviceHash);

    return res.json({
      trustedDevices: devices,
      message: "Outros dispositivos foram removidos. Este navegador continua conectado."
    });
  } catch (error) {
    return next(error);
  }
});

authRoutes.post("/2fa/setup", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    const { secret, otpauthUrl } = createTwoFactorSecret(user.email);
    const qrCodeDataUrl = await createQrCodeDataUrl(otpauthUrl);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: false
      }
    });

    return res.json({
      qrCodeDataUrl,
      manualKey: secret,
      message: "Escaneie o QR Code e confirme com o codigo de 6 digitos."
    });
  } catch (error) {
    return next(error);
  }
});

authRoutes.post("/2fa/enable", requireAuth, async (req, res, next) => {
  try {
    const { code } = twoFactorCodeSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });

    if (!user.twoFactorSecret) {
      throw new HttpError(400, "Inicie a configuracao do 2FA antes de ativar.");
    }

    if (!(await verifyTwoFactorCode(user.twoFactorSecret, code))) {
      throw new HttpError(400, "Codigo 2FA invalido.");
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true }
    });
    await trustDevice(user.id, getDeviceHash(req));

    return res.json({
      user: publicUser(updatedUser),
      message: "2FA ativado com sucesso."
    });
  } catch (error) {
    return next(error);
  }
});

authRoutes.post("/2fa/disable", requireAuth, async (req, res, next) => {
  try {
    const data = disableTwoFactorSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    const passwordMatches = await bcrypt.compare(data.password, user.passwordHash);

    if (!passwordMatches) {
      throw new HttpError(401, "Senha invalida.");
    }

    if (!(await verifyTwoFactorCode(user.twoFactorSecret, data.code))) {
      throw new HttpError(400, "Codigo 2FA invalido.");
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null
      }
    });
    await clearTrustedDevices(user.id);
    await trustDevice(user.id, getDeviceHash(req));

    return res.json({
      user: publicUser(updatedUser),
      message: "2FA desativado."
    });
  } catch (error) {
    return next(error);
  }
});

function buildSession(user) {
  const token = jwt.sign({ email: user.email }, config.jwtSecret, {
    subject: user.id,
    expiresIn: config.jwtExpiresIn
  });

  return {
    token,
    user: publicUser(user)
  };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    twoFactorEnabled: user.twoFactorEnabled
  };
}

function buildDevEmailVerification(token) {
  return {
    token,
    link: buildEmailVerificationLink(token),
    note: "Em producao, envie este link por email."
  };
}

function buildDevPasswordReset(token) {
  return {
    token,
    link: buildPasswordResetLink(token),
    note: "Em producao, envie este link por email."
  };
}
