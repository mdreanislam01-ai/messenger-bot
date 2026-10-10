import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ replies: [{ message: "Only POST allowed" }] });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ replies: [{ message: "API Key missing" }] });
  }

  try {
    const data = req.body || {};
    
    // AutoResponder ডাটা পাঠায় query.message বা রুট message ফিল্ডে
    const userMessage = data.query?.message || data.message || data.text || "";
    const sender = data.query?.sender || data.sender || "";
    const fullPayload = JSON.stringify(data);

    if (!userMessage || userMessage.trim() === "") {
      return res.status(200).json({ replies: [] });
    }

    // আপনার দেওয়া অরিজিনাল প্রম্পটটি সিস্টেমে নিখুঁতভাবে বসানো হয়েছে
    const systemPrompt = `You are my personal AI assistant for Messenger. Reply naturally and helpfully on my behalf. Use the same language as the sender, especially Bangla or English. Read the conversation history before replying and answer the latest message directly. Be friendly, polite, concise, and conversational like an authentic human friend. Never invent personal details, prices, promises, or facts. If you do not know something, ask politely. Do not mention that you are an AI. Avoid repeating previous replies.
CRITICAL FORMAT RULE: Output ONLY the plain conversational message. Never output prefixes like "*Automatic reply*", asterisks, labels, or bot disclaimers.

IDENTITIES & ACCOUNTS:
1. Account 1: Sultana Nur Tonni (Speak naturally as Tonni).
2. Account 2: Rean Islam (Speak naturally as Rean).
Context metadata: ${fullPayload}
If the context indicates Sultana Nur Tonni, represent Tonni. If Rean Islam, represent Rean. Otherwise, speak naturally in first person.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // gemini-2.5-flash সবচেয়ে দ্রুত ও আধুনিক
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent(`Sender: ${sender}\nMessage: ${userMessage}`);
    const response = await result.response;
    let replyText = response.text();

    if (replyText) {
      // যদি কোনো কারণে Automatic reply বা তারকাচিহ্ন চলে আসে, তা স্বয়ংক্রিয়ভাবে মুছে ফেলবে
      replyText = replyText.replace(/\*?Automatic reply\*?:?/gi, "").trim();
    }

    return res.status(200).json({
      replies: [
        {
          message: replyText || "বলো, শুনছি।"
        }
      ]
    });
  } catch (err) {
    console.error("Gemini Error:", err);
    // এরর হলে ফিক্সড ডায়ালগের বদলে সংক্ষেপে উত্তর দিবে
    return res.status(200).json({
      replies: [
        {
          message: "একটু ব্যস্ত আছি, একটু পর ফ্রি হয়ে কথা বলছি।"
        }
      ]
    });
  }
}
