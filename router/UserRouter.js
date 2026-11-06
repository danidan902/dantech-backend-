import User from "../models/User.js";
import jwt from "jsonwebtoken";
import express from "express";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Plain-text comparison (no hashing)
    if (password !== user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ===== CREATE ADMIN (NO HASH) =====
router.post("/seed-admin", async (req, res) => {
  try {
    const existing = await User.findOne({ email: "danid93575@gmail.com" });
    if (existing) {
      return res.json({
        success: true,
        message: "Admin already exists",
        email: "danid93575@gmail.com",
      });
    }

    await User.create({
      name: "Admin",
      email: "danid93575@gmail.com",
      password: "dani@12345",   // plain text
      role: "admin",
    });

    return res.json({
      success: true,
      message: "Admin created",
      email: "danid93575@gmail.com",
      password: "dani@12345",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;