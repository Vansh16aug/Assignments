"use client";

import { useState } from "react";
import axios from "axios";

function EventForm({ onSuccess }) {
  const [title, setTitle] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [addMeet, setAddMeet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await axios.post("http://localhost:5000/create-event", {
        title,
        dateTime,
        addMeet,
      });

      const { hangoutLink } = res.data;
      alert(`✅ Event Created!${hangoutLink ? "\nMeet: " + hangoutLink : ""}`);

      setTitle("");
      setDateTime("");
      setAddMeet(false);
      onSuccess(); // Refresh events
    } catch (err) {
      console.error("Event creation failed:", err);
      setError("Failed to create event. Please try again.");
      if (err.response?.status === 401) {
        setError("Your session has expired. Please sign in again.");
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="title">Event Title:</label>
        <input
          id="title"
          className="form-control"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="dateTime">Start Date & Time:</label>
        <input
          id="dateTime"
          type="datetime-local"
          className="form-control"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          required
        />
      </div>

      <div className="checkbox-group">
        <input
          id="addMeet"
          type="checkbox"
          checked={addMeet}
          onChange={(e) => setAddMeet(e.target.checked)}
        />
        <label htmlFor="addMeet">Add Google Meet link</label>
      </div>

      {error && (
        <p style={{ color: "var(--accent-color)", marginBottom: "10px" }}>
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? "Creating..." : "📅 Create Event"}
      </button>
    </form>
  );
}

export default EventForm;
