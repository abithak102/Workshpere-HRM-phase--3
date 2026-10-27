
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";

export default function NotificationsPage({ token }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadNotifications = useCallback(async (showLoading = false) => {
    if (!token) {
      setError("Please log in to view notifications.");
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);

    try {
      const data = await apiRequest("/notifications", {}, token);
      setNotifications(
        Array.isArray(data) ? data : data?.notifications ?? []
      );
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadNotifications(true);

    const timer = setInterval(() => {
      loadNotifications(false);
    }, 15000);

    return () => clearInterval(timer);
  }, [loadNotifications]);

  async function markAsRead(notification) {
    if (notification.id == null) return;

    try {
      await apiRequest(
        `/notifications/${notification.id}/read`,
        { method: "PATCH" },
        token
      );

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, is_read: true }
            : item
        )
      );
    } catch (err) {
      setError(err.message || "Unable to mark notification as read.");
    }
  }

  const unreadCount = notifications.filter(
    (item) => !item.is_read
  ).length;

  return (
    <div className="page-content">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2>Notifications</h2>
          <p>Leave approvals, payroll updates, and attendance alerts.</p>
          <p>
            Unread: <strong>{unreadCount}</strong>
          </p>
          {lastUpdated && (
            <small>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </small>
          )}
        </div>

        <button
          type="button"
          onClick={() => loadNotifications(true)}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      )}

      {loading && <p>Loading notifications...</p>}

      {!loading && !error && notifications.length === 0 && (
        <p>No notifications found.</p>
      )}

      {!loading && notifications.length > 0 && (
        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          {notifications.map((notification, index) => {
            const read = Boolean(notification.is_read);

            return (
              <article
                key={notification.id ?? index}
                style={{
                  padding: 16,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  background: read ? "#fff" : "#f0f7ff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <strong>{notification.title || "Notification"}</strong>
                  <span>{read ? "Read" : "Unread"}</span>
                </div>

                <p>{notification.message || "No message available."}</p>

                {notification.created_at && (
                  <small>
                    {new Date(notification.created_at).toLocaleString()}
                  </small>
                )}

                {!read && notification.id != null && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => markAsRead(notification)}
                    >
                      Mark as read
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
