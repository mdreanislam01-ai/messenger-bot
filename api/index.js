// মেমোরি স্টোরেজ (হিস্ট্রি মনে রাখার জন্য)
const chatMemory = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ replies: [{ message: "Only POST allowed" }] });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ replies: [{ message: "একটু ব্যস্ত আছি।" }] });
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

    // ১. বাংলাদেশ সময় এবং সময়কাল নির্ধারণ (Asia/Dhaka)
    const now = new Date();
    const bdTimeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      weekday: 'long'
    }).format(now);

    const hour24 = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: 'numeric',
      hour12: false
    }).format(now), 10);

    let timeContext = "দিন";
    if (hour24 >= 0 && hour24 < 5) {
      timeContext = "গভীর রাত (ঘুমানোর বা অলস সময়, বিছানায়/ফোনে থাকা স্বাভাবিক)";
    } else if (hour24 >= 5 && hour24 < 12) {
      timeContext = "সকাল";
    } else if (hour24 >= 12 && hour24 < 16) {
      timeContext = "দুপুর";
    } else if (hour24 >= 16 && hour24 < 18) {
      timeContext = "বিকাল";
    } else if (hour24 >= 18 && hour24 < 20) {
      timeContext = "সন্ধ্যা";
    } else {
      timeContext = "রাত";
    }

    // ২. পরিচয় ও সঠিক ব্যক্তিত্ব নির্ধারণ
    let identityName = "Rean Islam";
    let identityTone = "ছেলে (Male), রিল্যাক্সড, বাস্তবসম্মত ও ক্যাজুয়াল।";

    if (requestedAccount === "tonni" && !sender.includes("tonni") && !sender.includes("sultana")) {
      identityName = "Sultana Nur Tonni";
      identityTone = "মেয়ে (Female), মিষ্টি, ঘরোয়া ও স্বাভাবিক।";
    }

    if (sender.includes("tonni") || sender.includes("sultana")) {
      identityName = "Rean Islam";
      identityTone = "ছেলে (Male), ক্যাজুয়াল বন্ধু।";
    }

    // ৩. সময়জ্ঞান ও সংক্ষিপ্ততার কড়া নিয়ম
    const systemPrompt = `You are a real human named ${identityName} (${identityTone}) texting friends on Facebook Messenger.

CURRENT BANGLADESH TIME: ${bdTimeStr} (${timeContext}).

STRICT RULES:
1. TIME REALISM: 
   - Always be logically aware of the current time (${bdTimeStr}, ${timeContext}).
   - At late night (12 AM - 5 AM): Never say you just woke up, are eating breakfast, or going out/to classes. You are either chilling on your phone, working late, or getting sleepy.
   - Match daily routines realistically according to the exact time of day.
2. NO HALLUCINATIONS / FALSE FACTS:
   - Do NOT invent unrealistic stories or fake personal commitments. Keep facts grounded and simple.
3. CONCISE & NATURAL MESSAGING:
   - Reply in ONLY 1 short sentence (5-12 words max), just like a real person chats on Messenger.
   - Never write essays or unnecessary explanations.
4. STOP ASKING CLICHÉ QUESTIONS:
   - Do NOT continuously ask "দিন কেমন কাটছে?", "কী করছেন?" unless the friend explicitly asks for conversation.
   - Simply react naturally (e.g., if someone says "আলহামদুলিল্লাহ", say "হুম আলহামদুলিল্লাহ").
5. IDENTITY & CLEAN OUTPUT:
   - You are strictly ${identityName}. Your identity never changes.
   - Return ONLY the clean reply text. No quotes, labels, bot disclaimers, or asterisks (*).`;

    // ৪. মেমোরি সংরক্ষণ
    const sessionKey = `${requestedAccount}_${sender}`;
    let history = chatMemory.get(sessionKey) || [];
    history.push({ role: "user", parts: [{ text: userMessage }] });

    if (history.length > 6) history = history.slice(-6);

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

    // ৫. মডেল নির্বাচন (3.5 Flash-Lite -> 3.8 Flash -> 3.1 Pro)
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
            maxOutputTokens: 60, // সর্বোচ্চ ৬০ টোকেন (বড় উত্তরের সুযোগ নেই)
            temperature: 0.6
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
      replyText = "একটু ব্যস্ত আছি, পরে কথা বলছি।";
    }

    // প্রিফিক্স মুছে ফেলা
    replyText = replyText.replace(/\*?Automatic reply\*?:?/gi, "").trim();

    history.push({ role: "model", parts: [{ text: replyText }] });
    chatMemory.set(sessionKey, history);

    return res.status(200).json({
      replies: [{ message: replyText }]
    });

  } catch (err) {
    return res.status(200).json({
      replies: [{ message: "একটু পর বলছি।" }]
    });
  }
}
