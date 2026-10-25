import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";

export default function NotificationsPage({ token }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    if (!token) {
      setError("Login session ലഭ്യമല്ല. വീണ്ടും login ചെയ്യുക.");
      setLoading(false);
      return;
    }

    try {
      setError("");
      const data = await apiRequest("/notifications", {}, token);
      setNotifications(Array.isArray(data) ? data : data?.notifications ?? []);
    } catch (err) {
      setError(err.message || "Notifications load ചെയ്യാൻ കഴിഞ്ഞില്ല.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function markAsRead(notification) {
    const id = notification.id;
    if (id == null) return;

    try {
      await apiRequest(`/notifications/${id}/read`, { method: "PATCH" }, token);
      setNotifications((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, is_read: true, read: true, status: "READ" }
            : item
        )
      );
    } catch (err) {
      setError(err.message || "Notification update ചെയ്യാൻ കഴിഞ്ഞില്ല.");
    }
  }

  return (
    <div className="page-content">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2>Notifications</h2>
          <p>Leave approval, payroll updates, and other messages.</p>
        </div>
        <button type="button" onClick={loadNotifications}>
          Refresh
        </button>
      </div>

      {loading && <p>Notifications load ചെയ്യുന്നു...</p>}

      {error && (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      )}

      {!loading && !error && notifications.length === 0 && (
        <p>No notifications found.</p>
      )}

      {!loading && notifications.length > 0 && (
        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          {notifications.map((notification, index) => {
            const read =
              notification.is_read === true ||
              notification.read === true ||
              String(notification.status || "").toUpperCase() === "READ";

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
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <strong>
                    {notification.title || notification.subject || "Notification"}
                  </strong>
                  <span>{read ? "Read" : "Unread"}</span>
                </div>

                <p>
                  {notification.message ||
                    notification.body ||
                    notification.content ||
                    "No message details available."}
                </p>

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
