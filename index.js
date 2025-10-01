// index.js — CodeGoldenAI

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import path from "path";
import { fileURLToPath } from "url";
import { OpenAI } from "openai";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

// __dirname setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Static files (serve everything from root + public folder)
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "public")));

// OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Passport Google Auth
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "https://codegoldenai.onrender.com/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Google Auth routes
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    res.redirect("/index.html"); // ✅ Redirect to home after login
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/login.html");
  });
});

// API: Current user info
app.get("/api/me", (req, res) => {
  if (!req.user) {
    return res.json({ loggedIn: false });
  }
  res.json({
    loggedIn: true,
    email: req.user.emails?.[0]?.value,
    name: req.user.displayName,
    picture: req.user.photos?.[0]?.value,
    plan: "Free", // default until you build approval system
  });
});

// ✅ API: OpenAI Playground
app.post("/api/generate-ai", async (req, res) => {
  try {
    const { prompt } = req.body;
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional coding assistant that generates full, working code." },
        { role: "user", content: prompt },
      ],
    });
    res.json({ code: completion.choices[0].message.content });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// ✅ Fallback: Send index.html if path not found
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
