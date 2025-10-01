// index.js — CodeGoldenAI (serves all pages correctly)

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import session from "express-session";
import { OpenAI } from "openai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

// Required for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "render_secret",
    resave: false,
    saveUninitialized: true,
  })
);

// OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Serve homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ✅ Serve other pages
app.get("/plans.html", (req, res) => {
  res.sendFile(path.join(__dirname, "plans.html"));
});

app.get("/playground.html", (req, res) => {
  res.sendFile(path.join(__dirname, "playground.html"));
});

app.get("/engineer.html", (req, res) => {
  res.sendFile(path.join(__dirname, "engineer.html"));
});

// ✅ API endpoint (AI generation)
app.post("/api/generate-ai", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided" });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional coding assistant that generates website code in a clean and reliable way." },
        { role: "user", content: prompt }
      ]
    });

    res.json({ code: completion.choices[0].message.content });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// Start server
app.listen(PORT, () => console.log(`✅ CodeGoldenAI running at http://localhost:${PORT}`));
