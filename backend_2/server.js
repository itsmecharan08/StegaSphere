const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
// const axios = require("axios"); 
const { authenticator } = require("otplib");
const QRCode = require("qrcode");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;
const SECRET_KEY = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

// ==================== CORS Configuration ====================
app.use(cors({
  origin: [
   'http://localhost:3000',
    'https://StegaSphere.vercel.app'
       ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Cookie', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// ==================== Middleware ====================
app.use(cookieParser());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/StegaSphere", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Import User model
const User = require("./User");

// Email Transporter Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail', // or use host/port
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Helper to send verification email
const sendVerificationEmail = async (email, code) => {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'no-reply@StegaSphere.com',
    to: email,
    subject: 'StegaSphere Email Verification',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Verify your email</h2>
        <p>Your verification code is:</p>
        <h1 style="color: #4F46E5; letter-spacing: 5px;">${code}</h1>
        <p>This code will expire in 15 minutes.</p>
      </div>
    `
  };

  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log("⚠️ EMAIL_USER or EMAIL_PASS not set. Verification code for " + email + ": " + code);
      return; 
    }
    await transporter.sendMail(mailOptions);
    console.log(`📧 Verification email sent to ${email}`);
  } catch (error) {
    console.error("Email send error:", error);
    // In dev, usually we just want to know the code
    if (process.env.NODE_ENV !== 'production') {
       console.log("Fallback: Verification code for " + email + ": " + code);
    }
  }
};

// Root route
app.get("/", (req, res) => {
  res.send("Welcome to the StegaSphere API!");
});

// Test route
app.get("/api/test", (req, res) => {
  res.status(200).json({ message: "API is working!" });
});

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }
  
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
      });
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Register Route
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      // If user exists but not verified, we could resend code, 
      // but for simplicity, just say "Email already registered"
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate 6 digit code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      isVerified: false,
      verificationToken: verificationCode,
      verificationTokenExpires: tokenExpires
    });

    // Send Email
    await sendVerificationEmail(email, verificationCode);

    res.status(201).json({ 
      message: "Registration successful. Please verify your email.",
      email: email // Send back email so frontend can use it
    });

  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

// Verify Email Route
app.post("/api/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(200).json({ message: "Email already verified. Please login." });
    }

    if (user.verificationToken !== code) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    if (user.verificationTokenExpires < Date.now()) {
      return res.status(400).json({ message: "Verification code expired" });
    }

    // Mark verified
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    // Now issue token (Auto login after verification)
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username,
        email: user.email 
      },
      SECRET_KEY,
      { expiresIn: "7d" }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.status(200).json({
      message: "Email verified successfully",
      user: {
        username: user.username,
        email: user.email,
        isSubscribed: user.isSubscribed || false
      }
    });

  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ message: "Verification failed" });
  }
});

// Resend Verification Code Route
app.post("/api/resend-code", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationToken = verificationCode;
    user.verificationTokenExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(email, verificationCode);

    res.status(200).json({ message: "Verification code resent" });
  } catch (error) {
    res.status(500).json({ message: "Failed to resend code" });
  }
});

// Login Route
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    // Check verification status (skip for Google users as they are verified by Google)
    if (!user.isGoogleUser && !user.isVerified) {
       return res.status(403).json({ 
         message: "Please verify your email before logging in",
         email: user.email,
         isNotVerified: true 
       });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    // 2FA Check
    if (user.isTwoFactorEnabled) {
      const tempToken = jwt.sign(
        { userId: user._id, type: "2fa_pending" },
        SECRET_KEY,
        { expiresIn: "5m" }
      );
      return res.status(200).json({ 
        require2FA: true, 
        tempToken,
        message: "Two-factor authentication required" 
      });
    }

    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username,
        email: user.email 
      },
      SECRET_KEY,
      { expiresIn: "7d" }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    // Calculate subscription status
    let hasActiveSubscription = false;
    if (user.isSubscribed && user.subscriptionStart && user.subscriptionPlan !== "none") {
      const startDate = new Date(user.subscriptionStart);
      const currentDate = new Date();
      
      if (user.subscriptionPlan === "1month") {
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        hasActiveSubscription = currentDate >= startDate && currentDate < endDate;
      } else if (user.subscriptionPlan === "1year") {
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        hasActiveSubscription = currentDate >= startDate && currentDate < endDate;
      }
    }

    res.status(200).json({ 
      user: {
        username: user.username, 
        email: user.email,
        subscriptionPlan: user.subscriptionPlan || 'none',
        isSubscribed: user.isSubscribed || false,
        subscriptionStart: user.subscriptionStart || null,
        hasActiveSubscription
      }
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// ==================== 2FA Routes ====================

// 1. Verify 2FA during Login
app.post("/api/auth/2fa/verify-login", async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    
    if (!tempToken || !code) {
      return res.status(400).json({ message: "Token and code are required" });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, SECRET_KEY);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }

    if (decoded.type !== "2fa_pending") {
      return res.status(401).json({ message: "Invalid token type" });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify TOTP code
    const isValid = authenticator.check(code, user.twoFactorSecret);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid 2FA code" });
    }

    // Generate real auth token
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username,
        email: user.email 
      },
      SECRET_KEY,
      { expiresIn: "7d" }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.status(200).json({ 
      user: {
        username: user.username, 
        email: user.email,
        subscriptionPlan: user.subscriptionPlan || 'none',
        isSubscribed: user.isSubscribed || false,
        subscriptionStart: user.subscriptionStart || null,
      },
      token 
    });

  } catch (error) {
    console.error("2FA Login verification error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 2. Setup 2FA: Generate Secret & QR Code (Authenticated)
app.post("/api/auth/2fa/setup", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const secret = authenticator.generateSecret();
    user.tempTwoFactorSecret = secret;
    await user.save();

    const otpauth = authenticator.keyuri(user.email, "StegaSphere", secret);
    const imageUrl = await QRCode.toDataURL(otpauth);

    res.status(200).json({ secret, qrCode: imageUrl });
  } catch (error) {
    console.error("2FA Setup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// 3. Enable 2FA: Verify code and activate (Authenticated)
app.post("/api/auth/2fa/enable", authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (!user || (!user.tempTwoFactorSecret && !user.twoFactorSecret)) {
      return res.status(400).json({ message: "Please request 2FA setup first" });
    }

    // Check against temp secret
    const isValid = authenticator.check(code, user.tempTwoFactorSecret || user.twoFactorSecret);

    if (!isValid) {
      return res.status(400).json({ message: "Invalid code" });
    }

    if (user.tempTwoFactorSecret) {
      user.twoFactorSecret = user.tempTwoFactorSecret;
      user.isTwoFactorEnabled = true;
      user.tempTwoFactorSecret = undefined;
      await user.save();
    }

    res.status(200).json({ message: "2FA Enabled successfully" });
  } catch (error) {
    console.error("2FA Enable error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// 4. Disable 2FA
app.post("/api/auth/2fa/disable", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    user.isTwoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();
    res.status(200).json({ message: "2FA Disabled" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Logout Route
app.post("/api/logout", (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/'
  });
  res.status(200).json({ message: "Logged out successfully" });
});

// Get current user from database
app.get("/api/user/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password')
      .lean();
    
    if (!user) {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
      });
      return res.status(404).json({ message: "User not found" });
    }
    
    // Calculate if subscription is active
    let hasActiveSubscription = false;
    if (user.isSubscribed && user.subscriptionStart && user.subscriptionPlan !== "none") {
      const startDate = new Date(user.subscriptionStart);
      const currentDate = new Date();
      
      if (user.subscriptionPlan === "1month") {
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        hasActiveSubscription = currentDate >= startDate && currentDate < endDate;
      } else if (user.subscriptionPlan === "1year") {
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        hasActiveSubscription = currentDate >= startDate && currentDate < endDate;
      }
    }
    
    res.status(200).json({
      user: {
        ...user,
        hasActiveSubscription
      }
    });
  } catch (err) {
    console.error("❌ Get user error:", err);
    res.status(500).json({ message: "Failed to get user data" });
  }
});

// In your server.js, add this endpoint:
app.post("/api/user/check-google", async (req, res) => {
  try {
    const { email, name, image } = req.body;
    console.log("🔵 /api/user/check-google called with:", req.body);
    if (!email) {
        console.log("❌ No email provided");
      return res.status(400).json({ message: "Email is required" });
    }
    console.log("🔍 Searching for existing user with email:", email);
    // Check if Google user already exists
    let user = await User.findOne({ 
      $or: [
        { email: email },
        { googleId: email } // You might want to add a googleId field
      ] 
    });
    
    let isNewUser = false;
    
    if (!user) {
      // Create new user for Google sign-in
      isNewUser = true;
      user = await User.create({
        username: email.split('@')[0] + '_google', // Generate username
        email: email,
        name: name,
        googleId: email, // Store Google identifier
        isGoogleUser: true,
        profileImage: image,
        password: null, // No password for Google users
        subscriptionPlan: "none",
        isSubscribed: false,
        subscriptionStart: null
      });
      console.log(`✅ Created new Google user: ${email}`);
    }
    
    // Calculate subscription status
    let hasActiveSubscription = false;
    if (user.isSubscribed && user.subscriptionStart && user.subscriptionPlan !== "none") {
      const startDate = new Date(user.subscriptionStart);
      const currentDate = new Date();
      
      if (user.subscriptionPlan === "1month") {
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        hasActiveSubscription = currentDate >= startDate && currentDate < endDate;
      } else if (user.subscriptionPlan === "1year") {
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        hasActiveSubscription = currentDate >= startDate && currentDate < endDate;
      }
    }
    
    // Generate token for Google users too (optional)
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        isGoogle: true 
      },
      SECRET_KEY,
      { expiresIn: "7d" }
    );
    
    // Set cookie for Google users too
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });
    
    res.status(200).json({
      message: isNewUser ? "Google user created successfully" : "Google user found",
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        profileImage: user.image,
        isGoogleUser: true,
        subscriptionPlan: user.subscriptionPlan,
        isSubscribed: user.isSubscribed,
        subscriptionStart: user.subscriptionStart,
        hasActiveSubscription
      },
      hasActiveSubscription
    });
    
  } catch (err) {
    console.error("❌ Google user check error:", err);
    res.status(500).json({ 
      message: "Failed to process Google user",
      error: err.message 
    });
  }
});

// Enhanced Update subscription status
app.post("/api/user/subscription", authenticateToken, async (req, res) => {
  try {
    const { plan, paymentId, amount, currency, period } = req.body;
    
    console.log("Subscription request received:", { plan, paymentId, amount, currency, period });
    
    if (!plan || !["1month", "1year"].includes(plan)) {
      return res.status(400).json({ 
        message: "Invalid plan. Must be '1month' or '1year'" 
      });
    }
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Update subscription
    user.subscriptionPlan = plan;
    user.subscriptionStart = new Date();
    user.isSubscribed = true;
    await user.save();
    
    res.status(200).json({
      message: `🎉 Subscription activated successfully! ${period || (plan === '1year' ? 'Yearly' : 'Monthly')} plan is now active.`,
      user: {
        username: user.username,
        email: user.email,
        subscriptionPlan: user.subscriptionPlan,
        isSubscribed: user.isSubscribed,
        subscriptionStart: user.subscriptionStart,
        hasActiveSubscription: true
      }
    });
  } catch (err) {
    console.error("❌ Subscription update error:", err);
    res.status(500).json({ 
      message: "Failed to update subscription",
      error: err.message 
    });
  }
});

// Get subscription details
app.get("/api/user/subscription", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('subscriptionPlan subscriptionStart isSubscribed');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Calculate if subscription is active
    let hasActiveSubscription = false;
    let daysRemaining = 0;
    
    if (user.isSubscribed && user.subscriptionStart && user.subscriptionPlan !== "none") {
      const startDate = new Date(user.subscriptionStart);
      const currentDate = new Date();
      
      if (user.subscriptionPlan === "1month") {
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        hasActiveSubscription = currentDate < endDate;
        daysRemaining = Math.ceil((endDate - currentDate) / (1000 * 60 * 60 * 24));
      } else if (user.subscriptionPlan === "1year") {
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        hasActiveSubscription = currentDate < endDate;
        daysRemaining = Math.ceil((endDate - currentDate) / (1000 * 60 * 60 * 24));
      }
    }
    
    res.status(200).json({
      subscription: {
        plan: user.subscriptionPlan,
        isSubscribed: user.isSubscribed,
        startDate: user.subscriptionStart,
        hasActiveSubscription,
        daysRemaining: hasActiveSubscription ? daysRemaining : 0
      }
    });
  } catch (err) {
    console.error("❌ Get subscription error:", err);
    res.status(500).json({ message: "Failed to get subscription details" });
  }
});

// ==================== Keep-Alive Mechanism ====================
// REMOVED

// ✅ Start the Server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌐 Frontend URL: http://localhost:3000`);
  console.log(`🔗 Test API: http://localhost:${PORT}/api/test`);
});