// index.js — CodeGoldenAI Server
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- SESSION ---
app.use(session({
  secret: process.env.SESSION_SECRET || "supersecret",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

// --- GOOGLE AUTH ---
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  return done(null, { id: profile.id, email: profile.emails[0].value });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// --- ROUTES ---
// First page = login
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// Main pages (require login)
app.get("/index.html", ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/plans.html", ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "plans.html"));
});
app.get("/playground.html", ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "playground.html"));
});
app.get("/advancedai.html", ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "advancedai.html"));
});
app.get("/engineer.html", ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "engineer.html"));
});

// --- GOOGLE LOGIN ---
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    res.redirect("/index.html");
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/"));
});

// --- OPENAI CLIENT ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Playground → GPT-4o-mini
app.post("/api/generate-playground", async (req, res) => {
  try {
    const { prompt } = req.body;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });
    res.json({ text: completion.choices[0].message.content });
  } catch (err) {
    console.error("Playground error:", err.message);
    res.status(500).json({ text: "⚠️ Playground error generating response." });
  }
});

// AdvancedAI → GPT-4
app.post("/api/generate-advanced", async (req, res) => {
  try {
    const { prompt } = req.body;
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    });
    res.json({ text: completion.choices[0].message.content });
  } catch (err) {
    console.error("AdvancedAI error:", err.message);
    res.status(500).json({ text: "⚠️ AdvancedAI error generating response." });
  }
});

// --- STATIC FILES ---
app.use(express.static(__dirname));

// --- AUTH MIDDLEWARE ---
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/");
}

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
