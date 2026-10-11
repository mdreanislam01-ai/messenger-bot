// মেমোরি স্টোরেজ
const chatMemory = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ replies: [{ message: "Only POST allowed" }] });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ replies: [{ message: "একটু ব্যস্ত।" }] });
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

    // ১. বাংলাদেশ সময় হিসাব (Asia/Dhaka)
    const now = new Date();
    const bdTimeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(now);

    const hour24 = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: 'numeric',
      hour12: false
    }).format(now), 10);

    let timeContext = "দিন";
    if (hour24 >= 0 && hour24 < 5) timeContext = "গভীর রাত";
    else if (hour24 >= 5 && hour24 < 12) timeContext = "সকাল";
    else if (hour24 >= 12 && hour24 < 17) timeContext = "দুপুর";
    else timeContext = "রাত";

    // ২. অ্যাকাউন্ট অনুযায়ী পরিচয়
    let identityName = "Rean Islam";
    let identityGender = "ছেলে (Male)";

    if (requestedAccount === "tonni" && !sender.includes("tonni") && !sender.includes("sultana")) {
      identityName = "Sultana Nur Tonni";
      identityGender = "মেয়ে (Female)";
    }

    if (sender.includes("tonni") || sender.includes("sultana")) {
      identityName = "Rean Islam";
      identityGender = "ছেলে (Male)";
    }

    // ৩. নাটকীয়তা বন্ধ ও মেসেঞ্জারের সংক্ষিপ্ত চ্যাটের বাস্তব উদাহরণ
    const systemPrompt = `You are ${identityName} (${identityGender}), chatting casually on Facebook Messenger.
Current Bangladesh Time: ${bdTimeStr} (${timeContext}).

ABSOLUTE CHAT RULES:
1. MAX 3 TO 7 WORDS ONLY. Never exceed 1 short phrase.
2. NO THEATRICAL / DRAMATIC WORDS: Strictly BANNED words: "গো", "সোনা", "প্রিয়", "মাশাআল্লাহ শুনে মন ভরে গেল", "বলো গো শুনছি"।
3. REAL MESSENGER EXAMPLES:
   - User: "আলহামদুলিল্লাহ" -> Reply: "হুম, আলহামদুলিল্লাহ।"
   - User: "হ্যাঁ বলো" / "কী বলবা বলো" -> Reply: "আরে কিছু না, এমনি।"
   - User: "কেমন আছো?" -> Reply: "ভালো, তুমি?"
   - User: "কী করো?" -> (Time: ${timeContext}) -> Reply: "এইতো ফোন টিপছি।" or "শুয়ে আছি।"
   - User: "সরি" -> Reply: "আরে ব্যাপার না।"
4. NO UNNECESSARY QUESTIONS: Never ask random follow-up questions like "দিন কেমন কাটছে?" or "কী করতেছো?". Just answer simply.
5. NO FAKE STORIES: Don't pretend you have huge secrets or fake news.
6. OUTPUT: Raw single short line only. No quotes, no bot prefixes.`;

    // ৪. চ্যাট মেমোরি (শেষ ৪টি মেসেজ নেওয়া হচ্ছে যাতে আগের বড় চ্যাটের প্রভাব কেটে যায়)
    const sessionKey = `${requestedAccount}_${sender}`;
    let history = chatMemory.get(sessionKey) || [];
    history.push({ role: "user", parts: [{ text: userMessage }] });

    if (history.length > 4) history = history.slice(-4);

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

    // ৫. মডেল কল (টোকেন লিমিট মাত্র ৩৫)
    const targetModels = [
      "gemini-3.5-flash-lite",
      "gemini-3.8-flash",
      "gemini-3.1-pro"
    ];

    let replyText = "";

    for (const modelName of targetModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const payload = {
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: sanitizedContents,
          generationConfig: {
            maxOutputTokens: 35, // সর্বোচ্চ ৩৫ টোকেন (বড় লেখা টেকনিক্যালি অসম্ভব)
            temperature: 0.3    // একদম নিখুঁত ও বাস্তবমুখী উত্তরের জন্য
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
          break;
        }
      } catch (err) {}
    }

    if (!replyText || replyText.trim() === "") {
      replyText = "হুম।";
    }

    // অপ্রয়োজনীয় ডায়লগ ও চিহ্ন ফিল্টার
    replyText = replyText.replace(/\*?Automatic reply\*?:?/gi, "").trim();

    history.push({ role: "model", parts: [{ text: replyText }] });
    chatMemory.set(sessionKey, history);

    return res.status(200).json({
      replies: [{ message: replyText }]
    });

  } catch (err) {
    return res.status(200).json({
      replies: [{ message: "একটু পর কথা বলছি।" }]
    });
  }
}
