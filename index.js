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

// Passport Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.CALLBACK_URL ||
        "https://codegoldenai.onrender.com/auth/google/callback",
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
let users = {}; // email → {plan, expiry}
let upgradeRequests = []; // {email, plan, date, status}

// --- Routes ---

// Redirect root → login page
app.get("/", (req, res) => {
  if (!req.user) {
    return res.sendFile(path.join(__dirname, "login.html"));
  }
  res.redirect("/index.html");
});

// Google login
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    const email = req.user.email;
    if (!users[email]) {
      users[email] = { plan: "free", expiry: null };
    }
    res.redirect("/index.html");
  }
);

// Logout
app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/login.html");
  });
});

// Current user API
app.get("/api/me", (req, res) => {
  if (!req.user) return res.json({ loggedIn: false });
  const { email, name, picture } = req.user;
  const { plan, expiry } = users[email] || { plan: "free", expiry: null };
  res.json({ loggedIn: true, email, name, picture, plan, expiry });
});

// User requests upgrade (from plans.html)
app.post("/api/request-upgrade", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const { plan } = req.body;
  if (!["plus", "pro"].includes(plan)) {
    return res.status(400).json({ error: "Invalid plan" });
  }

  upgradeRequests.push({
    email: req.user.email,
    plan,
    date: new Date(),
    status: "pending",
  });

  res.json({ success: true });
});

// --- Admin endpoints ---

// Unlock admin with password
app.post("/api/admin/unlock", (req, res) => {
  const { password } = req.body;
  if (password === process.env.URL_PASS) {
    req.session.isAdmin = true;
    return res.sendStatus(200);
  }
  res.status(403).json({ error: "Wrong password" });
});

// List all upgrade requests
app.get("/api/admin/requests", (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: "Forbidden" });
  res.json(upgradeRequests);
});

// Approve request
app.post("/api/admin/approve", (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: "Forbidden" });

  const { email, plan } = req.body;
  const request = upgradeRequests.find(
    (r) => r.email === email && r.status === "pending"
  );
  if (!request) return res.status(404).json({ error: "Request not found" });

  users[email] = { plan, expiry: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  request.status = "approved";

  res.json({ success: true });
});

// Decline request
app.post("/api/admin/decline", (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: "Forbidden" });

  const { email } = req.body;
  const request = upgradeRequests.find(
    (r) => r.email === email && r.status === "pending"
  );
  if (!request) return res.status(404).json({ error: "Request not found" });

  request.status = "declined";
  res.json({ success: true });
});

// Serve static files (HTML, CSS, JS, images)
app.use(express.static(__dirname));

// Start server
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
