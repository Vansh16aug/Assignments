"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import EventList from "./EventList";
import EventForm from "./EventForm";

// Configure axios to include credentials
axios.defaults.withCredentials = true;

const App = () => {
  const [events, setEvents] = useState([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://localhost:5000/events");
      setEvents(res.data);
    } catch (err) {
      console.error("Fetch events error:", err);
      if (err.response?.status === 401) {
        setLoggedIn(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const checkLogin = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://localhost:5000/status");
      setLoggedIn(res.data.loggedIn);
      if (res.data.loggedIn) {
        fetchEvents();
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error("Login check failed", err);
      setLoading(false);
    }
  };

  const handleAuth = () => {
    window.location.href = "http://localhost:5000/auth";
  };

  const handleLogout = async () => {
    try {
      await axios.get("http://localhost:5000/logout");
      setLoggedIn(false);
      setEvents([]);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  useEffect(() => {
    checkLogin();
  }, []);

  return (
    <div className="container">
      <h1 className="header">📅 Google Calendar Mini-Scheduler</h1>

      {!loggedIn ? (
        <div className="login-container">
          <p>Sign in with your Google account to manage your calendar events</p>
          <button className="btn btn-primary" onClick={handleAuth}>
            🔐 Sign in with Google
          </button>
        </div>
      ) : (
        <>
          <div className="status-badge">✅ Logged in</div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "20px",
            }}
          >
            <button
              className={`btn ${showForm ? "btn-secondary" : "btn-primary"}`}
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? "Hide Event Form" : "➕ Create New Event"}
            </button>

            <button className="btn btn-secondary" onClick={handleLogout}>
              Sign Out
            </button>
          </div>

          {showForm && <EventForm onSuccess={fetchEvents} />}

          <div className="divider"></div>

          <h2>Upcoming Events</h2>
          {loading ? (
            <p className="empty-state">Loading events...</p>
          ) : (
            <EventList events={events} />
          )}
        </>
      )}
    </div>
  );
};

export default App;
