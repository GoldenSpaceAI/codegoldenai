// index.js — CodeGoldenAI (Full Version)
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

// Static files (HTML, images, QR, etc.)
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "public")));

// OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------------- GOOGLE LOGIN ---------------- //
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "https://codegoldenai.onrender.com/auth/google/callback",
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
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    res.redirect("/index.html"); // ✅ after login go home
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/login.html");
  });
});

// ---------------- USER INFO ---------------- //
app.get("/api/me", (req, res) => {
  if (!req.user) {
    return res.json({ loggedIn: false });
  }
  res.json({
    loggedIn: true,
    email: req.user.emails?.[0]?.value,
    name: req.user.displayName,
    picture: req.user.photos?.[0]?.value,
    plan: "Free", // placeholder until you add upgrades
  });
});

// ---------------- OPENAI ROUTES ---------------- //

// Playground → GPT-4o-mini
app.post("/api/generate-playground", async (req, res) => {
  try {
    const { prompt } = req.body;
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful coding assistant." },
        { role: "user", content: prompt },
      ],
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error("Playground AI error:", err);
    res.status(500).json({ error: "Playground AI failed" });
  }
});

// AdvancedAI → GPT-4
app.post("/api/generate-advanced", async (req, res) => {
  try {
    const { prompt } = req.body;
    const completion = await client.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are an advanced assistant for developers. If the user requests code, return clean code blocks.",
        },
        { role: "user", content: prompt },
      ],
    });

    const text = completion.choices[0].message.content;

    // Extract code block if present
    const codeMatch = text.match(/```[\s\S]*?```/);
    const code = codeMatch
      ? codeMatch[0].replace(/```[\w]*/g, "").trim()
      : null;

    res.json({
      text: text.replace(/```[\s\S]*?```/, "").trim(),
      code,
    });
  } catch (err) {
    console.error("AdvancedAI error:", err);
    res.status(500).json({ error: "AdvancedAI failed" });
  }
});

// ---------------- FALLBACK ---------------- //
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start server
app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
