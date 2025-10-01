// index.js — CodeGoldenAI with Google OAuth fixed (Render HTTPS)

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import session from "express-session";
import { OpenAI } from "openai";
import path from "path";
import { fileURLToPath } from "url";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Tell Express to trust Render's proxy (so x-forwarded-proto works)
app.set("trust proxy", 1);

// ✅ Force HTTPS middleware
app.use((req, res, next) => {
  if (req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "render_secret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Passport serialize/deserialize
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ✅ Google OAuth strategy (explicit full https callback)
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://codegoldenai.onrender.com/auth/google/callback"
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }
));

// ✅ Google login routes
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/login.html");
  });
});

// ✅ API endpoint to expose logged-in user info
app.get("/api/me", (req, res) => {
  if (!req.user) {
    return res.json({ loggedIn: false });
  }
  res.json({
    loggedIn: true,
    email: req.user.emails[0].value,
    name: req.user.displayName
  });
});

// ✅ Routes
// First page is always login.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// After login → dashboard
app.get("/dashboard", (req, res) => {
  if (!req.user) return res.redirect("/login.html");
  res.send(`
    <h1>Welcome ${req.user.displayName} 👋</h1>
    <p>Email: ${req.user.emails[0].value}</p>
    <a href="/plans.html">View Plans</a> |
    <a href="/playground.html">Playground</a> |
    <a href="/engineer.html">Hire Engineer</a> |
    <a href="/logout">Logout</a>
  `);
});

// Other static pages (protected)
app.get("/plans.html", (req, res) => {
  if (!req.user) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "plans.html"));
});

app.get("/playground.html", (req, res) => {
  if (!req.user) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "playground.html"));
});

app.get("/engineer.html", (req, res) => {
  if (!req.user) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "engineer.html"));
});

// ✅ OpenAI API endpoint
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
app.post("/api/generate-ai", async (req, res) => {
  try {
    const { prompt } = req.body;
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional coding assistant." },
        { role: "user", content: prompt }
      ]
    });
    res.json({ code: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// ✅ Serve static files (login.html, plans.html, QR image, CSS, etc.)
app.use(express.static(__dirname));

// Start server
app.listen(PORT, () => console.log(`✅ CodeGoldenAI running at https://codegoldenai.onrender.com`));
