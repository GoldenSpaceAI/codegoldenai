// index.js — CodeGoldenAI (single file, no extra folders)

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

// ✅ Serve index.html directly
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeGoldenAI • Build Smarter Websites</title>
  <style>
    body { margin:0; font-family:Arial, sans-serif; background:#0a0f1c; color:#eaf1ff; text-align:center; }
    header { padding:1rem; font-size:1.6rem; font-weight:bold;
      background: linear-gradient(45deg, #f6c64a, #eb8b36);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero { padding:3rem 1rem; }
    .hero h2 { font-size:2.2rem; background:linear-gradient(45deg,#f6c64a,#eb8b36);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .btn { display:inline-block; margin:1rem; padding:1rem 1.5rem;
      border-radius:12px; background:#141b2d; border:2px solid #f6c64a; color:#eaf1ff;
      font-weight:bold; text-decoration:none; }
    .btn:hover { background:rgba(246,198,74,.1); }
  </style>
</head>
<body>
  <header>CodeGoldenAI</header>
  <div class="hero">
    <h2>Build Smarter Websites with AI + Code Engineers</h2>
    <p>Generate websites using AI or work with a Code Engineer.</p>
    <div>
      <a class="btn" href="/playground">AI Playground</a>
      <a class="btn" href="/plans">Plans</a>
      <a class="btn" href="/engineer">Hire Engineer</a>
    </div>
  </div>
</body>
</html>`);
});

// ✅ Playground page
app.get("/playground", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Playground • CodeGoldenAI</title>
  <style>
    body { margin:0; font-family:Arial, sans-serif; background:#0a0f1c; color:#eaf1ff; display:flex; flex-direction:column; height:100vh; }
    header { padding:1rem; text-align:center; font-weight:bold; background:#141b2d; }
    main { flex:1; overflow-y:auto; padding:1rem; }
    .code-box { background:#1c2539; border:1px solid #f6c64a55; border-radius:8px; padding:1rem; margin:1rem 0; font-family:monospace; white-space:pre-wrap; position:relative; }
    .copy-btn { position:absolute; top:10px; right:10px; background:#222; border:1px solid #f6c64a; color:#fff; font-size:.8rem; padding:.3rem .6rem; border-radius:5px; cursor:pointer; }
    .input-area { display:flex; padding:1rem; background:#141b2d; gap:.5rem; }
    input { flex:1; padding:.7rem; border-radius:8px; border:none; background:#0f1525; color:#eaf1ff; }
    button { padding:.7rem 1.2rem; background:linear-gradient(45deg,#f6c64a,#eb8b36); border:none; border-radius:8px; cursor:pointer; font-weight:bold; }
  </style>
</head>
<body>
  <header>⚡ AI Playground</header>
  <main id="output"></main>
  <div class="input-area">
    <input id="prompt" type="text" placeholder="Describe the code you need..." />
    <button onclick="generateCode()">Generate</button>
  </div>
  <script>
    async function generateCode() {
      const prompt = document.getElementById("prompt").value.trim();
      if (!prompt) return;
      const output = document.getElementById("output");
      const box = document.createElement("div");
      box.className = "code-box";
      box.textContent = "⏳ Generating...";
      output.appendChild(box);
      try {
        const res = await fetch("/api/generate-ai", {
          method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ prompt })
        });
        const data = await res.json();
        if (data.error) { box.textContent = "❌ " + data.error; }
        else {
          box.innerHTML = "<button class='copy-btn' onclick='copyCode(this)'>Copy</button><pre><code>"+escapeHtml(data.code)+"</code></pre>";
        }
      } catch { box.textContent = "❌ Failed to connect."; }
    }
    function escapeHtml(t) { return t.replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m])); }
    function copyCode(btn){const code=btn.parentElement.innerText.replace("Copy","").trim();navigator.clipboard.writeText(code);btn.textContent="Copied!";setTimeout(()=>btn.textContent="Copy",2000);}
  </script>
</body>
</html>`);
});

// ✅ API endpoint
app.post("/api/generate-ai", async (req, res) => {
  let body = "";
  req.on("data", chunk => { body += chunk.toString(); });
  req.on("end", async () => {
    try {
      const { prompt } = JSON.parse(body);
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a coding assistant that generates full website code." },
          { role: "user", content: prompt }
        ]
      });
      res.json({ code: completion.choices[0].message.content });
    } catch (err) {
      console.error("AI error:", err);
      res.status(500).json({ error: "AI generation failed" });
    }
  });
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
