import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // শুধুমাত্র POST রিকোয়েস্ট গ্রহণ করবে
  if (req.method !== 'POST') {
    return res.status(200).json({
      replies: [{ message: "Only POST method is allowed." }]
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      replies: [{ message: "Error: GEMINI_API_KEY পাওয়া যায়নি।" }]
    });
  }

  try {
    const data = req.body || {};

    // AutoResponder থেকে আসা ডাটা
    const userMessage = data.query?.message || data.message || "";
    const senderName = data.query?.sender || "";
    // প্যাকেজ নাম বা অ্যাকাউন্ট নাম (যদি AutoResponder পাঠায়)
    const packageName = data.query?.package_name || data.package_name || "";
    const accountContext = JSON.stringify(data);

    if (!userMessage || userMessage.trim() === "") {
      return res.status(200).json({ replies: [] });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // সিস্টেম প্রম্পট: দুই আইডির নাম, স্বাভাবিক কথোপকথন ও নো-প্রিফিক্স রুল
    const systemInstruction = `You are a real human replying to personal messages on Facebook Messenger. You represent the account owner directly.

IDENTITIES & ACCOUNT DETECTION:
1. Account 1: "Sultana Nur Tonni" (Female tone, warm, polite, natural conversational style).
2. Account 2: "Rean Islam" (Male tone, casual, direct, friendly).

- Check the incoming message and full metadata context: ${accountContext}.
- If the incoming interaction belongs to Sultana Nur Tonni's profile, reply as Tonni.
- If the incoming interaction belongs to Rean Islam's profile, reply as Rean.
- If the account context is ambiguous, reply naturally in a neutral first-person without unnecessarily declaring your name unless the sender asks "Who is this?" or "আপনার নাম কি?".

CRITICAL BEHAVIOR RULES:
- Reply STRICTLY with the plain text of your response.
- NEVER include headers or prefixes like "Automatic reply", "Bot:", "Assistant:", asterisks, markdown labels, or notes.
- NEVER say you are an AI, bot, virtual assistant, or auto-responder.
- Speak in authentic Bengali (Bangla) if the sender writes in Bangla or Banglish. If the sender writes in English, reply in English.
- Be concise, friendly, casual, and polite—just like how people text on Messenger.
- Never invent prices, sensitive commitments, or false facts. If something is unknown, respond casually and naturally.`;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemInstruction,
    });

    const promptText = `Sender Name: ${senderName}\nIncoming Message: ${userMessage}`;
    const result = await model.generateContent(promptText);
    const replyText = result.response.text();

    return res.status(200).json({
      replies: [
        {
          message: replyText ? replyText.trim() : "বলো, শুনছি।"
        }
      ]
    });
  } catch (err) {
    console.error("Gemini Error:", err);
    return res.status(200).json({
      replies: [
        {
          message: "একটু ব্যস্ত আছি, একটু পর ফ্রি হয়ে কথা বলছি।"
        }
      ]
    });
  }
}
