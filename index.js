// index.js — GoldenSpaceAI backend (launch-ready)

import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

// --------- SESSION ----------
app.use(session({
  secret: process.env.SESSION_SECRET || "goldensecret",
  resave: false,
  saveUninitialized: false
}));

// --------- PASSPORT ----------
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://codegoldenai.onrender.com/auth/google/callback"
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// --------- GOOGLE ROUTES ----------
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => res.redirect("/index.html")
);

app.get("/logout", (req, res) => {
  req.logout(() => {});
  res.redirect("/login.html");
});

// --------- STATIC FILES ----------
app.use(express.static(path.join(__dirname, "public"))); 

// Redirect root → login first
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// --------- OPENAI SETUP ----------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());

// GPT-4o-mini for Playground
app.post("/api/generate-playground", async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });
    res.json({ text: response.choices[0].message.content });
  } catch (err) {
    console.error("Playground error:", err);
    res.status(500).json({ text: "⚠️ Error generating response." });
  }
});

// GPT-4 for AdvancedAI
app.post("/api/generate-advanced", async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    });
    res.json({ text: response.choices[0].message.content });
  } catch (err) {
    console.error("AdvancedAI error:", err);
    res.status(500).json({ text: "⚠️ Error generating response." });
  }
});

// --------- START ----------
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
