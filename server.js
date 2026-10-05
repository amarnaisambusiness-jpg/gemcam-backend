const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// --- ഇത് വളരെ പ്രധാനമാണ് (ESP32 അയക്കുന്ന Raw JPEG ഡാറ്റ റീഡ് ചെയ്യാൻ) ---
app.use(express.raw({ type: 'image/jpeg', limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ======================================================
// /analyze ROUTE
// ======================================================

app.post('/analyze', async (req, res) => {
  try {
    // req.body എന്നത് ഇപ്പോൾ raw buffer ആയിരിക്കും (JPEG ഡാറ്റ)
    if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "No image data received or invalid format" });
    }

    console.log("--------------------------------");
    console.log("Received image size:", req.body.length, "bytes");

    // ബഫറിനെ Base64 ആക്കി മാറ്റുന്നു
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
    console.log("RAW JPEG MODE WITH MIDDLEWARE");
    console.log("--------------------------------");
  }
);
