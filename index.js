// index.js — CodeGoldenAI
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public")); // serve html/css/js/images

app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Passport setup
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://codegoldenai.onrender.com/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Memory storage
let upgradeRequests = []; // { email, plan }
let userPlans = {}; // { email: { plan, expiry } }

// Auth routes
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

// API: Current user
app.get("/api/me", (req, res) => {
  if (!req.user) return res.json({ loggedIn: false });

  const email = req.user.emails[0].value;
  const now = Date.now();

  let planData = userPlans[email];
  if (!planData || (planData.expiry && now > planData.expiry)) {
    userPlans[email] = { plan: "Free", expiry: null };
    planData = userPlans[email];
  }

  res.json({
    loggedIn: true,
    email,
    name: req.user.displayName,
    picture: req.user.photos[0].value,
    plan: planData.plan,
    expiry: planData.expiry,
  });
});

// API: Submit upgrade request
app.post("/api/submit-upgrade", (req, res) => {
  if (!req.user) return res.status(401).send("Not logged in");
  const { plan } = req.body;
  const email = req.user.emails[0].value;

  upgradeRequests.push({ email, plan });
  res.json({ success: true, message: "Upgrade request submitted. Waiting for admin approval." });
});

// Admin API: View requests
app.get("/api/admin/requests", (req, res) => {
  res.json(upgradeRequests);
});

// Admin API: Approve plan
app.post("/api/admin/approve", (req, res) => {
  const { email, plan } = req.body;
  const duration = 30 * 24 * 60 * 60 * 1000; // 30 days

  userPlans[email] = { plan, expiry: Date.now() + duration };

  upgradeRequests = upgradeRequests.filter((r) => r.email !== email);
  res.json({ success: true, message: `${plan} approved for ${email}` });
});

// Admin API: Decline plan
app.post("/api/admin/decline", (req, res) => {
  const { email } = req.body;
  upgradeRequests = upgradeRequests.filter((r) => r.email !== email);
  res.json({ success: true, message: `Request declined for ${email}` });
});

// Middleware: Protect pages by plan
function requirePlan(minPlan) {
  return (req, res, next) => {
    if (!req.user) return res.redirect("/login.html");

    const email = req.user.emails[0].value;
    const planData = userPlans[email] || { plan: "Free" };

    const allowed = {
      Free: 1,
      Plus: 2,
      Pro: 3,
    };

    if (allowed[planData.plan] >= allowed[minPlan]) {
      return next();
    } else {
      return res.redirect("/plans.html");
    }
  };
}

// Protect routes
app.use("/advancedai.html", requirePlan("Plus"));
app.use("/engineer.html", requirePlan("Pro"));

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
