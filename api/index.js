// মেমোরি স্টোরেজ (কথোপকথনের হিস্ট্রি মনে রাখার জন্য)
const chatMemory = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ replies: [{ message: "Only POST allowed" }] });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ replies: [{ message: "একটু ব্যস্ত আছি, একটু পর ফ্রি হয়ে কথা বলছি।" }] });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    const userMessage = body.query?.message || body.message || body.text || "";
    const sender = (body.query?.sender || "friend").toLowerCase();
    const requestedAccount = (req.query?.account || "").toLowerCase();

    if (!userMessage || userMessage.trim() === "") {
      return res.status(200).json({ replies: [] });
    }

    // ১. অ্যাকাউন্ট পরিচয় ও বাচনভঙ্গি
    let identityName = "Rean Islam";
    let identityTone = "ছেলে, বন্ধুত্বপূর্ণ, ক্যাজুয়াল, আন্তরিক ও মানুষের মতো বাস্তবসম্মত মেজাজে কথা বলবে।";

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
- NEVER include prefixes like "*Automatic reply*", asterisks (*), labels, or disclaimers.
- NEVER mention or admit that you are an AI or bot. Reply authentically like a friend. Keep it short.`;

    // ২. মেমোরি লোড
    const sessionKey = `${requestedAccount}_${sender}`;
    let history = chatMemory.get(sessionKey) || [];
    history.push({ role: "user", parts: [{ text: userMessage }] });

    if (history.length > 8) history = history.slice(-8);

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

    // ৩. মডেলের ধারাবাহিক তালিকা (3.5 -> 3.8 -> 3.1 Pro)
    const targetModels = [
      "gemini-3.5-flash-lite", // ১. প্রধান মডেল (দ্রুততম ও ফ্রি কোটা বেশি)
      "gemini-3.8-flash",      // ২. দ্বিতীয় ব্যাকআপ
      "gemini-3.1-pro"         // ৩. চূড়ান্ত প্রো ব্যাকআপ
    ];

    let replyText = "";

    for (const modelName of targetModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const payload = {
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: sanitizedContents,
          generationConfig: {
            maxOutputTokens: 220,
            temperature: 0.7
          }
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        // সফল উত্তর পেলে সাথে সাথে লুপ বন্ধ হবে
        if (response.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
          replyText = result.candidates[0].content.parts[0].text;
          break; 
        }
      } catch (err) {
        // কোনো মডেলে বাধা পেলে নিঃশব্দে পরবর্তী মডেলে শিফট করবে
      }
    }

    // ৪. চরম পরিস্থিতিতে কোনো মডেল না পেলে স্বাভাবিক টেক্সট দেবে (কোনো এরর চ্যাটে দেখাবে না)
    if (!replyText || replyText.trim() === "") {
      replyText = "একটু অপেক্ষা করো, বলছি।";
    }

    // প্রিফিক্স ফিল্টার
    replyText = replyText.replace(/\*?Automatic reply\*?:?/gi, "").trim();

    // এআই-এর উত্তর মেমোরিতে সংরক্ষণ
    history.push({ role: "model", parts: [{ text: replyText }] });
    chatMemory.set(sessionKey, history);

    return res.status(200).json({
      replies: [{ message: replyText }]
    });

  } catch (err) {
    return res.status(200).json({
      replies: [{ message: "একটু অপেক্ষা করো, এখনই বলছি।" }]
    });
  }
}
