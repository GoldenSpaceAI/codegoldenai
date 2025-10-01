// index.js — CodeGoldenAI (fixed OAuth issue + plans + admin + AI)
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import { OpenAI } from "openai";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

// Required for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "render_secret",
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname));

// OpenAI client
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ===== In-memory storage =====
let usersPlans = {};       // { email: { plan: "Free"|"Plus"|"Pro", expires: Date } }
let upgradeRequests = [];  // { email, plan }

// ===== PASSPORT GOOGLE LOGIN =====
const callbackURL = process.env.GOOGLE_CALLBACK_URL || "https://codegoldenai.onrender.com/auth/google/callback";

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ===== Middleware =====
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login.html");
}
function requireAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.emails[0].value === process.env.ADMIN_EMAIL) {
    return next();
  }
  res.status(403).send("Access denied");
}

// ===== AUTH ROUTES =====
app.get("/auth/google", passport.authenticate("google", {
  scope: ["profile", "email"],
  prompt: "select_account"
}));

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    const email = req.user.emails[0].value;
    if (!usersPlans[email]) {
      usersPlans[email] = { plan: "Free", expires: null }; // default free
    }
    res.redirect("/index.html");
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/login.html"));
});

// ===== API: Get logged in user =====
app.get("/api/me", (req, res) => {
  if (!req.isAuthenticated()) return res.json({ loggedIn: false });
  const email = req.user.emails[0].value;
  const planInfo = usersPlans[email] || { plan: "Free", expires: null };

  // auto-expire plans
  if (planInfo.expires && new Date(planInfo.expires) < new Date()) {
    usersPlans[email] = { plan: "Free", expires: null };
  }

  res.json({
    loggedIn: true,
    email,
    name: req.user.displayName,
    picture: req.user.photos?.[0]?.value,
    plan: usersPlans[email].plan,
    expires: usersPlans[email].expires
  });
});

// ===== API: User submits plan upgrade proof =====
app.post("/api/send-plan-proof", ensureAuth, (req, res) => {
  const email = req.user.emails[0].value;
  const { plan } = req.body;
  upgradeRequests.push({ email, plan });
  res.json({ success: true });
});

// ===== ADMIN APIs =====
app.get("/api/admin/requests", requireAdmin, (req, res) => {
  res.json(upgradeRequests);
});

app.post("/api/admin/approve", requireAdmin, (req, res) => {
  const { email, plan } = req.body;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30); // 30 days
  usersPlans[email] = { plan, expires: expiry };
  upgradeRequests = upgradeRequests.filter(r => r.email !== email);
  res.json({ success: true });
});

app.post("/api/admin/decline", requireAdmin, (req, res) => {
  const { email } = req.body;
  upgradeRequests = upgradeRequests.filter(r => r.email !== email);
  res.json({ success: true });
});

// ===== AI APIs =====
// Playground (GPT-4o-mini)
app.post("/api/generate-ai", ensureAuth, async (req, res) => {
  const { prompt } = req.body;
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a coding assistant." },
        { role: "user", content: prompt }
      ]
    });
    res.json({ code: completion.choices[0].message.content });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// AdvancedAI (GPT-4) — Only Plus/Pro users
app.post("/api/advanced-ai", ensureAuth, async (req, res) => {
  const email = req.user.emails[0].value;
  const plan = usersPlans[email]?.plan || "Free";

  if (plan === "Free") {
    return res.status(403).json({ error: "Upgrade required to use AdvancedAI." });
  }

  const { prompt } = req.body;
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are an advanced AI assistant." },
        { role: "user", content: prompt }
      ]
    });
    res.json({ code: completion.choices[0].message.content });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// ===== Start server =====
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
