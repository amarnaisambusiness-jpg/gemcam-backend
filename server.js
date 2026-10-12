
import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
const port = process.env.PORT || 10000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const GEMINI_MODEL = "gemini-3.5-flash-lite";

// Receive raw JPEG images up to 2 MB.
app.use(
  express.raw({
    type: "image/jpeg",
    limit: "2mb"
  })
);

app.get("/", (req, res) => {
  res.type("text/plain").send(
    "GEMCAM AI CALCULATOR SERVER IS RUNNING"
  );
});

async function solveImage(imageBase64) {
  const prompt = `
You are GEMCAM AI, a careful school question solver.

IMPORTANT INSTRUCTIONS:
1. Inspect the entire image carefully.
2. Determine whether it contains a mathematics problem,
   school question, worksheet, textbook page or exam paper.
3. Read all visible numbers, mathematical signs, units,
   symbols and instructions before solving.
4. If it contains a mathematics problem, identify the exact
   problem and solve it step by step.
5. Verify arithmetic and the final result before replying.
6. For algebra, show the essential rearrangement and solution.
7. For geometry, use the visible measurements and explain
   the method briefly.
8. For physics and chemistry, give the relevant formula,
   substitution and final answer with units where applicable.
9. If several questions appear, solve the clearest main
   question first.
10. Never merely say "this is a question paper". Actually
    answer the visible question.
11. Never invent unreadable numbers or symbols. If the
    question cannot be read reliably, ask for a clearer photo.
12. If no academic question is present, briefly describe
    what is visible.

OUTPUT FORMAT:
Question: [short transcription of the problem]
Working: [short calculation or explanation]
Answer: [final answer]

Use plain text only. Keep the response concise for a small
OLED display. Do not omit the actual final answer.
`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      },
      { text: prompt }
    ]
  });

  return response.text || "No answer generated.";
}

app.post("/analyze", async (req, res) => {
  console.log("New image received");

  try {
    if (
      !Buffer.isBuffer(req.body) ||
      req.body.length === 0
    ) {
      return res.status(400).json({
        error: "No JPEG image received"
      });
    }

    console.log("Image size:", req.body.length, "bytes");

    const imageBase64 = req.body.toString("base64");
    const answer = await solveImage(imageBase64);

    console.log("AI answer:", answer);

    return res.status(200).json({
      result: answer
    });

  } catch (error) {
    console.error("AI request failed:", error);

    const message = String(error.message || error);
    const lower = message.toLowerCase();

    if (
      message.includes("429") ||
      message.includes("RESOURCE_EXHAUSTED") ||
      lower.includes("quota")
    ) {
      return res.status(429).json({
        error: "AI quota exceeded. Try again later."
      });
    }

    if (
      message.includes("503") ||
      message.includes("UNAVAILABLE") ||
      lower.includes("high demand")
    ) {
      return res.status(503).json({
        error: "AI is busy. Please try again."
      });
    }

    return res.status(500).json({
      error: "AI server error. Check Render logs."
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log("GEMCAM AI CALCULATOR SERVER");
  console.log("Port:", port);
  console.log("Model:", GEMINI_MODEL);
  console.log("POST /analyze ready");
});
