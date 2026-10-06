import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
const port = process.env.PORT || 10000;

// ======================================================
// GEMINI
// ======================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const GEMINI_MODEL = "gemini-3.5-flash-lite";

// ======================================================
// RAW JPEG
// ======================================================

app.use(
  express.raw({
    type: "image/jpeg",
    limit: "500kb"
  })
);

// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {
  res.send("GEMCAM AI SERVER IS RUNNING");
});

// ======================================================
// GEMINI REQUEST
// ======================================================

async function askGemini(imageBase64) {

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {

    try {

      console.log(
        `Gemini attempt ${attempt}/${maxRetries}`
      );

      const response =
        await ai.models.generateContent({

          model: GEMINI_MODEL,

          contents: [

            {
              inlineData: {
                data: imageBase64,
                mimeType: "image/jpeg"
              }
            },

            {
              text:
                "You are the question-answering AI for GEMCAM. " +

                "Carefully inspect the entire image first. " +

                "If the image contains a school question, worksheet, " +
                "textbook problem, exam question, mathematics problem, " +
                "physics problem, chemistry problem, or any other academic " +
                "question, ALWAYS treat it as a question-answering task. " +

                "Read the question and all visible numbers, symbols and text " +
                "carefully. " +

                "Solve the problem yourself and give the correct answer. " +

                "Do not identify random objects in the image when a " +
                "question is present. " +

                "For calculation questions, show the essential calculation " +
                "briefly and then give the final answer. " +

                "For theory questions, give the direct correct answer with " +
                "a short explanation. " +

                "If the image contains multiple questions, answer the most " +
                "clearly visible main question first. " +

                "If the image is not a question paper or academic problem, " +
                "then briefly describe the main object or subject. " +

                "Use simple language suitable for a school student. " +

                "Keep the final response concise enough for an ESP32 OLED, " +
                "but do not omit the actual answer."
            }

          ]

        });

      console.log(
        "Gemini response received."
      );

      return (
        response.text ||
        "No answer from Gemini."
      );

    }

    catch (error) {

      console.error(
        `Gemini attempt ${attempt} failed`
      );

      console.error(error);

      const errorText =
        String(error);

      // ==================================================
      // 503 - MODEL TEMPORARILY UNAVAILABLE
      // ==================================================

      if (
        errorText.includes("503") ||
        errorText.includes("UNAVAILABLE") ||
        errorText.includes("high demand")
      ) {

        if (attempt < maxRetries) {

          const waitTime =
            attempt * 5000;

          console.log(
            `Gemini temporarily busy. ` +
            `Waiting ${waitTime / 1000} seconds...`
          );

          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                waitTime
              )
          );

          continue;
        }

        throw new Error(
          "Gemini model temporarily unavailable."
        );
      }

      // ==================================================
      // 429 - QUOTA / RATE LIMIT
      // ==================================================

      if (
        errorText.includes("429") ||
        errorText.includes("RESOURCE_EXHAUSTED") ||
        errorText.includes("Quota exceeded")
      ) {

        throw new Error(
          "Gemini API quota exceeded."
        );
      }

      // ==================================================
      // OTHER ERROR
      // ==================================================

      throw error;
    }
  }

  throw new Error(
    "Gemini request failed."
  );
}

// ======================================================
// ANALYZE IMAGE
// ======================================================

app.post(
  "/analyze",
  async (req, res) => {

    console.log(
      "--------------------------------"
    );

    console.log(
      "NEW IMAGE RECEIVED"
    );

    try {

      // ==================================================
      // CHECK IMAGE
      // ==================================================

      if (
        !req.body ||
        !Buffer.isBuffer(req.body) ||
        req.body.length === 0
      ) {

        console.log(
          "No image received"
        );

        return res.status(400).json({
          error: "No image received"
        });
      }

      // ==================================================
      // IMAGE INFO
      // ==================================================

      console.log(
        "Image size:",
        req.body.length,
        "bytes"
      );

      console.log(
        "Content-Type:",
        req.headers["content-type"]
      );

      // ==================================================
      // BASE64
      // ==================================================

      const imageBase64 =
        req.body.toString("base64");

      console.log(
        "Base64 size:",
        imageBase64.length
      );

      console.log(
        "Sending image to Gemini..."
      );

      // ==================================================
      // GEMINI
      // ==================================================

      const answer =
        await askGemini(
          imageBase64
        );

      // ==================================================
      // SUCCESS
      // ==================================================

      console.log();

      console.log(
        "===== GEMINI ANSWER ====="
      );

      console.log(answer);

      console.log(
        "========================="
      );

      return res.status(200).json({
        result: answer
      });

    }

    catch (error) {

      console.error();

      console.error(
        "===== SERVER ERROR ====="
      );

      console.error(error);

      console.error(
        "========================"
      );

      const message =
        String(
          error.message ||
          error
        );

      // ==================================================
      // QUOTA
      // ==================================================

      if (
        message.includes(
          "quota exceeded"
        ) ||
        message.includes("429")
      ) {

        return res.status(429).json({

          error:
            "Gemini API Quota Exceeded. " +
            "Please try again later."

        });
      }

      // ==================================================
      // MODEL BUSY
      // ==================================================

      if (
        message.includes(
          "temporarily unavailable"
        ) ||
        message.includes("503")
      ) {

        return res.status(503).json({

          error:
            "Gemini model is temporarily busy. " +
            "Please try again."

        });
      }

      // ==================================================
      // GENERAL ERROR
      // ==================================================

      return res.status(500).json({

        error: message

      });
    }
  }
);

// ======================================================
// START SERVER
// ======================================================

app.listen(
  port,
  "0.0.0.0",
  () => {

    console.log(
      "--------------------------------"
    );

    console.log(
      "GEMCAM AI SERVER"
    );

    console.log(
      "Server running on port:",
      port
    );

    console.log(
      "POST /analyze ready"
    );

    console.log(
      "MODEL:",
      GEMINI_MODEL
    );

    console.log(
      "QUESTION ANSWERING MODE"
    );

    console.log(
      "RAW JPEG MODE"
    );

    console.log(
      "--------------------------------"
    );

  }
);
