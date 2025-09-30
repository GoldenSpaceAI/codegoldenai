// index.js — CodeGoldenAI (Render Ready)

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import session from "express-session";
import { OpenAI } from "openai";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000; // Render assigns PORT automatically

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "render_secret",
    resave: false,
    saveUninitialized: true,
  })
);

// --- OpenAI Client ---
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // set in Render → Environment Variables
});

// --- Plan Definitions ---
const plans = {
  free: { websitesAI: 1, perDays: 3, engineer: 0 },
  plus: { websitesAI: 0, engineer: 1, perDays: 30 },
  pro: { websitesAI: "unlimited", engineer: "unlimited" },
};

// --- Temporary In-Memory Store (replace later with DB) ---
let users = {};

// --- Middleware to check user plan ---
function checkPlan(req, res, next) {
  const userId = req.session.id;
  if (!users[userId]) {
    users[userId] = { plan: "free", lastGen: null, aiCount: 0 };
  }
  req.user = users[userId];
  next();
}

// --- Routes ---

// ✅ Get Plans
app.get("/api/plans", (req, res) => {
  res.json(plans);
});

// ✅ Generate Website with AI
app.post("/api/generate-ai", checkPlan, async (req, res) => {
  const { prompt } = req.body;
  const user = req.user;
  const now = Date.now();

  if (user.plan === "free") {
    if (user.lastGen && now - user.lastGen < plans.free.perDays * 24 * 60 * 60 * 1000) {
      return res.status(403).json({
        error: `Free plan: wait ${plans.free.perDays} days before generating again.`,
      });
    }
    user.lastGen = now;
  }

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a coding assistant that generates full website code." },
        { role: "user", content: prompt },
      ],
    });

    const code = completion.choices[0].message.content;
    res.json({ code });
  } catch (err) {
    console.error("AI Error:", err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// ✅ Request Code Engineer Website
app.post("/api/generate-engineer", checkPlan, (req, res) => {
  const user = req.user;

  if (user.plan === "free") {
    return res
      .status(403)
      .json({ error: "Upgrade to Plus or Pro for Code Engineer service." });
  }

  res.json({ message: "Your request has been sent to a Code Engineer team." });
});

// ✅ Root Check
app.get("/", (req, res) => {
  res.send("🚀 CodeGoldenAI API is running on Render!");
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`✅ Server running on Render at port ${PORT}`);
});
