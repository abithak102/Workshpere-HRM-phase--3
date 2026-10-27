
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";
import "./LeaveManagement.css";

export default function LeaveManagementPage({ token, user }) {
  const [leaves, setLeaves] = useState([]);
  const [leaveType, setLeaveType] = useState("CASUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedCalendarDate, setSelectedCalendarDate] =
  useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
});

  const role = String(user?.role || "").toUpperCase();
  const canDecide = ["ADMIN", "HR"].includes(role);

  const loadLeaves = useCallback(async () => {
    if (!token) return;

    try {
      setError("");
      const data = await apiRequest("/leaves", {}, token);
      setLeaves(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load leave requests.");
    }
  }, [token]);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  async function applyLeave(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!startDate || !endDate || !reason.trim()) {
      setError("Please fill in all leave request fields.");
      return;
    }

    if (endDate < startDate) {
      setError("End date cannot be earlier than start date.");
      return;
    }

    setBusy(true);

    try {
      await apiRequest(
        "/leaves",
        {
          method: "POST",
          body: JSON.stringify({
            leave_type: leaveType,
            start_date: startDate,
            end_date: endDate,
            reason: reason.trim(),
          }),
        },
        token
      );

      setMessage("Leave request submitted successfully.");
      setStartDate("");
      setEndDate("");
      setReason("");
      await loadLeaves();
    } catch (err) {
      setError(err.message || "Unable to submit leave request.");
    } finally {
      setBusy(false);
    }
  }

  async function decideLeave(leaveId, decision) {
    setError("");
    setMessage("");
    setBusy(true);

    try {
      await apiRequest(
        `/leaves/${leaveId}/decision?decision=${decision}`,
        { method: "PATCH" },
        token
      );

      setMessage(`Leave request ${decision.toLowerCase()} successfully.`);
      await loadLeaves();
    } catch (err) {
      setError(err.message || "Unable to update leave request.");
    } finally {
      setBusy(false);
    }
  }

  function formatDate(value) {
    if (!value) return "—";

    const datePart = String(value).slice(0, 10);
    const parts = datePart.split("-");

    if (parts.length !== 3) return datePart;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  function getStatusClass(status) {
    const value = String(status || "PENDING").toUpperCase();

    if (value === "APPROVED") return "status-approved";
    if (value === "REJECTED") return "status-rejected";
    return "status-pending";
  }
    function changeCalendarMonth(offset) {
    setCalendarMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + offset,
          1
        )
    );
  }

  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();

  const firstDay = new Date(
    calendarYear,
    calendarMonthIndex,
    1
  ).getDay();

  const daysInMonth = new Date(
    calendarYear,
    calendarMonthIndex + 1,
    0
  ).getDate();

  const calendarCells = [
    ...Array(firstDay).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => index + 1
    ),
  ];

  const monthLabel = calendarMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function getLeavesForDay(day) {
    if (!day) return [];

    const date = [
      calendarYear,
      String(calendarMonthIndex + 1).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-");

    return leaves.filter((leave) => {
      const status = String(leave.status || "").toUpperCase();

      return (
        status !== "REJECTED" &&
        leave.start_date <= date &&
        leave.end_date >= date
      );
    });
  }

  const selectedCalendarLeaves = selectedCalendarDate
    ? leaves.filter((leave) => {
        const status = String(leave.status || "").toUpperCase();

        return (
          status !== "REJECTED" &&
          leave.start_date <= selectedCalendarDate &&
          leave.end_date >= selectedCalendarDate
        );
      })
    : [];

  function makeCalendarDate(day) {
    return [
      calendarYear,
      String(calendarMonthIndex + 1).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-");
  }

  const pendingCount = leaves.filter(
    (leave) => String(leave.status).toUpperCase() === "PENDING"
  ).length;

  const approvedCount = leaves.filter(
    (leave) => String(leave.status).toUpperCase() === "APPROVED"
  ).length;

  return (
    <div className="leave-management">
      <header className="leave-header">
        <div>
          <h1>Leave Management</h1>
          <p>Manage leave applications and track request status.</p>
        </div>
      </header>

      <div className="leave-stats">
        <div className="leave-stat-card">
          <span className="stat-label">Total Requests</span>
          <span className="stat-value">{leaves.length}</span>
        </div>

        <div className="leave-stat-card">
          <span className="stat-label">Pending Requests</span>
          <span className="stat-value">{pendingCount}</span>
        </div>

        <div className="leave-stat-card">
          <span className="stat-label">Approved Requests</span>
          <span className="stat-value">{approvedCount}</span>
        </div>
      </div>

      {!canDecide && (
        <form className="leave-form" onSubmit={applyLeave}>
          <h2>Apply for Leave</h2>

          <div className="leave-form-grid">
            <div className="form-group">
              <label htmlFor="leave-type">Leave Type</label>
              <select
                id="leave-type"
                value={leaveType}
                onChange={(event) => setLeaveType(event.target.value)}
                disabled={busy}
              >
                <option value="CASUAL">Casual Leave</option>
                <option value="SICK">Sick Leave</option>
                <option value="ANNUAL">Annual Leave</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="leave-start">Start Date</label>
              <input
                id="leave-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
                disabled={busy}
              />
            </div>

            <div className="form-group">
              <label htmlFor="leave-end">End Date</label>
              <input
                id="leave-end"
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
                disabled={busy}
              />
            </div>

            <div className="form-group form-full-width">
              <label htmlFor="leave-reason">Reason</label>
              <textarea
                id="leave-reason"
                placeholder="Enter the reason for your leave..."
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                disabled={busy}
                rows={3}
              />
            </div>

            <div className="form-full-width">
              <button type="submit" disabled={busy}>
                {busy ? "Please wait..." : "Submit Leave Request"}
              </button>
            </div>
          </div>
        </form>
      )}

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}
      

<section className="leave-calendar-section">
  <div className="calendar-header">
    <h2>Leave Calendar</h2>

    <div className="calendar-navigation">
      <button
        type="button"
        onClick={() => changeCalendarMonth(-1)}
      >
        Previous
      </button>

      <h3>{monthLabel}</h3>

      <button
        type="button"
        onClick={() => changeCalendarMonth(1)}
      >
        Next
      </button>
    </div>
  </div>

  <div className="calendar-grid">
    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
      (weekday) => (
        <div className="calendar-weekday" key={weekday}>
          {weekday}
        </div>
      )
    )}

    {calendarCells.map((day, index) => (
      <div
        className={`calendar-day ${day ? "" : "empty"}`}
        key={day ? `day-${day}` : `empty-${index}`}
      >
        {day && (
          <>
            <span className="calendar-date">{day}</span>

            <div className="calendar-leaves">
              {getLeavesForDay(day).length > 0 && (
                <button
                  type="button"
                  className="calendar-count-button"
                  onClick={() =>
                    setSelectedCalendarDate(makeCalendarDate(day))
                  }
                >
                  {getLeavesForDay(day).length}{" "}
                  {getLeavesForDay(day).length === 1
                    ? "leave"
                    : "leaves"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    ))}
  </div>

  {selectedCalendarDate && (
    <div className="calendar-details">
      <h3>
        Leave details — {formatDate(selectedCalendarDate)}
      </h3>

      {selectedCalendarLeaves.length === 0 ? (
        <p>No leave details available.</p>
      ) : (
        selectedCalendarLeaves.map((leave) => (
          <div className="calendar-detail-row" key={leave.id}>
            <strong>
              {canDecide
                ? `Employee #${leave.employee_id}`
                : leave.leave_type}
            </strong>

            <span>{leave.leave_type}</span>
            <span>{leave.status}</span>

            <span>
              {formatDate(leave.start_date)} –{" "}
              {formatDate(leave.end_date)}
            </span>
          </div>
        ))
      )}

      <button
        type="button"
        className="calendar-close-button"
        onClick={() => setSelectedCalendarDate("")}
      >
        Close details
      </button>
    </div>
  )}
</section>

      <section className="leave-table-section">
        <h2>{canDecide ? "Employee Leave Requests" : "My Leave Requests"}</h2>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                {canDecide && <th>Employee ID</th>}
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Reason</th>
                <th>Status</th>
                {canDecide && <th>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan={canDecide ? 8 : 6} className="empty-state">
                    No leave requests found.
                  </td>
                </tr>
              ) : (
                leaves.map((leave) => {
                  const status = String(
                    leave.status || "PENDING"
                  ).toUpperCase();

                  return (
                    <tr key={leave.id}>
                      <td>{leave.id}</td>

                      {canDecide && <td>{leave.employee_id ?? "—"}</td>}

                      <td>{leave.leave_type || "—"}</td>
                      <td>{formatDate(leave.start_date)}</td>
                      <td>{formatDate(leave.end_date)}</td>
                      <td>{leave.reason || "—"}</td>

                      <td>
                        <span
                          className={`status-badge ${getStatusClass(status)}`}
                        >
                          {status}
                        </span>
                      </td>

                      {canDecide && (
                        <td>
                          {status === "PENDING" ? (
                            <div className="leave-actions">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => decideLeave(leave.id, "APPROVED")}
                              >
                                Approve
                              </button>

                              <button
                                type="button"
                                className="leave-reject-button"
                                disabled={busy}
                                onClick={() => decideLeave(leave.id, "REJECTED")}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
