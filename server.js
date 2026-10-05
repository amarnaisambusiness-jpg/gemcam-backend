import express from 'express';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = process.env.PORT || 10000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// Accept raw JPEG binary directly from ESP32
app.use(
  express.raw({
    type: 'image/jpeg',
    limit: '500kb'
  })
);

app.get("/", (req, res) => {
  res.send("GEMCAM AI SERVER IS RUNNING");
});

async function askGeminiWithRetry(imageBase64, mimeType) {

  const maxRetries = 4;

  for (
    let attempt = 1;
    attempt <= maxRetries;
    attempt++
  ) {

    try {

      console.log(
        `Gemini attempt ${attempt}/${maxRetries}`
      );

      const response =
        await ai.models.generateContent({

          model: "gemini-3.8-flash",

          contents: [

            {
              inlineData: {
                data: imageBase64,
                mimeType:
                  mimeType || "image/jpeg"
              }
            },

            {
              text:
                "Look carefully at this image. " +
                "If it contains a Plus One or Plus Two school question, " +
                "solve it and give the answer clearly. " +
                "Otherwise describe what is visible. " +
                "Keep the answer short and suitable for a 128x64 OLED display."
            }

          ]

        });

      return (
        response.text ||
        "No answer from Gemini."
      );

    } catch (error) {

      console.error(
        `Gemini attempt ${attempt} failed:`
      );

      console.error(error);

      const errorText =
        String(error);

      if (
        errorText.includes("429") ||
        errorText.includes("RESOURCE_EXHAUSTED") ||
        errorText.includes("Quota exceeded")
      ) {

        throw new Error(
          "Gemini API Quota Exceeded. Please try later."
        );
      }

      if (
        errorText.includes("503") ||
        errorText.includes("UNAVAILABLE") ||
        errorText.includes("high demand")
      ) {

        if (
          attempt < maxRetries
        ) {

          const waitTime =
            attempt * 5000;

          console.log(
            `Gemini temporarily unavailable. ` +
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
      }

      throw error;
    }
  }

  throw new Error(
    "Gemini request failed."
  );
}

// ======================================================
// RAW JPEG ENDPOINT
// ======================================================

app.post(
  "/analyze",
  async (req, res) => {

    console.log(
      "--------------------------------"
    );

    console.log(
      "New image received"
    );

    try {

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

      console.log(
        "Image size:",
        req.body.length
      );

      console.log(
        "Content-Type:",
        req.headers["content-type"]
      );

      const imageBase64 =
        req.body.toString("base64");

      console.log(
        "Sending image to Gemini..."
      );

      const answer =
        await askGeminiWithRetry(
          imageBase64,
          "image/jpeg"
        );

      console.log(
        "Gemini answer:"
      );

      console.log(answer);

      console.log(
        "--------------------------------"
      );

      res.status(200).json({
        result: answer
      });

    } catch (error) {

      console.error(
        "SERVER ERROR:"
      );

      console.error(error);

      const message =
        String(
          error.message || error
        );

      if (
        message.includes(
          "Quota Exceeded"
        ) ||
        message.includes("429")
      ) {

        return res.status(429).json({
          error:
            "Gemini API Quota Exceeded. Please try later."
        });
      }

      res.status(500).json({
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
      "RAW JPEG MODE"
    );

    console.log(
      "--------------------------------"
    );
  }
);
