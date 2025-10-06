// index.js — Full backend for CodeGoldenAI
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";  // Gemini SDK
import multer from "multer";
import fs from "fs";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
  })
);

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

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

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Google login routes
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login.html",
    successRedirect: "/index.html",
  })
);

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// Default route → login.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});


// ================== AI ROUTES ==================

// Playground (GPT-4o-mini)
app.post("/api/generate-playground", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided." });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    res.json({ text: completion.choices[0]?.message?.content || "No response." });
  } catch (err) {
    console.error("Playground error:", err);
    res.status(500).json({ error: "Error generating response." });
  }
});

// AdvancedAI (GPT-4)
app.post("/api/generate-advanced", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided." });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    res.json({ text: completion.choices[0]?.message?.content || "No response." });
  } catch (err) {
    console.error("AdvancedAI error:", err);
    res.status(500).json({ error: "Error generating response." });
  }
});
// DeepSeek Chat - General Purpose
app.post("/api/generate-deepseek-chat", async (req, res) => {
  try {
    const { messages } = req.body;
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: messages.map(msg => ({
          role: msg.role === 'ai' ? 'assistant' : 'user',
          content: msg.content
        })),
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    const data = await response.json();
    res.json({ 
      text: data.choices[0]?.message?.content || "No response.",
      model: "DeepSeek Chat"
    });
    
  } catch (err) {
    console.error("DeepSeek Chat error:", err);
    res.status(500).json({ error: "AI service error" });
  }
});

// DeepSeek Coder - Programming Specialist
app.post("/api/generate-deepseek-coder", async (req, res) => {
  try {
    const { messages } = req.body;
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "deepseek-coder",
        messages: messages.map(msg => ({
          role: msg.role === 'ai' ? 'assistant' : 'user',
          content: msg.content
        })),
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    const data = await response.json();
    res.json({ 
      text: data.choices[0]?.message?.content || "No response.",
      model: "DeepSeek Coder"
    });
    
  } catch (err) {
    console.error("DeepSeek Coder error:", err);
    res.status(500).json({ error: "AI service error" });
  }
});// Ultra AI (Gemini 2.5 Pro) with memory of last 20 messages
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/api/generate-ultra", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided (expected array)." });
    }

    // Keep only last 20 messages
    const recent = messages.slice(-20);

    const contents = recent.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent({ contents });

    const reply = result?.response?.text() || "⚠️ No reply from Ultra AI.";
    res.json({ text: reply });

  } catch (err) {
    console.error("Ultra AI error:", err?.message || err);
    res.status(500).json({ error: "Ultra AI failed: " + (err?.message || "unknown error") });
  }
});

// ================== NEW ADVANCED AI CHAT ROUTES ==================

// GPT-4.1 Simulation (using GPT-4)
app.post("/api/generate-gpt4.1", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided." });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Convert messages to OpenAI format
    const openAIMessages = messages.map(msg => ({
      role: msg.role === 'ai' ? 'assistant' : 'user',
      content: msg.content
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: openAIMessages,
      temperature: 0.7,
    });

    res.json({ text: completion.choices[0]?.message?.content || "No response." });
  } catch (err) {
    console.error("GPT-4.1 error:", err);
    res.status(500).json({ error: "Error generating response." });
  }
});

// GPT-40 Mini (using GPT-4o-mini)
app.post("/api/generate-gpt40-mini", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided." });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const openAIMessages = messages.map(msg => ({
      role: msg.role === 'ai' ? 'assistant' : 'user',
      content: msg.content
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openAIMessages,
      temperature: 0.7,
    });

    res.json({ text: completion.choices[0]?.message?.content || "No response." });
  } catch (err) {
    console.error("GPT-40 Mini error:", err);
    res.status(500).json({ error: "Error generating response." });
  }
});

// Gemini 2.5 Pro
app.post("/api/generate-gemini2.5-pro", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided." });
    }

    // Convert messages to Gemini format
    const contents = messages.map(msg => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent({ contents });

    const reply = result?.response?.text() || "No response from Gemini 2.5 Pro.";
    res.json({ text: reply });

  } catch (err) {
    console.error("Gemini 2.5 Pro error:", err);
    res.status(500).json({ error: "Error generating response." });
  }
});

// Gemini Flash
app.post("/api/generate-gemini-flash", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided." });
    }

    const contents = messages.map(msg => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent({ contents });

    const reply = result?.response?.text() || "No response from Gemini Flash.";
    res.json({ text: reply });

  } catch (err) {
    console.error("Gemini Flash error:", err);
    res.status(500).json({ error: "Error generating response." });
  }
});

// Image upload endpoint
app.post("/api/upload-image", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded." });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    
    res.json({ 
      success: true, 
      imageUrl: imageUrl,
      message: "Image uploaded successfully"
    });
  } catch (err) {
    console.error("Image upload error:", err);
    res.status(500).json({ error: "Error uploading image." });
  }
});

// Chat storage endpoints (simple in-memory storage for demo)
// In production, you'd want to use a database
let chatStorage = {};

app.post("/api/save-chat", async (req, res) => {
  try {
    const { chatId, chatData } = req.body;
    
    if (!chatId || !chatData) {
      return res.status(400).json({ error: "Chat ID and data are required." });
    }

    chatStorage[chatId] = {
      ...chatData,
      lastUpdated: new Date().toISOString()
    };

    res.json({ success: true, message: "Chat saved successfully" });
  } catch (err) {
    console.error("Save chat error:", err);
    res.status(500).json({ error: "Error saving chat." });
  }
});

app.get("/api/load-chat/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
    
    if (!chatStorage[chatId]) {
      return res.status(404).json({ error: "Chat not found." });
    }

    res.json({ success: true, chatData: chatStorage[chatId] });
  } catch (err) {
    console.error("Load chat error:", err);
    res.status(500).json({ error: "Error loading chat." });
  }
});

app.get("/api/user-chats", async (req, res) => {
  try {
    // For demo purposes, return all chats
    // In production, you'd filter by user ID
    const userChats = Object.entries(chatStorage).map(([id, data]) => ({
      id,
      title: data.title,
      lastUpdated: data.lastUpdated,
      messageCount: data.messages ? data.messages.length : 0
    }));

    res.json({ success: true, chats: userChats });
  } catch (err) {
    console.error("Get user chats error:", err);
    res.status(500).json({ error: "Error loading user chats." });
  }
});

// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
