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

// Ultra AI (Gemini 2.5 Pro) with memory of last 20 messages
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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
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

// Image Generation Endpoint (for all models except Gemini)
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided for image generation." });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Generate image using DALL-E
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

// Gemini 2.5 Pro (with image analysis support)
app.post("/api/generate-gemini2.5-pro", async (req, res) => {
  try {
    const { messages, imageData } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided." });
    }

    // Convert messages to Gemini format
    const contents = messages.map(msg => {
      if (msg.type === 'image' && msg.imageUrl) {
        // Handle image messages - Gemini can analyze uploaded images
        return {
          role: msg.role === 'ai' ? 'model' : 'user',
          parts: [
            { text: msg.content || "I uploaded this image for analysis" },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: msg.imageUrl.split(',')[1] // Extract base64 data if provided
              }
            }
          ]
        };
      } else {
        // Regular text messages
        return {
          role: msg.role === 'ai' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        };
      }
    });

    // Use available Gemini model - trying different versions
    let model;
    let modelName = "gemini-1.5-pro"; // Default to most capable available model
    
    try {
      model = genAI.getGenerativeModel({ model: modelName });
    } catch (modelErr) {
      console.log(`Model ${modelName} not available, trying fallback...`);
      try {
        modelName = "gemini-pro";
        model = genAI.getGenerativeModel({ model: modelName });
      } catch (fallbackErr) {
        return res.status(500).json({ 
          error: `No available Gemini models. Tried: gemini-1.5-pro, gemini-pro. Error: ${fallbackErr.message}` 
        });
      }
    }

    const result = await model.generateContent({ contents });
    const reply = result?.response?.text() || `No response from ${modelName}.`;

    res.json({ 
      text: reply,
      modelUsed: modelName
    });

  } catch (err) {
    console.error("Gemini 2.5 Pro error:", err);
    
    // Provide more specific error messages
    if (err.message.includes('not found') || err.message.includes('404')) {
      res.status(500).json({ 
        error: "Gemini model not available. Please check if you have access to Gemini 1.5 Pro or Gemini Pro models." 
      });
    } else if (err.message.includes('API key')) {
      res.status(500).json({ 
        error: "Invalid Gemini API key. Please check your GEMINI_API_KEY environment variable." 
      });
    } else {
      res.status(500).json({ 
        error: "Error generating response: " + err.message 
      });
    }
  }
});

// Gemini Flash (with proper model fallback)
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

    // Try available flash models with fallbacks
    let model;
    let modelName;
    const modelAttempts = [
      "gemini-1.5-flash",
      "gemini-1.0-pro", 
      "gemini-pro"
    ];

    for (const attemptModel of modelAttempts) {
      try {
        model = genAI.getGenerativeModel({ model: attemptModel });
        modelName = attemptModel;
        console.log(`Using model: ${modelName}`);
        break;
      } catch (modelErr) {
        console.log(`Model ${attemptModel} not available: ${modelErr.message}`);
        continue;
      }
    }

    if (!model) {
      return res.status(500).json({ 
        error: "No available Gemini models. Tried: " + modelAttempts.join(", ") 
      });
    }

    const result = await model.generateContent({ contents });
    const reply = result?.response?.text() || `No response from ${modelName}.`;

    res.json({ 
      text: reply,
      modelUsed: modelName
    });

  } catch (err) {
    console.error("Gemini Flash error:", err);
    
    if (err.message.includes('API key')) {
      res.status(500).json({ 
        error: "Invalid Gemini API key. Please check your GEMINI_API_KEY." 
      });
    } else {
      res.status(500).json({ 
        error: "Error generating response: " + err.message 
      });
    }
  }
});

// Available models endpoint to check what's accessible
app.get("/api/available-models", async (req, res) => {
  try {
    const models = await genAI.listModels();
    const availableModels = models.map(model => ({
      name: model.name,
      supportedGenerationMethods: model.supportedGenerationMethods,
      description: model.description
    }));
    
    res.json({ 
      success: true, 
      availableModels: availableModels,
      openAIModels: ["gpt-4", "gpt-4o-mini", "gpt-4.1 (simulated)"]
    });
  } catch (err) {
    console.error("Error listing models:", err);
    res.status(500).json({ 
      error: "Error listing available models: " + err.message 
    });
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

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    // Test OpenAI connection
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    await openai.models.list();
    
    // Test Gemini connection
    await genAI.listModels();
    
    res.json({ 
      status: "healthy", 
      services: {
        openai: "connected",
        gemini: "connected",
        server: "running"
      }
    });
  } catch (err) {
    res.status(500).json({ 
      status: "unhealthy", 
      error: err.message 
    });
  }
});

// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Check available models at http://localhost:${PORT}/api/available-models`);
  console.log(`❤️  Health check at http://localhost:${PORT}/api/health`);
});
