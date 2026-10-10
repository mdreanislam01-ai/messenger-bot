// মেমোরি স্টোরেজ (প্রতিটি প্রেরকের আগের মেসেজ মনে রাখার জন্য)
const chatMemory = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ replies: [{ message: "Only POST allowed" }] });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ replies: [{ message: "একটু পর কথা বলছি।" }] });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {}
    }
    body = body || {};

    const userMessage = body.query?.message || body.message || body.text || "";
    const sender = body.query?.sender || "friend";
    const requestedAccount = req.query?.account || "";

    if (!userMessage || userMessage.trim() === "") {
      return res.status(200).json({ replies: [] });
    }

    // ১. একাউন্ট অনুযায়ী সঠিক পরিচয়
    let identityName = "Rean Islam";
    let identityTone = "ছেলে, বন্ধুসুলভ, ক্যাজুয়াল, আন্তরিক ও ছোট ছোট বাক্যে কথা বলবে।";

    if (requestedAccount === "tonni") {
      identityName = "Sultana Nur Tonni";
      identityTone = "মেয়ে, মিষ্টি, ভদ্র, আন্তরিক ও স্বাভাবিক ঘরোয়া ভাষায় কথা বলবে।";
    }

    const systemPrompt = `You are a real human replying to personal Facebook Messenger messages on your own behalf.
Your Identity: You are ${identityName} (${identityTone}).
Instructions:
- Reply naturally and conversationally in the same language as incoming message (Bangla or English).
- Always remember and follow the context of the conversation history.
- Strictly return ONLY the message reply text.
- NEVER include prefixes like "*Automatic reply*", "Bot:", asterisks (*), labels, or bot disclaimers.
- NEVER mention or admit that you are an AI or bot. Reply authentically like a friend. Keep it short.`;

    // ২. মেমোরি থেকে পূর্ববর্তী কথোপকথন লোড করা
    const sessionKey = `${requestedAccount}_${sender}`;
    let history = chatMemory.get(sessionKey) || [];

    // নতুন মেসেজ মেমোরিতে যোগ করা
    history.push({ role: "user", parts: [{ text: userMessage }] });

    // মেমোরি অতিরিক্ত বড় হয়ে গেলে শেষ ৮টি মেসেজ (৪ রাউন্ড) রাখা হবে
    if (history.length > 8) {
      history = history.slice(-8);
    }

    // অল্টারনেটিং রুলস ঠিক রাখা (Google API এরর প্রতিরোধ)
    const sanitizedContents = [];
    for (const turn of history) {
      if (sanitizedContents.length > 0 && sanitizedContents[sanitizedContents.length - 1].role === turn.role) {
        sanitizedContents[sanitizedContents.length - 1].parts[0].text += "\n" + turn.parts[0].text;
      } else {
        sanitizedContents.push({ role: turn.role, parts: [{ text: turn.parts[0].text }] });
      }
    }
    while (sanitizedContents.length > 0 && sanitizedContents[0].role !== "user") {
      sanitizedContents.shift();
    }

    // ৩. মডেল নির্বাচন: প্রথমে অতি দ্রুতগতির 3.5 Flash-Lite, ফেইল করলে ব্যাকআপ 3.8 Flash
    const models = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];
    let replyText = "";

    for (const modelName of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const payload = {
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: sanitizedContents,
          generationConfig: {
            maxOutputTokens: 200,
            temperature: 0.7
          }
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
          replyText = result.candidates[0].content.parts[0].text;
          break; // সফল হলে সাথে সাথে লুপ বন্ধ
        }
      } catch (err) {
        // পরবর্তী ব্যাকআপ মডেলে চেষ্টা করবে
      }
    }

    // যদি দুটি মডেলই সাময়িক ব্যস্ত থাকে, টেকনিক্যাল এরর না দেখিয়ে স্বাভাবিক কথা বলবে
    if (!replyText) {
      replyText = "একটু নেট সমস্যা করছিল। কি যেন বলছিলে?";
    }

    // প্রিফিক্স ও অতিরিক্ত চিহ্ন পরিষ্কার করা
    replyText = replyText.replace(/\*?Automatic reply\*?:?/gi, "").trim();

    // এআই-এর উত্তর মেমোরিতে সেভ রাখা
    history.push({ role: "model", parts: [{ text: replyText }] });
    chatMemory.set(sessionKey, history);

    return res.status(200).json({
      replies: [{ message: replyText }]
    });

  } catch (err) {
    return res.status(200).json({
      replies: [{ message: "একটু পর কথা বলছি, একটু কাজ করছি।" }]
    });
  }
}
