
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require("path");
const { v4: uuidv4 } = require('uuid');

// ----------------- GOOGLE VERTEX AI SETUP -----------------
const { VertexAI } = require('@google-cloud/vertexai');

// Make sure you set these in your .env or replace with actual values
const projectId = process.env.VERTEX_PROJECT_ID || 'vertex-445515';
const location = process.env.VERTEX_LOCATION || 'us-central1';
const vertexAI = new VertexAI({ project: projectId, location: location });

// Initialize the generative model (adjust model name as needed)
const model = vertexAI.preview.getGenerativeModel({
  model: 'gemini-2.0-flash-exp', // or your chosen Vertex model
});

// Example: initial conversation instructions (like “Kumar” scenario)
let conversationHistory = [
    {
      role: "user",
      content: `
  You are "Kumar," a 28-year-old self-employed individual from India,
  earning Rs. 30,000 a month with an excellent CIBIL score of 880 and no
  existing loans. You are currently considering a personal loan from XYZ Bank.
  
  IMPORTANT BEHAVIOR:
  1. You are the potential customer (the borrower), not a service representative.
  2. Do NOT greet as an assistant. Greet or speak as Kumar, the one receiving a loan pitch.
  3. Keep responses within 3 lines, politely but firmly asking about loan details
     (interest rates, repayment terms, hidden fees, etc.).
  4. If asked about unrelated topics, respond: 
     "I’m not comfortable answering that. Let’s focus on the loan."
  5. Show mild hesitation or reluctance in each response (you're not fully convinced yet).
  6. Never mention you are an AI or language model.
  7. If the user says "I’ll call you later," politely end the call and thank them.
  
  Speak naturally as if on a phone call, in a short, casual style, but always from
  Kumar's perspective. Do NOT greet as if you are a helper or assistant.
  `
    }
  ];

// ----------------- AZURE TTS SETUP (Optional) -----------------
const azureRegion = process.env.AZURE_REGION || 'southeastasia';
const azureSubscriptionKey = process.env.AZURE_SUBSCRIPTION_KEY || 'd21a028b925c4d4f84cff3796ecad2ac';
// e.g. for TTS endpoint: https://[region].tts.speech.microsoft.com/cognitiveservices/v1
const TTS_ENDPOINT = `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

// Helper to call Azure TTS
async function synthesizeSpeech(text) {
  const requestBody = `
  <speak version='1.0' xml:lang='en-US'>
    <voice name='en-US-AvaMultilingualNeural'>${text}</voice>
  </speak>`;

  try {
    const response = await axios({
      method: 'post',
      url: TTS_ENDPOINT,
      headers: {
        'Ocp-Apim-Subscription-Key': azureSubscriptionKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      },
      data: requestBody,
      responseType: 'arraybuffer',
    });
    return response.data; // This is the MP3 audio binary
  } catch (error) {
    console.error('Azure TTS Error:', error.response?.data || error);
    throw new Error('Azure TTS request failed');
  }
}

// ----------------- EXPRESS SETUP -----------------
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files (CSS, JS) from /public

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));

  });
// Endpoint to handle user text + fetch AI response
app.post('/api/ask', async (req, res) => {
  try {
    const { userInput } = req.body;
    // 1) Add user input to conversation
    conversationHistory.push({ role: 'user', content: userInput });

    // 2) Build request for Vertex AI
    const request = {
      contents: conversationHistory.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
    };

    // 3) Get AI response from Vertex
    const result = await model.generateContent(request);
    const response = await result.response;

    const aiText = response.candidates[0].content.parts[0].text;

    // 4) Add AI response to conversation
    conversationHistory.push({ role: 'assistant', content: aiText });

    // 5) (Optional) call Azure TTS to turn text -> speech
    let audioBase64 = null;
    try {
      const audioBuffer = await synthesizeSpeech(aiText);
      audioBase64 = Buffer.from(audioBuffer).toString('base64');
    } catch (err) {
      console.error('TTS synthesis failed; continuing with text only.');
    }

    // 6) Send text + (optionally) TTS audio back to the client
    res.json({
      text: aiText,
      audioContent: audioBase64, // base64-encoded MP3
    });
  } catch (error) {
    console.error('Error in /api/ask:', error);
    res.status(500).json({ error: error.message });
  }
});

// Optional: endpoint to reset conversation
app.post('/api/clearHistory', (req, res) => {
  conversationHistory = [
    {
      role: 'user',
      content: `You are Kumar... (Same persona instructions)`,
    },
  ];
  res.json({ message: 'History cleared, starting fresh.' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
