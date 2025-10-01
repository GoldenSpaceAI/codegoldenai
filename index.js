// index.js — CodeGoldenAI with Google OAuth → Home Profile Page

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

// ✅ Trust Render's proxy
app.set("trust proxy", 1);

// ✅ Force HTTPS
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
passport.serializeUser((user, done) => {
  // Add default plan = Free
  user.plan = "Free";
  done(null, user);
});
passport.deserializeUser((obj, done) => done(null, obj));

// ✅ Google OAuth strategy
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
    res.redirect("/home"); // Redirect to new home page
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/login.html");
  });
});

// ✅ API endpoint for frontend
app.get("/api/me", (req, res) => {
  if (!req.user) return res.json({ loggedIn: false });
  res.json({
    loggedIn: true,
    email: req.user.emails[0].value,
    name: req.user.displayName,
    picture: req.user.photos && req.user.photos.length > 0 ? req.user.photos[0].value : null,
    plan: req.user.plan || "Free"
  });
});

// ✅ Routes
// First page is login
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// Home page after login
app.get("/home", (req, res) => {
  if (!req.user) return res.redirect("/login.html");
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Home • CodeGoldenAI</title>
      <style>
        body { font-family: Arial, sans-serif; background:#f7fafc; text-align:center; padding:2rem; }
        .card {
          background:white; max-width:400px; margin:2rem auto; padding:2rem;
          border-radius:12px; box-shadow:0 12px 30px rgba(0,0,0,0.15);
        }
        img { border-radius:50%; width:100px; margin-bottom:1rem; }
        h1 { margin:0.5rem 0; }
        p { color:#444; margin:0.3rem 0; }
        .btn { display:inline-block; margin:0.5rem; padding:0.7rem 1.2rem; border-radius:8px;
          background:linear-gradient(45deg,#f6c64a,#eb8b36); color:white; font-weight:bold; text-decoration:none; }
      </style>
    </head>
    <body>
      <div class="card">
        <img src="${req.user.photos && req.user.photos.length > 0 ? req.user.photos[0].value : "https://via.placeholder.com/100"}" alt="Profile Picture"/>
        <h1>${req.user.displayName}</h1>
        <p>Email: ${req.user.emails[0].value}</p>
        <p><strong>Plan:</strong> ${req.user.plan || "Free"}</p>
        <a class="btn" href="/plans.html">Upgrade Plan</a>
        <a class="btn" href="/playground.html">Playground</a>
        <a class="btn" href="/logout">Logout</a>
      </div>
    </body>
    </html>
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

// ✅ OpenAI endpoint
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

// ✅ Static serving
app.use(express.static(__dirname));

app.listen(PORT, () => console.log(`✅ CodeGoldenAI running at https://codegoldenai.onrender.com`));
