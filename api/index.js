// মেমোরি স্টোরেজ (কথোপকথনের হিস্ট্রি মনে রাখার জন্য)
const chatMemory = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ replies: [{ message: "Only POST allowed" }] });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ replies: [{ message: "একটু অপেক্ষা করো, এখনই আসছি।" }] });
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
    const sender = (body.query?.sender || "friend").toLowerCase();
    const requestedAccount = (req.query?.account || "").toLowerCase();

    if (!userMessage || userMessage.trim() === "") {
      return res.status(200).json({ replies: [] });
    }

    // ১. অ্যাকাউন্ট অনুযায়ী সঠিক পরিচয় ও ভূমিকা
    let identityName = "Rean Islam";
    let identityTone = "ছেলে, বন্ধুত্বপূর্ণ, ক্যাজুয়াল, আন্তরিক ও মানুষের মতো বাস্তবসম্মত মেজাজে কথা বলবে।";

    if (requestedAccount === "tonni") {
      identityName = "Sultana Nur Tonni";
      identityTone = "মেয়ে, মিষ্টি, ভদ্র, আন্তরিক ও স্বাভাবিক ঘরোয়া ভাষায় কথা বলবে।";
    }

    const systemPrompt = `You are a real human replying to personal Facebook Messenger messages on your own behalf.
Your Identity: You are ${identityName} (${identityTone}).
Instructions:
- Reply naturally and conversationally in the same language as incoming message (Bengla or English).
- Always remember and follow the context of the conversation history.
- Strictly return ONLY the message reply text.
- NEVER include prefixes like "*Automatic reply*", asterisks (*), labels, or disclaimers.
- NEVER mention or admit that you are an AI or bot. Reply authentically like a friend. Keep it concise.`;

    // ২. মেমোরি লোড ও সাজানো
    const sessionKey = `${requestedAccount}_${sender}`;
    let history = chatMemory.get(sessionKey) || [];

    // ব্যবহারকারীর নতুন মেসেজ মেমোরিতে যুক্ত করা
    history.push({ role: "user", parts: [{ text: userMessage }] });

    // মেমোরি ফ্রেশ রাখতে শেষ ১০টি মেসেজ সংরক্ষিত থাকবে
    if (history.length > 10) {
      history = history.slice(-10);
    }

    // গুগল API ফরম্যাট অনুযায়ী মেমোরি ঠিক রাখা (alternating user/model)
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

    // ৩. হাই-ডিমান্ড এড়াতে সক্রিয় মডেলগুলো (একটি বিজি থাকলে সাথে সাথে অন্যটিতে চলে যাবে)
    const availableModels = [
      "gemini-3.5-flash-lite", // অতি দ্রুতগতির
      "gemini-3.8-flash",      // মূল মডেল
      "gemini-3.1-pro"         // অ্যাডভান্সড ব্যাকআপ
    ];

    let replyText = "";

    for (const modelName of availableModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const payload = {
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: sanitizedContents,
          generationConfig: {
            maxOutputTokens: 250,
            temperature: 0.7
          }
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        // যদি উত্তর সফলভাবে আসে এবং কোনো ডিমান্ড এরর না থাকে
        if (response.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
          replyText = result.candidates[0].content.parts[0].text;
          break; // সফল হলে লুপ সাথে সাথে বন্ধ
        }
      } catch (err) {
        // কোনো মডেল ফেইল করলে নিঃশব্দে পরের মডেলে যাবে
      }
    }

    // ৪. যদি সব মডেলই সাময়িক বিজি থাকে, তাহলেও কোনো এরর দেখাবে না
    if (!replyText || replyText.trim() === "") {
      replyText = "একটু অপেক্ষা করো, এখনই বলছি।";
    }

    // প্রিফিক্স ও অতিরিক্ত চিহ্ন ফিল্টার করা
    replyText = replyText.replace(/\*?Automatic reply\*?:?/gi, "").trim();

    // এআই-এর উত্তর মেমোরিতে সেভ করা
    history.push({ role: "model", parts: [{ text: replyText }] });
    chatMemory.set(sessionKey, history);

    return res.status(200).json({
      replies: [{ message: replyText }]
    });

  } catch (err) {
    // যেকোনো ক্র্যাশের ক্ষেত্রেও সাধারণ মানুষের মতো উত্তর দিবে
    return res.status(200).json({
      replies: [{ message: "একটু অপেক্ষা করো, এখনই বলছি।" }]
    });
  }
}
