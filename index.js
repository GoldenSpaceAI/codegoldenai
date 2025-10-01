// index.js — CodeGoldenAI full backend
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
const PORT = process.env.PORT || 3000;

// Static files (HTML, images like QR.jpg)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

// Middleware
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// OpenAI client
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Memory "database"
let users = {}; // { email: { name, picture, plan, expiry } }
let upgradeRequests = []; // { email, plan, date, status, expiry }

// Google OAuth
const callbackURL =
  process.env.GOOGLE_CALLBACK_URL ||
  "http://localhost:3000/auth/google/callback";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL,
    },
    (accessToken, refreshToken, profile, done) => {
      const email = profile.emails[0].value;
      const user = {
        email,
        name: profile.displayName,
        picture: profile.photos?.[0]?.value,
      };
      // Default Free plan
      if (!users[email]) {
        users[email] = { ...user, plan: "Free", expiry: null };
      }
      return done(null, user);
    }
  )
);

passport.serializeUser((user, done) => done(null, user.email));
passport.deserializeUser((email, done) => done(null, users[email]));

// Helpers
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login.html");
}
function requireAdmin(req, res, next) {
  if (
    req.isAuthenticated() &&
    req.user.email === process.env.ADMIN_EMAIL
  ) {
    return next();
  }
  res.status(403).send("Access denied");
}

// --- Auth Routes ---
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

// --- User API ---
app.get("/api/me", (req, res) => {
  if (!req.user) return res.json({ loggedIn: false });

  const email = req.user.email;
  const user = users[email];

  // Auto-expire plans
  if (user.expiry && new Date(user.expiry) < new Date()) {
    users[email].plan = "Free";
    users[email].expiry = null;
  }

  res.json({ loggedIn: true, ...users[email] });
});

// --- Plan Upgrade ---
app.post("/api/request-upgrade", ensureAuth, (req, res) => {
  const email = req.user.email;
  const { plan } = req.body;

  upgradeRequests.push({
    email,
    plan,
    date: Date.now(),
    status: "pending",
    expiry: null,
  });

  res.json({ success: true, message: "Upgrade request submitted" });
});

// --- Admin APIs ---
app.get("/api/admin/requests", requireAdmin, (req, res) => {
  res.json(upgradeRequests);
});

app.post("/api/admin/approve", requireAdmin, (req, res) => {
  const { email, plan } = req.body;
  const request = upgradeRequests.find(
    (r) => r.email === email && r.status === "pending"
  );

  if (!request) return res.status(404).json({ error: "Request not found" });

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30); // +30 days

  request.status = "active";
  request.expiry = expiry;

  users[email].plan = plan;
  users[email].expiry = expiry;

  res.json({ success: true });
});

app.post("/api/admin/decline", requireAdmin, (req, res) => {
  const { email } = req.body;
  upgradeRequests = upgradeRequests.filter(
    (r) => !(r.email === email && r.status === "pending")
  );
  res.json({ success: true });
});

// --- AI APIs ---
// Playground (GPT-4o-mini)
app.post("/api/generate-ai", ensureAuth, async (req, res) => {
  const { prompt } = req.body;
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a coding assistant." },
        { role: "user", content: prompt },
      ],
    });
    res.json({ code: completion.choices[0].message.content });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// AdvancedAI (GPT-4) — Only Plus/Pro
app.post("/api/advanced-ai", ensureAuth, async (req, res) => {
  const email = req.user.email;
  const plan = users[email]?.plan || "Free";

  if (plan === "Free") {
    return res.status(403).json({ error: "Upgrade required to use AdvancedAI." });
  }

  const { prompt } = req.body;
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are an advanced AI assistant." },
        { role: "user", content: prompt },
      ],
    });
    res.json({ code: completion.choices[0].message.content });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// --- Start Server ---
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
