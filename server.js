 import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

// ESP32 അയക്കുന്ന Raw JPEG ഡാറ്റ സ്വീകരിക്കാൻ
app.use(express.raw({ type: 'image/jpeg', limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ======================================================
// /analyze ROUTE
// ======================================================

app.post('/analyze', async (req, res) => {
  try {
    if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "No image data received or invalid format" });
    }

    console.log("--------------------------------");
    console.log("Received image size:", req.body.length, "bytes");

    const imageBase64 = req.body.toString('base64');

    console.log("Sending image to Gemini...");

    const answer = await askGeminiWithRetry(
      imageBase64,
      "image/jpeg"
    );

    console.log("Gemini answer:");
    console.log(answer);
    console.log("--------------------------------");

    res.status(200).json({
      result: answer
    });

  } catch (error) {
    console.error("SERVER ERROR:");
    console.error(error);

    const message = String(error.message || error);

    if (
      message.includes("Quota Exceeded") ||
      message.includes("429")
    ) {
      return res.status(429).json({
        error: "Gemini API Quota Exceeded. Please try later."
      });
    }

    res.status(500).json({
      error: message
    });
  }
});

// ======================================================
// START SERVER
// ======================================================

app.listen(
  port,
  "0.0.0.0",
  () => {
    console.log("--------------------------------");
    console.log("GEMCAM AI SERVER");
    console.log("Server running on port:", port);
    console.log("POST /analyze ready");
    console.log("RAW JPEG MODE (ES MODULE)");
    console.log("--------------------------------");
  }
);
