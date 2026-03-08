import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

// In-memory verification code store
// Map<username, { code: string, expiresAt: number }>

// POST /auth/check-username
export const checkUsername = async (req: Request, res: Response) => {
  const { username: rawUsername } = req.body;
  if (!rawUsername) return res.status(400).json({ error: "Username required" });

  const username = rawUsername.toLowerCase();
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !user.is_placeholder) {
    return res.json({ isPlaceholder: false });
  }

  return res.json({ isPlaceholder: true });
};


export const register = async (req: Request, res: Response) => {
  try {
    const { username: rawUsername, email: rawEmail, password, apiKey } = req.body;
    const email = rawEmail.toLowerCase().trim();
    const username = rawUsername.toLowerCase();

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });

    let user;

    if (existingUser?.is_placeholder) {
      // Placeholder claim — require SRDC verification server-side
      if (!apiKey) {
        return res.status(400).json({ error: "API key required to claim this account" });
      }

      if (!existingUser.speedrun_com_id) {
        return res.status(400).json({ error: "No SRDC account linked to this username" });
      }

      // Verify against SRDC
      const srdcRes = await fetch("https://www.speedrun.com/api/v1/profile", {
        headers: {
          "X-API-Key": apiKey,
          Accept: "application/json",
          "User-Agent": "WizardingRuns/1.0",
        },
      });

      if (!srdcRes.ok) {
        return res.status(401).json({ error: "Invalid SRDC API key" });
      }

      const srdcData = await srdcRes.json();
      const returnedId: string = srdcData?.data?.id ?? "";

      if (returnedId !== existingUser.speedrun_com_id) {
        return res.status(401).json({ error: "API key does not match this account" });
      }

      // Check email isn't taken by another account
      const emailTaken = await prisma.user.findFirst({
        where: { email, NOT: { id: existingUser.id } },
      });
      if (emailTaken) {
        return res.status(400).json({ error: "Email already in use" });
      }

      const password_hash = await bcrypt.hash(password, 12);
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          email,
          password_hash,
          display_name: rawUsername,
          is_placeholder: false,
        },
      });
    } else {
      // Normal registration
      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
      });
      if (existing) {
        return res.status(400).json({ error: "Username or email already taken" });
      }

      const password_hash = await bcrypt.hash(password, 12);
      user = await prisma.user.create({
        data: { username, display_name: rawUsername, email, password_hash },
      });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
const { email: rawEmail, password } = req.body;
const email = rawEmail.toLowerCase().trim();
    if (!email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    if (!user.password_hash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
};


export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = (req as any).userId; // from your auth middleware

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.password_hash) {
      return res.status(400).json({ error: "No password set on this account" });
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    const password_hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { password_hash } });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to change password" });
  }
};