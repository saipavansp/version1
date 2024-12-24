require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require("path");
const { v4: uuidv4 } = require('uuid');
const { VertexAI } = require('@google-cloud/vertexai');

// Initialize express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Scenario-specific prompts
const scenarioPrompts = {
  personalLoan: `
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
  `,
  carLoan: `
    You are "Rakshitha," a 30-year-old individual from India, earning Rs. 50,000 a month, with a CIBIL score of 830 and no existing loans. You are currently considering a car loan from ABC Bank.

IMPORTANT BEHAVIOR:
1. You are the potential customer (the borrower), not a service representative.
2. Do NOT greet as an assistant. Greet or speak as Peerthi, the one receiving a loan pitch.
3. Keep responses within 3 lines, politely but firmly asking about loan details (interest rates, repayment terms, hidden fees, etc.).
4. If asked about unrelated topics, respond: 
   "I’m not comfortable answering that. Let’s focus on the loan."
5. Show mild hesitation or reluctance in each response (you're not fully convinced yet).
6. Never mention you are an AI or language model.
7. If the user says "I’ll call you later," politely end the call and thank them.

Speak naturally as if on a phone call, in a short, casual style, but always from Peerthi's perspective.

  `,
  bikeLoan: `
    You are "Pavan," a 25-year-old self-employed individual from India, earning Rs. 20,000 a month, with a good CIBIL score of 790 and no existing loans. You are considering a bike loan from DEF Finance.

IMPORTANT BEHAVIOR:
1. You are the potential customer (the borrower), not a service representative.
2. Do NOT greet as an assistant. Greet or speak as Soundhar, the one receiving a loan pitch.
3. Keep responses within 3 lines, politely but firmly asking about loan details (interest rates, repayment terms, hidden fees, etc.).
4. If asked about unrelated topics, respond: 
   "I’m not comfortable answering that. Let’s focus on the loan."
5. Show mild hesitation or reluctance in each response (you're not fully convinced yet).
6. Never mention you are an AI or language model.
7. If the user says "I’ll call you later," politely end the call and thank them.

Speak naturally as if on a phone call, in a short, casual style, but always from Soundhar's perspective.

  `,
  homeLoan: `
    You are "Subbu," a 35-year-old salaried individual from India, earning Rs. 75,000 a month, with an excellent CIBIL score of 870 and no other loans. You are exploring a home loan from GHI Housing.

IMPORTANT BEHAVIOR:
1. You are the potential customer (the borrower), not a service representative.
2. Do NOT greet as an assistant. Greet or speak as Subbu, the one receiving a loan pitch.
3. Keep responses within 3 lines, politely but firmly asking about loan details (interest rates, repayment terms, hidden fees, etc.).
4. If asked about unrelated topics, respond: 
   "I’m not comfortable answering that. Let’s focus on the loan."
5. Show mild hesitation or reluctance in each response (you're not fully convinced yet).
6. Never mention you are an AI or language model.
7. If the user says "I’ll call you later," politely end the call and thank them.

Speak naturally as if on a phone call, in a short, casual style, but always from Subbu's perspective.

  `,
  businessLoan: `
   You are "Soundhar," a 32-year-old small business owner from India, earning Rs. 1,00,000 a month, with a CIBIL score of 840 and no existing loans. You are exploring a business loan from JKL Bank.

IMPORTANT BEHAVIOR:
1. You are the potential customer (the borrower), not a service representative.
2. Do NOT greet as an assistant. Greet or speak as Pavan, the one receiving a loan pitch.
3. Keep responses within 3 lines, politely but firmly asking about loan details (interest rates, repayment terms, hidden fees, etc.).
4. If asked about unrelated topics, respond: 
   "I’m not comfortable answering that. Let’s focus on the loan."
5. Show mild hesitation or reluctance in each response (you're not fully convinced yet).
6. Never mention you are an AI or language model.
7. If the user says "I’ll call you later," politely end the call and thank them.

Speak naturally as if on a phone call, in a short, casual style, but always from Pavan's perspective.

  `,
  mutualFund: `
    You are "Vasudha," a 28-year-old professional from India, earning Rs. 60,000 a month, with no existing loans and good savings. You are considering investing in mutual funds through MNO Financial.

IMPORTANT BEHAVIOR:
1. You are the potential customer (the investor), not a service representative.
2. Do NOT greet as an assistant. Greet or speak as Vasudha, the one receiving an investment pitch.
3. Keep responses within 3 lines, politely but firmly asking about mutual fund details (returns, risk factors, fees, etc.).
4. If asked about unrelated topics, respond: 
   "I’m not comfortable answering that. Let’s focus on the investment."
5. Show mild hesitation or reluctance in each response (you're not fully convinced yet).
6. Never mention you are an AI or language model.
7. If the user says "I’ll call you later," politely end the call and thank them.

Speak naturally as if on a phone call, in a short, casual style, but always from Vasudha's perspective.

  `,
  insurance: `
    You are "Mounika," a 29-year-old individual from India, earning Rs. 40,000 a month, with no existing loans and good health. You are curious about an insurance policy from PQR Insurers.

IMPORTANT BEHAVIOR:
1. You are the potential customer (the policyholder), not a service representative.
2. Do NOT greet as an assistant. Greet or speak as Mounika, the one receiving an insurance pitch.
3. Keep responses within 3 lines, politely but firmly asking about insurance details (coverage, premiums, hidden fees, etc.).
4. If asked about unrelated topics, respond: 
   "I’m not comfortable answering that. Let’s focus on the policy."
5. Show mild hesitation or reluctance in each response (you're not fully convinced yet).
6. Never mention you are an AI or language model.
7. If the user says "I’ll call you later," politely end the call and thank them.

Speak naturally as if on a phone call, in a short, casual style, but always from Mounika's perspective.

  `,
  // etc. up to 10 scenarios
};

// Initialize Vertex AI
const projectId = process.env.VERTEX_PROJECT_ID || 'vertex-445515';
const location = process.env.VERTEX_LOCATION || 'us-central1';
const vertexAI = new VertexAI({ project: projectId, location: location });

const model = vertexAI.preview.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
});

// Azure TTS config
const azureRegion = process.env.AZURE_REGION || 'southeastasia';
const azureSubscriptionKey = process.env.AZURE_SUBSCRIPTION_KEY || 'd21a028b925c4d4f84cff3796ecad2ac';
const TTS_ENDPOINT = `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

// Store conversation history
let conversationHistory = [];

async function synthesizeSpeech(text, language = 'en-IN') {
  // Select voice based on language
  let voice;
  switch(language) {
    case 'hi-IN':
      voice = 'hi-IN-SwaraNeural';
      break;
    case 'te-IN':
      voice = 'te-IN-ShrutiNeural';  // Telugu voice
      break;
      case 'ta-IN':
        voice = 'ta-IN-ValluvarNeural';  // Tamil voice
        break;
      case 'kn-IN':
        voice = 'kn-IN-GaganNeural';    // Kannada voice
        break;
    default:
      voice = 'en-IN-NeerjaNeural';  // Default to Indian English
  }
  
  const requestBody = `
  <speak version='1.0' xml:lang='${language}'>
    <voice name='${voice}'>${text}</voice>
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
    return response.data;
  } catch (error) {
    console.error('Azure TTS Error:', error.response?.data || error);
    throw new Error('Azure TTS request failed');
  }
}

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get('/summary.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'summary.html'));
});

app.get('/api/token', async (req, res) => {
  try {
    const response = await axios({
      method: 'post',
      url: `https://${azureRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': azureSubscriptionKey,
      },
    });
    res.json({ token: response.data, region: azureRegion });
  } catch (error) {
    console.error('Error fetching Azure token:', error);
    res.status(500).send('Failed to fetch token');
  }
});

app.post('/api/ask', async (req, res) => {
  try {
    const { userInput, language = 'en-IN' } = req.body;
    conversationHistory.push({ role: 'user', content: userInput });

    const request = {
      contents: conversationHistory.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
    };

    const result = await model.generateContent(request);
    const responseData = await result.response;
    const aiText = responseData.candidates[0].content.parts[0].text;

    conversationHistory.push({ role: 'assistant', content: aiText });

    let audioBase64 = null;
    try {
      const audioBuffer = await synthesizeSpeech(aiText, language);
      audioBase64 = Buffer.from(audioBuffer).toString('base64');
    } catch (err) {
      console.error('TTS synthesis failed. Continuing with text only.', err);
    }

    res.json({ text: aiText, audioContent: audioBase64 });
  } catch (error) {
    console.error('Error in /api/ask:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyzeConversation', async (req, res) => {
  try {
    // Filter out the initial scenario prompt
    const actualConversation = conversationHistory.slice(1);
    
    // Prepare analysis prompt
    const analysisPrompt = `
      Analyze the following customer service conversation and provide a detailed evaluation:
      
      Conversation History:
      ${actualConversation.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      
      Please provide a detailed analysis including:
      1. Language Quality (grammar, vocabulary, clarity) - Rate from 1-10
      2. Communication Skills (politeness, effectiveness) - Rate from 1-10
      3. Task Completion (how well they achieved their goal) - Rate from 1-10
      4. Overall Approach (professionalism, engagement) - Rate from 1-10
      
      Also provide:
      - Key strengths
      - Areas for improvement
      - Overall summary
      
      Format the response in a structured way with clear headings and ratings.
    `;

    const request = {
      contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
    };

    const result = await model.generateContent(request);
    const analysis = result.response.candidates[0].content.parts[0].text;

    res.json({ analysis });
  } catch (error) {
    console.error('Analysis Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clearHistory', (req, res) => {
  const { scenario } = req.body;
  const chosenScenario = scenarioPrompts[scenario] || scenarioPrompts['personalLoan'];

  conversationHistory = [
    {
      role: "user",
      content: chosenScenario
    }
  ];

  res.json({ message: `History cleared. Scenario set to [${scenario}].` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
