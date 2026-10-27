import "./Attendance.css";
import { useCallback, useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function formatTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

export default function AttendancePage({ token }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [workingHours, setWorkingHours] = useState(null);

  const loadAttendance = useCallback(async () => {
    if (!token) {
      setError("Please log in to view attendance.");
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await fetch(`${API_URL}/attendance`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not load attendance.");
      }

      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Could not load attendance.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const today = new Date().toLocaleDateString("en-CA");
  const todayRecord = records.find((item) => item.date === today);
  const checkedIn = Boolean(todayRecord?.check_in);
  const checkedOut = Boolean(todayRecord?.check_out);

  async function performAction(action) {
    if (!token) {
      setError("Please log in again.");
      return;
    }

    setActionLoading(true);
    setError("");
    setMessage("");
    setWorkingHours(null);

    try {
      const response = await fetch(
        `${API_URL}/attendance/${action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Attendance action failed.");
      }

      setMessage(data.message || "Attendance updated successfully.");

      if (typeof data.working_hours === "number") {
        setWorkingHours(data.working_hours);
      }

      await loadAttendance();
    } catch (err) {
      setError(err.message || "Attendance action failed.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
     <section className="panel attendance-page">
      <div className="panel-heading">
        <div>
          <h3>Attendance Management</h3>
          <p>Monitor employee attendance and working hours.</p>
        </div>
      </div>

      <div className="attendance-actions">
        <div>
          <strong>Today's Attendance</strong>
          <p>{new Date().toLocaleDateString()}</p>
          <p>
            Check-in: {formatTime(todayRecord?.check_in)}
            {" · "}
            Check-out: {formatTime(todayRecord?.check_out)}
          </p>
        </div>

        <div className="attendance-buttons">
          <button
            type="button"
            onClick={() => performAction("check-in")}
            disabled={actionLoading || checkedIn}
          >
            {actionLoading ? "Please wait..." : "Check In"}
          </button>

          <button
            type="button"
            onClick={() => performAction("check-out")}
            disabled={actionLoading || !checkedIn || checkedOut}
          >
            {actionLoading ? "Please wait..." : "Check Out"}
          </button>
        </div>
      </div>

      {message && <p role="status" className="success-message">{message}</p>}
      {error && <p role="alert" className="error-message">{error}</p>}

      {workingHours !== null && (
        <p>
          Working hours for this session: <strong>{workingHours} hours</strong>
        </p>
      )}

      <div className="attendance-history">
        <h3>Attendance History</h3>

        {loading ? (
          <p>Loading attendance records...</p>
        ) : records.length === 0 ? (
          <p>No attendance records found.</p>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee ID</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Working Hours</th>
                  <th>Overtime</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{formatDate(record.date)}</td>
                    <td>{record.employee_id ?? "—"}</td>
                    <td>{formatTime(record.check_in)}</td>
                    <td>{formatTime(record.check_out)}</td>
                    <td>
                      {record.working_hours == null
                        ? "—"
                        : `${record.working_hours} hrs`}
                    </td>
<td>
  {record.overtime_hours == null
    ? "—"
    : `${record.overtime_hours} hrs`}
</td>
<td>
  <span
    className={`attendance-status status-${String(
      record.status || "unknown"
    ).toLowerCase()}`}
  >
    {record.status === "PRESENT"
      ? "On Time"
      : record.status === "LATE"
      ? "Late"
      : record.status || "—"}
  </span>
</td>                </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button type="button" onClick={loadAttendance} disabled={loading}>
        Refresh Attendance
      </button>
    </section>
  );
}
