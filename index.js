// index.js — CodeGoldenAI backend

import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import cors from "cors";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import path from "path";
import { fileURLToPath } from "url";
import { OpenAI } from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Middleware ----
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
  })
);

// ---- Passport Setup ----
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
      return done(null, {
        email: profile.emails[0].value,
        name: profile.displayName,
        picture: profile.photos[0].value,
      });
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ---- OpenAI Setup ----
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Memory (temporary store) ----
let upgradeRequests = []; // { email, plan }
let activePlans = {}; // { email: { plan, expiresAt } }

// ---- Auth Routes ----
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    res.redirect("/index.html");
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/login.html");
  });
});

// ---- API: User Info ----
app.get("/api/me", (req, res) => {
  if (!req.user) return res.json({ loggedIn: false });
  const planData = activePlans[req.user.email] || { plan: "Free" };
  res.json({
    loggedIn: true,
    email: req.user.email,
    name: req.user.name,
    picture: req.user.picture,
    plan: planData.plan,
  });
});

// ---- API: Plan Proof ----
app.post("/api/send-plan-proof", (req, res) => {
  if (!req.user) return res.status(403).json({ error: "Not logged in" });
  const { plan } = req.body;
  if (!plan) return res.status(400).json({ error: "Plan required" });

  upgradeRequests.push({ email: req.user.email, plan });
  res.json({ success: true });
});

// ---- Admin API ----
app.get("/api/admin/requests", (req, res) => {
  if (!req.user || req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  res.json(upgradeRequests);
});

app.post("/api/admin/approve", (req, res) => {
  if (!req.user || req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const { email, plan } = req.body;
  if (!email || !plan) return res.status(400).json({ error: "Missing fields" });

  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  activePlans[email] = { plan, expiresAt };

  upgradeRequests = upgradeRequests.filter((r) => r.email !== email);
  res.json({ success: true });
});

app.post("/api/admin/decline", (req, res) => {
  if (!req.user || req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const { email } = req.body;
  upgradeRequests = upgradeRequests.filter((r) => r.email !== email);
  res.json({ success: true });
});

// ---- AI Endpoints ----
app.post("/api/playground", async (req, res) => {
  if (!req.user) return res.status(403).json({ error: "Not logged in" });

  const planData = activePlans[req.user.email] || { plan: "Free" };
  if (planData.plan === "Free") {
    return res.status(403).json({ error: "Upgrade required to use Playground" });
  }

  const { message } = req.body;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI error" });
  }
});

app.post("/api/advancedai", async (req, res) => {
  if (!req.user) return res.status(403).json({ error: "Not logged in" });

  const planData = activePlans[req.user.email] || { plan: "Free" };
  if (planData.plan !== "Pro") {
    return res.status(403).json({ error: "Pro plan required" });
  }

  const { message } = req.body;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: message }],
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI error" });
  }
});

// ---- Static Pages ----
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
