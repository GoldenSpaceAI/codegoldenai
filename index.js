// index.js — CodeGoldenAI
import express from "express";
import session from "express-session";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Fix dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
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
  new GoogleStrategy.Strategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, { email: profile.emails[0].value });
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// --- Auth Routes ---
app.get("/auth/google", passport.authenticate("google", { scope: ["email"] }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    res.redirect("/index.html");
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/login.html"));
});

// --- Protect pages ---
function ensureLogin(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login.html");
}

// Always show login first
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

app.get("/index.html", ensureLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/plans.html", ensureLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public/plans.html"));
});

app.get("/engineer.html", ensureLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public/engineer.html"));
});

app.get("/advancedai.html", ensureLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public/advancedai.html"));
});

// --- AdvancedAI API ---
import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/api/generate-advanced", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ text: "No prompt provided" });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const reply = completion.choices[0].message.content;
    res.json({ text: reply });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ text: "⚠️ Error generating response." });
  }
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
