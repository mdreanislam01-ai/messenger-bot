export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ replies: [{ message: "Only POST allowed" }] });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ replies: [{ message: "Error: GEMINI_API_KEY পাওয়া যায়নি।" }] });
  }

  try {
    const data = req.body || {};
    const queryParams = req.query || {};
    
    // AutoResponder পাঠানো মেসেজ
    const userMessage = data.query?.message || data.message || data.text || "";
    const requestedAccount = queryParams.account || "";

    if (!userMessage || userMessage.trim() === "") {
      return res.status(200).json({ replies: [] });
    }

    // অ্যাকাউন্ট অনুযায়ী ব্যক্তিত্ব ও নাম
    let identityName = "Rean Islam";
    let identityTone = "ছেলে, বন্ধুত্বপূর্ণ ও ক্যাজুয়াল মেজাজে কথা বলবে।";

    if (requestedAccount === "tonni") {
      identityName = "Sultana Nur Tonni";
      identityTone = "মেয়ে, মিষ্টি, ভদ্র ও ঘরোয়াভাবে কথা বলবে।";
    }

    const systemPrompt = `You are a real human replying to personal Facebook Messenger chats.
Your identity: You are ${identityName} (${identityTone}).
Instructions:
- Reply naturally like an authentic human friend in Bengali (Bangla) or English based on the sender's language.
- Strictly return ONLY the plain text reply.
- Never add prefixes like "Automatic reply", asterisks, labels, or bot disclaimers.
- Never mention you are an AI or bot. Keep replies short and realistic.`;

    // সরাসরি Google Gemini REST API কল (v1beta gemini-1.5-flash)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const bodyData = {
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
      body: JSON.stringify(bodyData)
    });

    const result = await response.json();

    if (!response.ok) {
      // যদি Google কোনো এরর দেয়, তবে সরাসরি সেই এররটি দেখাবে যাতে বোঝা যায়
      const errMsg = result.error?.message || "Google API Error";
      return res.status(200).json({
        replies: [{ message: `API Error: ${errMsg}` }]
      });
    }

    let replyText = result.candidates?.[0]?.content?.parts?.[0]?.text || "বলো, শুনছি।";
    replyText = replyText.replace(/\*?Automatic reply\*?:?/gi, "").trim();

    return res.status(200).json({
      replies: [{ message: replyText }]
    });

  } catch (err) {
    return res.status(200).json({
      replies: [{ message: `Server Error: ${err.message}` }]
    });
  }
}
