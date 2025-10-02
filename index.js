// index.js — CodeGoldenAI backend (fixed access control)

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

app.use(passport.initialize());
app.use(passport.session());

// ---- Passport Setup ----
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

// ---- OpenAI ----
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Memory ----
let upgradeRequests = []; // { email, plan }
let activePlans = {}; // { email: { plan, expiresAt } }

// ---- Middleware: Auth Guard ----
function ensureLogin(req, res, next) {
  if (!req.user) return res.redirect("/login.html");
  next();
}
function ensurePlan(requiredPlan) {
  return (req, res, next) => {
    if (!req.user) return res.redirect("/login.html");

    const planData = activePlans[req.user.email] || { plan: "Free" };
    const plan = planData.plan;

    const order = { Free: 0, Plus: 1, Pro: 2 };
    if (order[plan] < order[requiredPlan]) {
      return res.redirect("/plans.html");
    }
    next();
  };
}

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

// ---- API: Me ----
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
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
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
app.post("/api/playground", ensureLogin, ensurePlan("Plus"), async (req, res) => {
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

app.post("/api/advancedai", ensureLogin, ensurePlan("Pro"), async (req, res) => {
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

// ---- Static Pages with Restrictions ----
app.use("/index.html", ensureLogin, express.static(__dirname));
app.use("/plans.html", ensureLogin, express.static(__dirname));
app.use("/playground.html", ensureLogin, ensurePlan("Plus"), express.static(__dirname));
app.use("/advancedai.html", ensureLogin, ensurePlan("Pro"), express.static(__dirname));
app.use("/engineer.html", ensureLogin, ensurePlan("Pro"), express.static(__dirname));
app.use("/admin.html", ensureLogin, express.static(__dirname));

// ---- Default route goes to login ----
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

// ---- Static (for login and assets) ----
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`🚀 Running on http://localhost:${PORT}`);
});
