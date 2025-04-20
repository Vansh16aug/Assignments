import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";
import cookieParser from "cookie-parser";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// 🔐 Google Auth URL
app.get("/auth", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    prompt: "consent",
  });
  res.redirect(url);
});

// 🔄 Handle Auth Callback
app.get("/auth/callback", async (req, res) => {
  try {
    const { tokens } = await oauth2Client.getToken(req.query.code);
    oauth2Client.setCredentials(tokens);

    res.cookie("access_token", tokens.access_token, { httpOnly: true });
    if (tokens.refresh_token) {
      res.cookie("refresh_token", tokens.refresh_token, { httpOnly: true });
    }

    res.redirect("http://localhost:5173");
  } catch (err) {
    res.status(500).send("Authentication failed");
  }
});

// ✅ Helper: Set credentials from cookies
function setCredentials(req) {
  if (req.cookies.access_token) {
    oauth2Client.setCredentials({
      access_token: req.cookies.access_token,
      refresh_token: req.cookies.refresh_token,
    });
    return true;
  }
  return false;
}

// 📅 Get Upcoming Events
app.get("/events", async (req, res) => {
  if (!setCredentials(req))
    return res.status(401).json({ error: "Login required" });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const { data } = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: 5,
    singleEvents: true,
    orderBy: "startTime",
  });

  res.json(data.items);
});

// ➕ Create a New Event
app.post("/create-event", async (req, res) => {
  if (!setCredentials(req))
    return res.status(401).json({ error: "Login required" });

  const { title, dateTime, addMeet } = req.body;
  const start = new Date(dateTime);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour

  const event = {
    summary: title,
    start: { dateTime: start.toISOString(), timeZone: "America/New_York" },
    end: { dateTime: end.toISOString(), timeZone: "America/New_York" },
    ...(addMeet && {
      conferenceData: {
        createRequest: {
          requestId: Date.now().toString(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    }),
  };

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const { data } = await calendar.events.insert({
    calendarId: "primary",
    resource: event,
    ...(addMeet && { conferenceDataVersion: 1 }),
  });

  res.json(data);
});

// 🔍 Check Login Status
app.get("/status", (req, res) => {
  res.json({ loggedIn: !!req.cookies.access_token });
});

// 🚪 Logout
app.get("/logout", (req, res) => {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  res.send("Logged out");
});

app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
