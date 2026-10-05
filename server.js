import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
const port = process.env.PORT || 10000;

// =====================================================
// GEMINI
// =====================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// =====================================================
// RAW JPEG BODY
// ESP32 നേരിട്ട് JPEG bytes അയക്കും
// =====================================================

app.use(
  express.raw({
    type: "image/jpeg",
    limit: "500kb"
  })
);

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  res.send("GEMCAM AI SERVER IS RUNNING");
});

// =====================================================
// GEMINI
// =====================================================

async function askGemini(imageBase64) {

  const maxRetries = 4;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {

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
                mimeType: "image/jpeg"
              }
            },

            {
              text:
                "Look carefully at this image. " +
                "If there is a school question, read it carefully " +
                "and solve it. Give the correct answer clearly. " +
                "Otherwise describe the main things visible. " +
                "Keep the answer short enough for a small OLED display."
            }

          ]

        });

      return response.text || "No answer from Gemini.";

    }

    catch (error) {

      console.error(
        `Gemini attempt ${attempt} failed`
      );

      console.error(error);

      const errorText =
        String(error);

      // ---------------------------------------------
      // QUOTA
      // ---------------------------------------------

      if (
        errorText.includes("429") ||
        errorText.includes("RESOURCE_EXHAUSTED") ||
        errorText.includes("Quota exceeded")
      ) {

        throw new Error(
          "Gemini API Quota Exceeded. Please try later."
        );

      }

      // ---------------------------------------------
      // TEMPORARY SERVER BUSY
      // ---------------------------------------------

      if (
        errorText.includes("503") ||
        errorText.includes("UNAVAILABLE") ||
        errorText.includes("high demand")
      ) {

        if (attempt < maxRetries) {

          const waitTime =
            attempt * 5000;

          console.log(
            `Waiting ${waitTime / 1000} seconds...`
          );

          await new Promise(
            resolve =>
              setTimeout(resolve, waitTime)
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

// =====================================================
// POST /analyze
// RAW JPEG FROM ESP32
// =====================================================

app.post("/analyze", async (req, res) => {

  console.log("");
  console.log("--------------------------------");
  console.log("NEW IMAGE RECEIVED");

  try {

    // -----------------------------------------------
    // CHECK IMAGE
    // -----------------------------------------------

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

    // -----------------------------------------------
    // IMAGE INFO
    // -----------------------------------------------

    console.log(
      "Image size:",
      req.body.length,
      "bytes"
    );

    console.log(
      "Content-Type:",
      req.headers["content-type"]
    );

    // -----------------------------------------------
    // CONVERT JPEG → BASE64
    // -----------------------------------------------

    const imageBase64 =
      req.body.toString("base64");

    console.log(
      "Base64 size:",
      imageBase64.length
    );

    // -----------------------------------------------
    // SEND TO GEMINI
    // -----------------------------------------------

    console.log(
      "Sending image to Gemini..."
    );

    const answer =
      await askGemini(
        imageBase64
      );

    // -----------------------------------------------
    // RESULT
    // -----------------------------------------------

    console.log("");
    console.log("GEMINI ANSWER:");
    console.log(answer);
    console.log("--------------------------------");

    return res.status(200).json({

      result: answer

    });

  }

  catch (error) {

    console.error("");
    console.error("SERVER ERROR:");
    console.error(error);

    const message =
      String(
        error.message || error
      );

    // ---------------------------------------------
    // QUOTA ERROR
    // ---------------------------------------------

    if (
      message.includes("Quota Exceeded") ||
      message.includes("429")
    ) {

      return res.status(429).json({

        error:
          "Gemini API Quota Exceeded. Please try later."

      });

    }

    // ---------------------------------------------
    // GENERAL ERROR
    // ---------------------------------------------

    return res.status(500).json({

      error: message

    });

  }

});

// =====================================================
// START SERVER
// =====================================================

app.listen(
  port,
  "0.0.0.0",
  () => {

    console.log("");
    console.log("--------------------------------");
    console.log("GEMCAM AI SERVER");
    console.log(
      "Server running on port:",
      port
    );
    console.log("POST /analyze ready");
    console.log("RAW JPEG MODE");
    console.log("--------------------------------");

  }
);
