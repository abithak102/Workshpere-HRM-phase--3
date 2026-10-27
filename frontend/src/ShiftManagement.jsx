
import { useEffect, useState } from "react";
import { apiRequest } from "./api.js";
import "./ShiftManagement.css";

export default function ShiftManagement({ token }) {
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [name, setName] = useState("MORNING");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [employeeId, setEmployeeId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadData() {
    try {
      setError("");
      const [shiftData, employeeData, assignmentData] =
        await Promise.all([
          apiRequest("/shifts", {}, token),
          apiRequest("/employees", {}, token),
          apiRequest("/shifts/assignments", {}, token),
        ]);

      setShifts(Array.isArray(shiftData) ? shiftData : []);
      setEmployees(Array.isArray(employeeData) ? employeeData : []);
      setAssignments(
        Array.isArray(assignmentData) ? assignmentData : [],
      );
    } catch (err) {
      setError(err.message || "Unable to load shift data.");
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  async function createShift(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(
        "/shifts",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            start_time: startTime,
            end_time: endTime,
          }),
        },
        token,
      );

      setMessage("Shift created successfully.");
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to create shift.");
    } finally {
      setBusy(false);
    }
  }

  async function assignShift(event) {
    event.preventDefault();

    if (!employeeId || !shiftId) {
      setError("Select an employee and a shift.");
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(
        `/shifts/assign?employee_id=${encodeURIComponent(employeeId)}&shift_id=${encodeURIComponent(shiftId)}`,
        { method: "POST" },
        token,
      );

      setMessage("Shift assigned successfully.");
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to assign shift.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="shift-management">
      <div className="section-heading">
        <div>
          <h2>Shift Management</h2>
          <p>Create shifts and assign work schedules to employees.</p>
        </div>
        <button type="button" onClick={loadData}>
          Refresh
        </button>
      </div>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <div className="shift-form-grid">
        <form className="leave-form" onSubmit={createShift}>
          <h3>Create Shift</h3>

          <label htmlFor="shift-name">Shift name</label>
          <select
            id="shift-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          >
            <option value="MORNING">Morning</option>
            <option value="EVENING">Evening</option>
            <option value="NIGHT">Night</option>
          </select>

          <label htmlFor="shift-start">Start time</label>
          <input
            id="shift-start"
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            required
          />

          <label htmlFor="shift-end">End time</label>
          <input
            id="shift-end"
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            required
          />

          <button type="submit" disabled={busy}>
            {busy ? "Please wait..." : "Create Shift"}
          </button>
        </form>

        <form className="leave-form" onSubmit={assignShift}>
          <h3>Assign Shift</h3>

          <label htmlFor="shift-employee">Employee</label>
          <select
            id="shift-employee"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            required
          >
            <option value="">Select employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name} (ID: {employee.id})
              </option>
            ))}
          </select>

          <label htmlFor="assigned-shift">Shift</label>
          <select
            id="assigned-shift"
            value={shiftId}
            onChange={(event) => setShiftId(event.target.value)}
            required
          >
            <option value="">Select shift</option>
            {shifts.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.name} ({shift.start_time}–{shift.end_time})
              </option>
            ))}
          </select>

          <button type="submit" disabled={busy}>
            {busy ? "Please wait..." : "Assign Shift"}
          </button>
        </form>
      </div>

      <div className="shift-table-section">
        <h3>Available Shifts</h3>
        {shifts.length === 0 ? (
          <p>No shifts found. Create a shift first.</p>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Shift</th>
                  <th>Start</th>
                  <th>End</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift.id}>
                    <td>{shift.id}</td>
                    <td>{shift.name}</td>
                    <td>{shift.start_time}</td>
                    <td>{shift.end_time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="shift-table-section">
        <h3>Employee Shift Schedule</h3>
        {assignments.length === 0 ? (
          <p>No employee shift assignments found.</p>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Employee</th>
                  <th>Shift</th>
                  <th>Start</th>
                  <th>End</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((item) => (
                  <tr key={item.employee_id}>
                    <td>{item.employee_id}</td>
                    <td>{item.employee_name}</td>
                    <td>{item.shift_name}</td>
                    <td>{item.start_time}</td>
                    <td>{item.end_time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
