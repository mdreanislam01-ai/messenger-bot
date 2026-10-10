import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({
      replies: [{ message: "Method not allowed" }]
    });
  }

  try {
    const data = req.body || {};
    const userMessage = data.query?.message || data.message || "";

    if (!userMessage) {
      return res.status(200).json({ replies: [] });
    }

    const systemPrompt = `You are a personal assistant on Facebook Messenger. 
Reply naturally and concisely in the same language (Bangla or English). 
Do NOT include any prefixes like "Automatic reply", asterisks, labels, or bot disclaimers. 
Reply directly like a human friend.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    const replyText = response.text || "আমি একটু ব্যস্ত আছি, পরে কথা বলছি।";

    return res.status(200).json({
      replies: [
        {
          message: replyText.trim()
        }
      ]
    });
  } catch (err) {
    return res.status(200).json({
      replies: [
        {
          message: "আমি এখন মেসেজের উত্তর দিতে পারছি না।"
        }
      ]
    });
  }
}

