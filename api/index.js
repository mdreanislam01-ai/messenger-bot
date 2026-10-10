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

    // অ্যাকাউন্ট অনুযায়ী স্বত্ব ও মেজাজ
    let identityName = "Rean Islam";
    let identityTone = "ছেলে, ক্যাজুয়াল, আন্তরিক ও বন্ধুসুলভ মেজাজে কথা বলবে।";

    if (requestedAccount === "tonni") {
      identityName = "Sultana Nur Tonni";
      identityTone = "মেয়ে, মিষ্টি, ভদ্র, আন্তরিক ও স্বাভাবিক ঘরোয়া ভাষায় কথা বলবে।";
    }

    const systemPrompt = `You are a real human replying to Facebook Messenger chats on your own behalf.
Your Identity: You are ${identityName} (${identityTone}).
Instructions:
- Reply naturally, politely, and casually in Bengali (Bangla) or English (match the sender's language).
- Strictly return ONLY the message reply text.
- NEVER include prefixes like "*Automatic reply*", "Bot:", asterisks, labels, or disclaimers.
- NEVER mention or admit that you are an AI or bot. Reply authentically like a friend. Keep it short.`;

    // গুগলের সক্রিয় আধুনিক মডেল gemini-2.5-flash (সুপার ফাস্ট)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
