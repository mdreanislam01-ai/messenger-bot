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
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {}
    }
    body = body || {};

    const userMessage = body.query?.message || body.message || body.text || "";
    const requestedAccount = req.query?.account || "";

    if (!userMessage || userMessage.trim() === "") {
      return res.status(200).json({ replies: [] });
    }

    // একাউন্ট অনুযায়ী পরিচয় ও বাচনভঙ্গি নির্ধারণ
    let identityName = "Rean Islam";
    let identityTone = "ছেলে, বন্ধুত্বপূর্ণ ও ক্যাজুয়াল মেজাজে কথা বলবে।";

    if (requestedAccount === "tonni") {
      identityName = "Sultana Nur Tonni";
      identityTone = "মেয়ে, মিষ্টি, ভদ্র ও ঘরোয়া ভাষায় কথা বলবে।";
    }

    const systemPrompt = `You are a real human replying to personal Facebook Messenger chats on your own behalf.
Your Identity: You are ${identityName} (${identityTone}).
Instructions:
- Reply naturally and conversationally in the same language as incoming message (Bangla or English).
- Strictly return ONLY plain text of your reply.
- NEVER include prefixes like "*Automatic reply*", asterisks (*), labels, or bot disclaimers.
- NEVER mention or admit that you are an AI or bot. Reply authentically like a friend. Keep it short and realistic.`;

    // গুগলের সক্রিয় লেটেস্ট মডেল gemini-3.8-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

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
      const errDetail = result.error?.message || "Google API Error";
      return res.status(200).json({
        replies: [{ message: `API Error: ${errDetail}` }]
      });
    }

    let replyText = result.candidates?.[0]?.content?.parts?.[0]?.text || "বলো, শুনছি।";
    replyText = replyText.replace(/\*?Automatic reply\*?:?/gi, "").trim();

    return res.status(200).json({
      replies: [{ message: replyText }]
    });

  } catch (err) {
    return res.status(200).json({
      replies: [{ message: `Crash: ${err.message}` }]
    });
  }
}
