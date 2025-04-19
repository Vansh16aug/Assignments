import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS to allow credentials
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

app.get("/auth", (req, res) => {
  const scopes = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  res.redirect(url);
});

app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens } = await oauth2Client.getToken(code);

    // Store tokens in HTTP-only cookies
    res.cookie("access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: tokens.expiry_date ? tokens.expiry_date - Date.now() : 3600000,
    });

    if (tokens.refresh_token) {
      res.cookie("refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    res.redirect("http://localhost:5173/");
  } catch (err) {
    console.error("Error exchanging code:", err.message);
    res.status(500).send("Authentication failed");
  }
});

// Helper function to set credentials from cookies
const setCredentialsFromCookies = (req) => {
  if (req.cookies.access_token) {
    const credentials = {
      access_token: req.cookies.access_token,
    };

    if (req.cookies.refresh_token) {
      credentials.refresh_token = req.cookies.refresh_token;
    }

    oauth2Client.setCredentials(credentials);
    return true;
  }
  return false;
};

app.get("/events", async (req, res) => {
  try {
    if (!setCredentialsFromCookies(req)) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 5,
      singleEvents: true,
      orderBy: "startTime",
    });

    res.json(response.data.items);
  } catch (err) {
    console.error("Error fetching events:", err.message);
    if (err.code === 401) {
      res.clearCookie("access_token");
      return res.status(401).json({ error: "Token expired" });
    }
    res.status(500).send("Error fetching events");
  }
});

app.post("/create-event", async (req, res) => {
  const { title, dateTime, addMeet } = req.body;

  try {
    if (!setCredentialsFromCookies(req)) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const startTime = new Date(dateTime);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const event = {
      summary: title,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: "America/New_York",
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: "America/New_York",
      },
      ...(addMeet && {
        conferenceData: {
          createRequest: {
            requestId: Date.now().toString(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      }),
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
      ...(addMeet && { conferenceDataVersion: 1 }),
    });

    res.json(response.data);
  } catch (err) {
    console.error("❌ Error creating event:", err.message);
    console.error("🔍 Full error:", err.response?.data || err);
    if (err.code === 401) {
      res.clearCookie("access_token");
      return res.status(401).json({ error: "Token expired" });
    }
    res.status(500).send("Error creating event");
  }
});

app.get("/status", (req, res) => {
  if (req.cookies.access_token) {
    res.json({ loggedIn: true });
  } else {
    res.json({ loggedIn: false });
  }
});

app.get("/logout", (req, res) => {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  res.send("Logged out");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
