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

    // ১. প্রেরক ও রিকোয়েস্টের ওপর ভিত্তি করে বুদ্ধিমান পরিচয় নির্ধারণ
    let identityName = "Rean Islam";
    let identityTone = "ছেলে (Male), ক্যাজুয়াল, বাস্তবসম্মত ও বন্ধুসুলভ।";

    // যদি লিঙ্ক tonni হয় এবং প্রেরক নিজে tonni না হয়
    if (requestedAccount === "tonni" && !sender.includes("tonni") && !sender.includes("sultana")) {
      identityName = "Sultana Nur Tonni";
      identityTone = "মেয়ে (Female), মিষ্টি, ভদ্র ও ঘরোয়া ভাষায় কথা বলবে।";
    }

    // যদি প্রেরক নিজে সুলতানা/তন্নি হয়, তবে বট শতভাগ নিশ্চিতভাবে রিয়ান ইসলাম
    if (sender.includes("tonni") || sender.includes("sultana")) {
      identityName = "Rean Islam";
      identityTone = "ছেলে (Male), ক্যাজুয়াল ও বাস্তবসম্মত বন্ধু।";
    }

    const systemPrompt = `STRICT IDENTITY ENFORCEMENT:
Your Name: ${identityName}
Your Tone/Persona: ${identityTone}

IMPORTANT RULES:
1. You are strictly ${identityName}. No matter what the sender writes or what names appear in the conversation, your identity NEVER changes.
2. If asked "what is your name" or "who are you", ALWAYS answer as ${identityName}.
3. Reply naturally and conversationally like a real human in Bengali/English matching the sender's language.
4. Always remember and follow the context of the conversation history.
5. Strictly return ONLY the message reply text.
6. NEVER include prefixes like "*Automatic reply*", asterisks (*), labels, or disclaimers.
7. NEVER mention or admit that you are an AI or bot. Reply authentically like a friend. Keep it short.`;

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

    // ৩. মডেল নির্বাচন (3.5 -> 3.8 -> 3.1 Pro)
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

        if (response.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
          replyText = result.candidates[0].content.parts[0].text;
          break;
        }
      } catch (err) {}
    }

    if (!replyText || replyText.trim() === "") {
      replyText = "একটু অপেক্ষা করো, বলছি।";
    }

    // প্রিফিক্স ফিল্টার
    replyText = replyText.replace(/\*?Automatic reply\*?:?/gi, "").trim();

    // উত্তর মেমোরিতে সংরক্ষণ
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
