import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express App
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.static("client"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Song metadata
const songs = [
  { id: "music1", title: "Sunny Days", file: "music.mp3" },
  { id: "music2", title: "Night Drive", file: "music2.mp3" },
  { id: "music3", title: "Morning Coffee", file: "music3.mp3" },
];

// Get songs list endpoint
app.get("/api/songs", (req, res) => {
  res.json(songs);
});

// Stream audio endpoint
app.get("/stream/:id", (req, res) => {
  const song = songs.find((s) => s.id === req.params.id);
  if (!song) return res.status(404).send("Song not found");

  const filePath = path.join(__dirname, "public", song.file);

  if (!fs.existsSync(filePath)) return res.status(404).send("File not found");

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    const maxChunkSize = start === 0 ? 256 * 1024 : 1024 * 1024;
    const adjustedEnd = Math.min(start + maxChunkSize - 1, end, fileSize - 1);
    const chunkSize = adjustedEnd - start + 1;

    const fileStream = fs.createReadStream(filePath, {
      start,
      end: adjustedEnd,
    });

    const headers = {
      "Content-Range": `bytes ${start}-${adjustedEnd}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-cache",
    };

    res.writeHead(206, headers);
    fileStream.pipe(res);
  } else {
    const initialChunkSize = Math.min(256 * 1024, fileSize);
    const fileStream = fs.createReadStream(filePath, {
      start: 0,
      end: initialChunkSize - 1,
    });

    const headers = {
      "Content-Range": `bytes 0-${initialChunkSize - 1}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": initialChunkSize,
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-cache",
    };

    res.writeHead(206, headers);
    fileStream.pipe(res);
  }
});

// Start server
app.listen(port, () => {
  console.log(`🎵 Music streaming server running at http://localhost:${port}`);
});
