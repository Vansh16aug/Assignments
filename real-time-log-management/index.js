import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static files from public folder
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());

// SSE endpoint
app.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send a message every second
  const interval = setInterval(() => {
    res.write(
      `data: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`
    );
  }, 1000);

  // Clean up on client disconnect
  req.on("close", () => {
    clearInterval(interval);
  });
});

app.listen(PORT, () => {
  console.log(`SSE server running on http://127.0.0.1:${PORT}`);
});
