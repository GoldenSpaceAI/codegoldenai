// index.js — CodeGoldenAI Backend
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Utils
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
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

// Passport Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL || "http://localhost:3000/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      const user = {
        id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        picture: profile.photos[0].value,
      };
      return done(null, user);
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// In-memory storage
let users = {}; // { email: { plan, expiry } }
let upgradeRequests = []; // pending upgrade requests

// Serve static pages
app.use(express.static(path.join(__dirname)));

// Redirect root to login.html
app.get("/", (req, res) => {
  if (!req.user) {
    return res.sendFile(path.join(__dirname, "login.html"));
  }
  res.redirect("/index.html");
});

// Google OAuth routes
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    const email = req.user.email;

    // If user doesn't exist, assign Free plan
    if (!users[email]) {
      users[email] = { plan: "free", expiry: null };
    }
    res.redirect("/index.html");
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/login.html");
  });
});

// API: Current user
app.get("/api/me", (req, res) => {
  if (!req.user) return res.json({ loggedIn: false });
  const { email, name, picture } = req.user;
  const { plan, expiry } = users[email] || { plan: "free", expiry: null };
  res.json({ loggedIn: true, email, name, picture, plan, expiry });
});

// API: Request plan upgrade
app.post("/api/upgrade", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const { plan } = req.body;
  if (!["plus", "pro"].includes(plan)) return res.status(400).json({ error: "Invalid plan" });

  upgradeRequests.push({
    email: req.user.email,
    requestedPlan: plan,
    requestedOn: new Date(),
    status: "pending",
  });

  res.json({ success: true });
});

// Admin panel auth (password-based)
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === process.env.URL_PASS) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.status(403).json({ error: "Invalid password" });
});

// Admin panel: Get pending requests
app.get("/api/admin/requests", (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: "Forbidden" });
  res.json(upgradeRequests);
});

// Admin panel: Approve request
app.post("/api/admin/approve", (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: "Forbidden" });
  const { email } = req.body;
  const request = upgradeRequests.find(r => r.email === email && r.status === "pending");
  if (!request) return res.status(404).json({ error: "Request not found" });

  const duration = 30 * 24 * 60 * 60 * 1000; // 30 days
  users[email] = {
    plan: request.requestedPlan,
    expiry: Date.now() + duration,
  };

  request.status = "approved";
  res.json({ success: true });
});

// Admin panel: Decline request
app.post("/api/admin/decline", (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: "Forbidden" });
  const { email } = req.body;
  const request = upgradeRequests.find(r => r.email === email && r.status === "pending");
  if (!request) return res.status(404).json({ error: "Request not found" });

  request.status = "declined";
  res.json({ success: true });
});

// Middleware: check access
function requirePlan(requiredPlan) {
  return (req, res, next) => {
    if (!req.user) return res.redirect("/login.html");
    const { email } = req.user;
    const user = users[email] || { plan: "free", expiry: null };

    // Expire if needed
    if (user.expiry && Date.now() > user.expiry) {
      user.plan = "free";
      user.expiry = null;
    }

    // Check plan
    if (requiredPlan === "plus") {
      if (user.plan === "free") return res.send("⚠️ Upgrade to Plus or Pro to unlock this page.");
    }
    if (requiredPlan === "pro") {
      if (user.plan !== "pro") return res.send("⚠️ Upgrade to Pro to access this page.");
    }
    next();
  };
}

// Protect advancedai.html → Plus or Pro only
app.get("/advancedai.html", requirePlan("plus"), (req, res) => {
  res.sendFile(path.join(__dirname, "advancedai.html"));
});

// Protect engineer.html → Pro only
app.get("/engineer.html", requirePlan("pro"), (req, res) => {
  res.sendFile(path.join(__dirname, "engineer.html"));
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
