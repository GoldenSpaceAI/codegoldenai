// index.js — Full backend for CodeGoldenAI
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// GPT-4.1 (using GPT-4 Turbo)
app.post("/api/generate-gpt4.1", async (req, res) => {
  try {
    const { messages, prompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided." });
    }

    // Convert messages to OpenAI format
    const openAIMessages = messages.map(msg => ({
      role: msg.role === 'ai' ? 'assistant' : 'user',
      content: msg.content
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: openAIMessages,
      temperature: 0.7,
      max_tokens: 2000
    });

    res.json({ 
      text: completion.choices[0]?.message?.content || "No response.",
      model: "GPT-4 Turbo"
    });
  } catch (err) {
    console.error("GPT-4.1 error:", err);
    res.status(500).json({ error: "Error generating response: " + err.message });
  }
});

// GPT-40 Mini (using GPT-4o-mini)
app.post("/api/generate-gpt40-mini", async (req, res) => {
  try {
    const { messages, prompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided." });
    }

    const openAIMessages = messages.map(msg => ({
      role: msg.role === 'ai' ? 'assistant' : 'user',
      content: msg.content
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openAIMessages,
      temperature: 0.7,
      max_tokens: 2000
    });

    res.json({ 
      text: completion.choices[0]?.message?.content || "No response.",
      model: "GPT-4o Mini"
    });
  } catch (err) {
    console.error("GPT-40 Mini error:", err);
    res.status(500).json({ error: "Error generating response: " + err.message });
  }
});

// Gemini 2.5 Pro (using most capable available Gemini model)
app.post("/api/generate-gemini2.5-pro", async (req, res) => {
  try {
    const { messages, prompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided." });
    }

    // Convert messages to Gemini format
    const contents = messages.map(msg => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    let model;
    let modelName = "gemini-1.5-pro";

    try {
      // Try gemini-1.5-pro first (most capable)
      model = genAI.getGenerativeModel({ model: modelName });
    } catch (err) {
      // Fallback to gemini-pro
      modelName = "gemini-pro";
      model = genAI.getGenerativeModel({ model: modelName });
    }

    const result = await model.generateContent({ contents });
    const reply = result?.response?.text() || "No response from AI.";

    res.json({ 
      text: reply,
      model: modelName
    });

  } catch (err) {
    console.error("Gemini 2.5 Pro error:", err);
    
    // Provide helpful error messages
    if (err.message.includes('API_KEY')) {
      res.status(500).json({ error: "Invalid Gemini API key. Please check your GEMINI_API_KEY." });
    } else if (err.message.includes('quota')) {
      res.status(500).json({ error: "Gemini API quota exceeded. Please check your Google AI Studio quota." });
    } else {
      res.status(500).json({ error: "Gemini error: " + err.message });
    }
  }
});

// Gemini Flash (using fastest available Gemini model)
app.post("/api/generate-gemini-flash", async (req, res) => {
  try {
    const { messages, prompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided." });
    }

    const contents = messages.map(msg => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    let model;
    let modelName = "gemini-1.5-flash";

    try {
      // Try gemini-1.5-flash first
      model = genAI.getGenerativeModel({ model: modelName });
    } catch (err) {
      // Fallback to gemini-pro
      modelName = "gemini-pro";
      model = genAI.getGenerativeModel({ model: modelName });
    }

    const result = await model.generateContent({ contents });
    const reply = result?.response?.text() || "No response from AI.";

    res.json({ 
      text: reply,
      model: modelName
    });

  } catch (err) {
    console.error("Gemini Flash error:", err);
    
    if (err.message.includes('API_KEY')) {
      res.status(500).json({ error: "Invalid Gemini API key." });
    } else {
      res.status(500).json({ error: "Gemini Flash error: " + err.message });
    }
  }
});

// Image Generation Endpoint
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided for image generation." });
    }

    // Generate image using DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imageUrl = response.data[0].url;
    
    res.json({ 
      success: true, 
      imageUrl: imageUrl,
      message: "Image generated successfully"
    });

  } catch (err) {
    console.error("Image generation error:", err);
    res.status(500).json({ error: "Error generating image: " + err.message });
  }
});

// Image Upload Endpoint
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
    res.status(500).json({ error: "Error uploading image: " + err.message });
  }
});

// Available Models Endpoint
app.get("/api/available-models", async (req, res) => {
  try {
    let geminiModels = [];
    try {
      const models = await genAI.listModels();
      geminiModels = models.map(model => model.name);
    } catch (err) {
      console.log("Could not fetch Gemini models:", err.message);
    }

    res.json({ 
      success: true,
      openai: {
        "gpt-4.1": "GPT-4 Turbo",
        "gpt-40-mini": "GPT-4o Mini"
      },
      gemini: {
        "gemini2.5-pro": "Gemini 1.5 Pro",
        "gemini-flash": "Gemini 1.5 Flash"
      },
      availableGeminiModels: geminiModels
    });
  } catch (err) {
    console.error("Available models error:", err);
    res.status(500).json({ error: "Error checking available models." });
  }
});

// Health Check Endpoint
app.get("/api/health", async (req, res) => {
  try {
    // Test OpenAI
    await openai.models.list();
    
    // Test Gemini
    await genAI.listModels();
    
    res.json({ 
      status: "healthy",
      services: {
        openai: "connected",
        gemini: "connected",
        server: "running"
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ 
      status: "unhealthy",
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Chat Storage (Simple in-memory for demo)
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Available models: http://localhost:${PORT}/api/available-models`);
  console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Make sure these environment variables are set:`);
  console.log(`   - OPENAI_API_KEY`);
  console.log(`   - GEMINI_API_KEY`);
  console.log(`   - GOOGLE_CLIENT_ID`);
  console.log(`   - GOOGLE_CLIENT_SECRET`);
});
