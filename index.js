// index.js — CodeGoldenAI backend

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
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || "supersecret",
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// User DB (temporary in memory)
const users = {}; 
const requests = []; // upgrade requests

// Passport Google
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_REDIRECT_URI || "https://codegoldenai.onrender.com/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  if (!users[email]) {
    users[email] = { email, plan: "free", expiry: null };
  }
  return done(null, users[email]);
}));
passport.serializeUser((user, done) => done(null, user.email));
passport.deserializeUser((email, done) => done(null, users[email]));

// Google login routes
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => { res.redirect("/index.html"); }
);

// Middleware for auth
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.redirect("/login.html");
}

// Middleware to enforce plan
function checkAccess(page) {
  return (req, res, next) => {
    if (!req.isAuthenticated()) return res.redirect("/login.html");

    const user = users[req.user.email];
    const now = new Date();

    if (user.expiry && now > new Date(user.expiry)) {
      user.plan = "free";
      user.expiry = null;
    }

    if (page === "advancedai" && user.plan === "free")
      return res.status(403).send("Upgrade required");
    if (page === "engineer" && user.plan !== "pro")
      return res.status(403).send("Pro required");

    next();
  };
}

// Static files
app.use(express.static(__dirname));

// Routes with plan checks
app.get("/playground.html", ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "playground.html"));
});
app.get("/advancedai.html", ensureAuth, checkAccess("advancedai"), (req, res) => {
  res.sendFile(path.join(__dirname, "advancedai.html"));
});
app.get("/engineer.html", ensureAuth, checkAccess("engineer"), (req, res) => {
  res.sendFile(path.join(__dirname, "engineer.html"));
});

// --- Admin unlock ---
app.post("/api/admin/unlock", (req, res) => {
  const { password } = req.body;
  if (password === process.env.URL_PASS) {
    req.session.admin = true;
    return res.sendStatus(200);
  }
  res.status(403).json({ error: "Wrong password" });
});

app.get("/api/admin/requests", (req, res) => {
  if (!req.session.admin) return res.status(403).json({ error: "Unauthorized" });
  res.json(requests);
});

app.post("/api/admin/approve", (req, res) => {
  if (!req.session.admin) return res.status(403).json({ error: "Unauthorized" });
  const { email, plan } = req.body;
  if (users[email]) {
    users[email].plan = plan;
    users[email].expiry = new Date(Date.now() + 30*24*60*60*1000); // 30 days
  }
  res.sendStatus(200);
});

app.post("/api/admin/decline", (req, res) => {
  if (!req.session.admin) return res.status(403).json({ error: "Unauthorized" });
  const { email } = req.body;
  res.sendStatus(200);
});

// Upgrade request (from plans.html)
app.post("/api/upgrade", ensureAuth, (req, res) => {
  const { plan } = req.body;
  requests.push({ email: req.user.email, plan, date: new Date(), status: "pending" });
  res.sendStatus(200);
});

// --- AI Endpoints ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/api/ask-playground", ensureAuth, async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });
    res.json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OpenAI request failed" });
  }
});

app.post("/api/ask-advanced", ensureAuth, checkAccess("advancedai"), async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    });
    res.json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OpenAI request failed" });
  }
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Server running on port " + PORT));
