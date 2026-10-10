import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: "You are a personal assistant on Facebook Messenger. Reply naturally, politely, and concisely in the same language (Bangla or English). Do NOT add prefixes like 'Automatic reply', labels, asterisks, or disclaimers. Reply directly like a real human."
    });

    const result = await model.generateContent(userMessage);
    const replyText = result.response.text();

    return res.status(200).json({
      replies: [
        {
          message: replyText ? replyText.trim() : "আমি একটু পর কথা বলছি।"
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
