// index.js — CodeGoldenAI with Google OAuth + AI + Engineer Requests

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import session from "express-session";
import { OpenAI } from "openai";
import path from "path";
import { fileURLToPath } from "url";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import nodemailer from "nodemailer";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Trust Render proxy
app.set("trust proxy", 1);

// ✅ Force HTTPS
app.use((req, res, next) => {
  if (req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "render_secret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Passport serialize/deserialize
passport.serializeUser((user, done) => {
  user.plan = "Free"; // default plan
  done(null, user);
});
passport.deserializeUser((obj, done) => done(null, obj));

// ✅ Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://codegoldenai.onrender.com/auth/google/callback"
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }
));

// ✅ Google login
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    // Redirect to homepage
    res.redirect("/index.html");
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/login.html"));
});

// ✅ API endpoint for user info
app.get("/api/me", (req, res) => {
  if (!req.user) return res.json({ loggedIn: false });
  res.json({
    loggedIn: true,
    email: req.user.emails[0].value,
    name: req.user.displayName,
    picture: req.user.photos?.[0]?.value || null,
    plan: req.user.plan || "Free"
  });
});

// ✅ Engineer Request API (sends email to you)
app.post("/api/send-engineer-request", async (req, res) => {
  try {
    const { email, name, type, description } = req.body;

    // Configure mail transporter
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // your Gmail
        pass: process.env.EMAIL_PASS  // app password
      }
    });

    await transporter.sendMail({
      from: `"CodeGoldenAI" <${process.env.EMAIL_USER}>`,
      to: "goldenspaceais@gmail.com",
      subject: `New Engineer Request (${type})`,
      text: `New request from ${name} (${email})\n\nType: ${type}\n\nDescription:\n${description}`
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ error: "Failed to send email" });
  }
});

// ✅ Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/index.html", (req, res) => {
  if (!req.user) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/plans.html", (req, res) => {
  if (!req.user) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "plans.html"));
});

app.get("/playground.html", (req, res) => {
  if (!req.user) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "playground.html"));
});

app.get("/engineer.html", (req, res) => {
  if (!req.user) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "engineer.html"));
});

// ✅ OpenAI API
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
app.post("/api/generate-ai", async (req, res) => {
  try {
    const { prompt } = req.body;
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional coding assistant." },
        { role: "user", content: prompt }
      ]
    });
    res.json({ code: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// ✅ Serve static files
app.use(express.static(__dirname));

// Start server
app.listen(PORT, () => console.log(`✅ CodeGoldenAI running at https://codegoldenai.onrender.com`));
