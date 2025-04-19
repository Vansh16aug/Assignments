function EventList({ events }) {
  if (events.length === 0) {
    return <p className="empty-state">No upcoming events found.</p>;
  }

  return (
    <ul className="event-list">
      {events.map((event, i) => (
        <li key={i} className="event-item">
          <div className="event-title">{event.summary}</div>
          <div className="event-time">
            🕒 {formatDateTime(event.start?.dateTime || event.start?.date)}
          </div>
          {event.hangoutLink && (
            <div>
              🔗{" "}
              <a
                href={event.hangoutLink}
                target="_blank"
                rel="noreferrer"
                className="event-link"
              >
                Join Google Meet
              </a>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// Helper function to format date and time
function formatDateTime(dateTimeStr) {
  const date = new Date(dateTimeStr);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default EventList;
