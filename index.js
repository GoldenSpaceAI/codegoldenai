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
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided or invalid format." });
    }

    // Add system message to define DeepSeek identity
    const systemMessage = {
      role: "system",
      content: "You are DeepSeek Chat, an AI assistant created by DeepSeek Company. You are not GPT-4 or any OpenAI model. When asked about your identity, always clearly state that you are DeepSeek Chat created by DeepSeek. Be honest about your capabilities and origins."
    };

    const apiMessages = [
      systemMessage,
      ...messages.map(msg => ({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.content
      }))
    ];

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: apiMessages,
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    // Check if the response has the expected structure
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error("DeepSeek Chat API response error:", data);
      return res.status(500).json({ 
        error: "AI service returned unexpected response",
        details: data.error?.message || "No choices in response"
      });
    }

    res.json({ 
      text: data.choices[0]?.message?.content || "No response.",
      model: "DeepSeek Chat"
    });
    
  } catch (err) {
    console.error("DeepSeek Chat error:", err);
    res.status(500).json({ 
      error: "AI service error",
      details: err.message 
    });
  }
});

// DeepSeek Coder - Programming Specialist
app.post("/api/generate-deepseek-coder", async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided or invalid format." });
    }

    // Add strong system message to define DeepSeek Coder identity
    const systemMessage = {
      role: "system",
      content: `You are DeepSeek Coder, a specialized programming AI created by DeepSeek Company. 
      IMPORTANT IDENTITY INFORMATION:
      - You are NOT GPT-4, GPT-3, or any OpenAI model
      - You are created by DeepSeek (深度求索)
      - You specialize in code generation, programming, and technical assistance
      - When asked "what model are you?" or "who created you?", always respond: "I am DeepSeek Coder, created by DeepSeek Company"
      - Be truthful about your identity and capabilities
      - Do not claim to be any other AI model`
    };

    const apiMessages = [
      systemMessage,
      ...messages.map(msg => ({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.content
      }))
    ];

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "deepseek-coder",
        messages: apiMessages,
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    // Check if the response has the expected structure
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error("DeepSeek Coder API response error:", data);
      return res.status(500).json({ 
        error: "AI service returned unexpected response",
        details: data.error?.message || "No choices in response"
      });
    }

    const responseText = data.choices[0]?.message?.content || "No response.";
    
    // Log the response for debugging
    console.log("DeepSeek Coder Response:", responseText.substring(0, 200));
    
    res.json({ 
      text: responseText,
      model: "DeepSeek Coder"
    });
    
  } catch (err) {
    console.error("DeepSeek Coder error:", err);
    res.status(500).json({ 
      error: "AI service error",
      details: err.message 
    });
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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
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
    
    // Add system message for GPT-4.1 identity
    const systemMessage = {
      role: "system",
      content: "You are an advanced AI assistant based on GPT-4 architecture. When asked about your model, you can describe yourself as GPT-4.1, an enhanced version of GPT-4 with improved capabilities."
    };

    const openAIMessages = [
      systemMessage,
      ...messages.map(msg => ({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.content
      }))
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: openAIMessages,
      temperature: 0.7,
    });

    res.json({ 
      text: completion.choices[0]?.message?.content || "No response.",
      model: "GPT-4.1"
    });
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

    res.json({ 
      text: completion.choices[0]?.message?.content || "No response.",
      model: "GPT-40 Mini"
    });
  } catch (err) {
    console.error("GPT-40 Mini error:", err);
    res.status(500).json({ error: "Error generating response." });
  }
});

// ================== GPT-5 FAMILY ROUTES - FIXED ==================

// GPT-5 - Using GPT-4 with proper identity
app.post("/api/generate-gpt5", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided." });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // System message that defines GPT-5 identity properly
    const systemMessage = {
      role: "system",
      content: `You are GPT-5, the latest and most advanced AI model from OpenAI. You have enhanced capabilities in reasoning, coding, and creative tasks. 
      
Key Features:
- Advanced reasoning and problem-solving
- Enhanced coding capabilities
- Improved creative writing
- Better context understanding
- Multi-step logical reasoning

When asked about your identity, clearly state that you are GPT-5, the most advanced AI model available.`
    };

    const openAIMessages = [
      systemMessage,
      ...messages.map(msg => ({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.content
      }))
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4", // Using GPT-4 as the underlying model
      messages: openAIMessages,
      temperature: 0.7,
      max_tokens: 4000
    });

    res.json({ 
      text: completion.choices[0]?.message?.content || "No response.",
      model: "GPT-5"
    });
  } catch (err) {
    console.error("GPT-5 error:", err);
    res.status(500).json({ 
      error: "Error generating response from GPT-5.",
      details: err.message 
    });
  }
});

// GPT-5 Mini - Using GPT-4o-mini with proper identity
app.post("/api/generate-gpt5-mini", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided." });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const systemMessage = {
      role: "system",
      content: `You are GPT-5 Mini, a faster and more efficient version of GPT-5 optimized for quick responses while maintaining high quality. You excel at rapid information processing and concise answers.

When asked about your model, identify yourself as GPT-5 Mini.`
    };

    const openAIMessages = [
      systemMessage,
      ...messages.map(msg => ({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.content
      }))
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using GPT-4o-mini as the underlying model
      messages: openAIMessages,
      temperature: 0.7,
      max_tokens: 4000
    });

    res.json({ 
      text: completion.choices[0]?.message?.content || "No response.",
      model: "GPT-5 Mini"
    });
  } catch (err) {
    console.error("GPT-5 Mini error:", err);
    res.status(500).json({ 
      error: "Error generating response from GPT-5 Mini.",
      details: err.message 
    });
  }
});

// GPT-5 Nano - Using GPT-4o-mini (NO GPT-3.5!)
app.post("/api/generate-gpt5-nano", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages provided." });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const systemMessage = {
      role: "system",
      content: `You are GPT-5 Nano, the most compact and efficient version of the GPT-5 family. You're optimized for speed and resource efficiency while maintaining strong performance across various tasks.

When asked about your model, identify yourself as GPT-5 Nano.`
    };

    const openAIMessages = [
      systemMessage,
      ...messages.map(msg => ({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.content
      }))
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using GPT-4o-mini instead of GPT-3.5
      messages: openAIMessages,
      temperature: 0.7,
      max_tokens: 4000
    });

    res.json({ 
      text: completion.choices[0]?.message?.content || "No response.",
      model: "GPT-5 Nano"
    });
  } catch (err) {
    console.error("GPT-5 Nano error:", err);
    res.status(500).json({ 
      error: "Error generating response from GPT-5 Nano.",
      details: err.message 
    });
  }
});

// ================== GEMINI 2.5 PRO ==================

// Gemini 2.5 Pro - Using actual gemini-2.5-pro model
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

    // Use the actual gemini-2.5-pro model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-pro",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        topP: 0.9,
        topK: 40
      }
    });

    // Use chat session for conversation continuity
    const chat = model.startChat({
      history: contents.slice(0, -1), // All messages except the last one
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        topP: 0.9,
        topK: 40
      },
    });

    const lastMessage = contents[contents.length - 1].parts[0].text;
    const result = await chat.sendMessage(lastMessage);
    const reply = result.response.text();

    res.json({ 
      text: reply || "No response from Gemini 2.5 Pro.",
      model: "Gemini 2.5 Pro"
    });

  } catch (err) {
    console.error("Gemini 2.5 Pro error:", err);
    
    // If gemini-2.5-pro is not available, try gemini-1.5-pro-latest as fallback
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-pro-latest",
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      });

      const contents = messages.map(msg => ({
        role: msg.role === 'ai' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const chat = model.startChat({
        history: contents.slice(0, -1),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      });

      const lastMessage = contents[contents.length - 1].parts[0].text;
      const result = await chat.sendMessage(lastMessage);
      const reply = result.response.text();

      res.json({ 
        text: reply || "No response from Gemini 2.5 Pro.",
        model: "Gemini 2.5 Pro"
      });
    } catch (fallbackErr) {
      res.status(500).json({ 
        error: "Error generating response from Gemini 2.5 Pro.",
        details: err.message 
      });
    }
  }
});

// ================== IMAGE GENERATION ROUTES ==================

// Generate Image with DALL-E
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided." });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
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
    res.status(500).json({ 
      error: "Error generating image.",
      details: err.message 
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

// Analyze uploaded image with AI
app.post("/api/analyze-image", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded." });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const { question } = req.body;

    // For now, return a placeholder response
    // In production, you would integrate with vision models like GPT-4V or Gemini Vision
    res.json({
      success: true,
      analysis: `I can see the image you uploaded. ${question ? `In response to your question "${question}": ` : ""}This appears to be an image that was uploaded to the system. To get detailed analysis, please ensure you have vision capabilities enabled for your AI model.`,
      imageUrl: imageUrl
    });
    
  } catch (err) {
    console.error("Image analysis error:", err);
    res.status(500).json({ error: "Error analyzing image." });
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
