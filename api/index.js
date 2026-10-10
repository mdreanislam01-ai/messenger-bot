export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ replies: [{ message: "Only POST allowed" }] });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      replies: [{ message: "Error: Vercel-এ GEMINI_API_KEY পাওয়া যায়নি!" }]
    });
  }

  try {
    // 1. AutoResponder ডাটা নিরাপদে পড়া
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {}
    }
    body = body || {};

    const userMessage = body.query?.message || body.message || body.text || "";
    const sender = body.query?.sender || "";
    const requestedAccount = req.query?.account || "";

    if (!userMessage || userMessage.trim() === "") {
      return res.status(200).json({ replies: [] });
    }

    // 2. আইডি অনুযায়ী নাম ও ভূমিকা
    let identityName = "Rean Islam";
    let identityRole = "তুমি রিয়ান ইসলাম (ছেলে)। বন্ধুসুলভ ও ক্যাজুয়ালভাবে উত্তর দাও।";

    if (requestedAccount === "tonni") {
      identityName = "Sultana Nur Tonni";
      identityRole = "তুমি সুলতানা নূর তন্নি (মেয়ে)। মিষ্টি, ভদ্র ও স্বাভাবিক ভাষায় উত্তর দাও।";
    }

    const systemPrompt = `You are a real human replying to Facebook Messenger chats on your own behalf.
Identity: You are ${identityName}.
Style: ${identityRole}
Language: Reply in the same language as the incoming message (Bangla or English).
Rules:
- Strictly return ONLY the message reply text.
- NEVER include labels, prefixes like "*Automatic reply*", asterisks, or disclaimers.
- NEVER mention you are an AI or bot. Reply like an authentic friend.`;

    // 3. সরাসরি Google Gemini API কল
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userMessage }]
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      const errDetail = result.error?.message || "Google API ফেইল করেছে";
      return res.status(200).json({
        replies: [{ message: `API Error: ${errDetail}` }]
      });
    }

    let replyText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!replyText) {
      replyText = "বলো, শুনছি।";
    }

    replyText = replyText.replace(/\*?Automatic reply\*?:?/gi, "").trim();

    return res.status(200).json({
      replies: [{ message: replyText }]
    });

  } catch (err) {
    // সমস্যা হলে ফিক্সড লেখার বদলে আসল এরর পাঠাবে
    return res.status(200).json({
      replies: [{ message: `Code Crash: ${err.message}` }]
    });
  }
}

