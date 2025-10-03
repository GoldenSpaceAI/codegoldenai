// index.js — Full backend for CodeGoldenAI
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";  // ✅ Gemini SDK

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
  })
);

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://codegoldenai.onrender.com/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Google login routes
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login.html",
    successRedirect: "/index.html",
  })
);

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// Default route → login.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// ========== AI ROUTES ==========

// Playground (GPT-4o-mini)
app.post("/api/generate-playground", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided." });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    res.json({ text: completion.choices[0]?.message?.content || "No response." });
  } catch (err) {
    console.error("Playground error:", err);
    res.status(500).json({ error: "Error generating response." });
  }
});

// AdvancedAI (GPT-4)
app.post("/api/generate-advanced", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided." });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    res.json({ text: completion.choices[0]?.message?.content || "No response." });
  } catch (err) {
    console.error("AdvancedAI error:", err);
    res.status(500).json({ error: "Error generating response." });
  }
});

// UltraAI (Gemini Ultra)
app.post("/api/generate-ultra", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided." });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // ✅ Gemini Ultra

    const result = await model.generateContent(prompt);
    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;

    res.json({ text: text || "No response." });
  } catch (err) {
    console.error("UltraAI error:", err);
    res.status(500).json({ error: "Error generating Ultra response." });
  }
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
