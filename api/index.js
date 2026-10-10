export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ replies: [{ message: "Only POST allowed" }] });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      replies: [{ message: "Error: Vercel-এ GEMINI_API_KEY পাওয়া যায়নি!" }]
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

    // অ্যাকাউন্ট অনুযায়ী পরিচয় নির্ধারণ
    let identityName = "Rean Islam";
    let identityTone = "ছেলে, বন্ধুত্বপূর্ণ ও ক্যাজুয়াল মেজাজে কথা বলবে।";

    if (requestedAccount === "tonni") {
      identityName = "Sultana Nur Tonni";
      identityTone = "মেয়ে, মিষ্টি, ভদ্র ও ঘরোয়া ভাষায় কথা বলবে।";
    }

    const systemPrompt = `You are a real human replying to Facebook Messenger chats on your own behalf.
Identity: You are ${identityName} (${identityTone}).
Rules:
- Reply naturally like an authentic friend in the sender's language (Bangla or English).
- Return ONLY the direct message text.
- NEVER add prefixes like "*Automatic reply*", asterisks, labels, or disclaimers.
- NEVER mention you are an AI or bot. Keep replies realistic and short.`;

    // আপনার নতুন সক্রিয় মডেলগুলোর তালিকা
    const targetModels = [
      "gemini-3.8-flash",
      "3.8-flash",
      "gemini-3.5-flash-lite",
      "3.5-flash-lite",
      "gemini-3.1-pro",
      "3.1-pro"
    ];

    let replyText = "";
    let lastError = "";

    for (const model of targetModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\nIncoming message: ${userMessage}` }]
            }
          ]
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
          replyText = result.candidates[0].content.parts[0].text;
          break; // সফল হলে লুপ থেমে যাবে
        } else if (result.error?.message) {
          lastError = result.error.message;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    // যদি ফিক্সড মডেল নামের ফরম্যাট না মেলে, তবে এপিআই থেকে সরাসরি লাইভ মডেলের নাম খুঁজে নেবে
    if (!replyText) {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const listRes = await fetch(listUrl);
      const listData = await listRes.json();
      
      const availableModel = listData.models?.find(m => 
        m.supportedGenerationMethods?.includes("generateContent")
      );

      if (availableModel) {
        const dynamicUrl = `https://generativelanguage.googleapis.com/v1beta/${availableModel.name}:generateContent?key=${apiKey}`;
        const dynamicRes = await fetch(dynamicUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nIncoming message: ${userMessage}` }] }]
          })
        });
        const dynamicData = await dynamicRes.json();
        replyText = dynamicData.candidates?.[0]?.content?.parts?.[0]?.text;
      }
    }

    if (!replyText) {
      return res.status(200).json({
        replies: [{ message: `API Error: ${lastError}` }]
      });
    }

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
