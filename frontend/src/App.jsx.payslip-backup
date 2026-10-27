import { useEffect, useState } from "react";
import { apiRequest } from "./api";
import "./App.css";
import AttendancePage from "./Attendance";
import NotificationsPage from "./pages/Notifications";
const MENU_ITEMS = [
  "Dashboard",
  "Employees",
  "Attendance",
  "Leave Management",
  "Payroll",
  "Notifications",
];

function getEmployeeName(employee) {
  return employee.full_name || employee.name || "Unknown Employee";
}

function getInitials(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString();
}

function formatSalary(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

export default function App() {
  const [token, setToken] = useState(() =>
    sessionStorage.getItem("worksphere_token")
  );

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(token));
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!token) {
      setAuthLoading(false);
      return;
    }

    let cancelled = false;

    async function loadUser() {
      try {
        const currentUser = await apiRequest("/auth/me", {}, token);

        if (!cancelled) {
          setUser(currentUser);
          setAuthError("");
        }
      } catch (error) {
        if (!cancelled) {
          sessionStorage.removeItem("worksphere_token");
          setToken(null);
          setUser(null);
          setAuthError("Session expired. Please sign in again.");
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [token]);

  function handleLogin(loginData) {
    setToken(loginData.access_token);
    setAuthLoading(true);
    setAuthError("");
  }

  function handleLogout() {
    sessionStorage.removeItem("worksphere_token");
    setToken(null);
    setUser(null);
    setAuthError("");
  }

  if (authLoading) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <h2>WorkSphere HRMS</h2>
          <p>Loading your account...</p>
        </div>
      </main>
    );
  }

  if (!token || !user) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        initialError={authError}
      />
    );
  }

  return (
    <Dashboard
      token={token}
      user={user}
      onLogout={handleLogout}
    />
  );
}

function LoginScreen({ onLogin, initialError }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError || "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const form = new URLSearchParams();
      form.set("username", username);
      form.set("password", password);

      const response = await fetch(
        "http://127.0.0.1:8000/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form,
        }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(
          response.status === 401
            ? "Invalid username or password."
            : `Login failed (${response.status}): ${message}`
        );
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new Error("The server did not return an access token.");
      }

      sessionStorage.setItem("worksphere_token", data.access_token);
      onLogin(data);
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="brand-logo">W</div>
        <p className="eyebrow">WORKSPHERE HR MANAGEMENT</p>
        <h1>Welcome back</h1>
        <p>Sign in to manage your workplace.</p>

        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="error-message">{error}</p>}

          <button
            className="primary-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ token, user, onLogout }) {
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [employeeError, setEmployeeError] = useState("");
  const [search, setSearch] = useState("");
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [employeeFormError, setEmployeeFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const canManageEmployees = ["ADMIN", "HR"].includes(
    String(user.role || "").toUpperCase()
  );

  async function loadEmployees() {
    setLoadingEmployees(true);
    setEmployeeError("");

    try {
      const result = await apiRequest("/employees", {}, token);
      setEmployees(Array.isArray(result) ? result : []);
    } catch (error) {
      setEmployeeError(error.message || "Unable to load employees.");
    } finally {
      setLoadingEmployees(false);
    }
  }

  useEffect(() => {
    loadEmployees();
    // Reload when the authenticated account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filteredEmployees = employees.filter((employee) => {
    const query = search.trim().toLowerCase();

    return [
      getEmployeeName(employee),
      employee.department,
      employee.designation,
      employee.status,
      employee.id,
    ].some((value) =>
      String(value ?? "").toLowerCase().includes(query)
    );
  });

  const pageDescriptions = {
    Dashboard: "Here's what's happening across your organization today.",
    Employees: "View and manage your employee directory.",
    Attendance: "Monitor employee attendance and working hours.",
    "Leave Management": "Review employee leave requests.",
    Payroll: "Manage salary and payroll information.",
    Notifications: "View your HR notifications.",
  };

  async function handleAddEmployee(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    const employeeData = {
      full_name: String(data.get("full_name") || "").trim(),
      designation: String(data.get("designation") || "").trim(),
      department: String(data.get("department") || "").trim(),
      joining_date: data.get("joining_date"),
      salary: Number(data.get("salary")),
      status: data.get("status"),
    };

    if (
      !employeeData.full_name ||
      !employeeData.designation ||
      !employeeData.department ||
      !employeeData.joining_date ||
      !Number.isFinite(employeeData.salary) ||
      employeeData.salary < 0
    ) {
      setEmployeeFormError("Please enter valid employee details.");
      return;
    }

    setSavingEmployee(true);
    setEmployeeFormError("");
    setSuccessMessage("");

    try {
      const createdEmployee = await apiRequest(
        "/employees",
        {
          method: "POST",
          body: JSON.stringify(employeeData),
        },
        token
      );

      setEmployees((current) => [createdEmployee, ...current]);
      setShowAddEmployee(false);
      setSuccessMessage("Employee added successfully.");
      setSearch("");
      form.reset();
    } catch (error) {
      setEmployeeFormError(
        error.message || "Unable to add employee."
      );
    } finally {
      setSavingEmployee(false);
    }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">W</div>
          <div>
            <strong>WorkSphere</strong>
            <small>HR Management</small>
          </div>
        </div>

        <p className="sidebar-label">WORKSPACE</p>

        <nav className="sidebar-nav">
          {MENU_ITEMS.map((item, index) => (
            <button
              key={item}
              className={`nav-item ${
                activeMenu === item ? "active" : ""
              }`}
              onClick={() => {
                setActiveMenu(item);
                setSuccessMessage("");
                setShowAddEmployee(false);
              }}
            >
              <span className="nav-icon">
                {["⌂", "♙", "◷", "▤", "₹", "♧"][index]}
              </span>
              <span>{item}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="avatar">
              {getInitials(user.username || "User")}
            </div>
            <div className="user-info">
              <strong>{user.username}</strong>
              <small>{user.role}</small>
            </div>
          </div>

          <button className="nav-item logout-button" onClick={onLogout}>
            <span className="nav-icon">↪</span>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">WORKSPACE / {activeMenu.toUpperCase()}</p>
          </div>

          <div className="topbar-actions">
            <input
              className="global-search"
              aria-label="Search employees"
              placeholder="Search employees..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="avatar top-avatar">
              {getInitials(user.username || "User")}
            </div>
          </div>
        </header>

        <section className="page-content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">WORKSPHERE HR MANAGEMENT</p>
              <h1>{activeMenu === "Dashboard" ? "Welcome back!" : activeMenu}</h1>
              <p className="subtitle">{pageDescriptions[activeMenu]}</p>
            </div>

            {activeMenu === "Employees" && canManageEmployees && (
              <button
                className="primary-button"
                onClick={() => {
                  setShowAddEmployee((value) => !value);
                  setEmployeeFormError("");
                  setSuccessMessage("");
                }}
              >
                {showAddEmployee ? "Cancel" : "+ Add Employee"}
              </button>
            )}
          </div>

          {successMessage && (
            <div className="success-message">{successMessage}</div>
          )}

          {activeMenu === "Employees" && showAddEmployee && (
            <section className="panel info-panel">
              <h3>Add Employee</h3>

              <form onSubmit={handleAddEmployee} className="form-grid">
                <label>
                  Full Name
                  <input
                    name="full_name"
                    minLength={2}
                    maxLength={150}
                    required
                    placeholder="Employee full name"
                  />
                </label>

                <label>
                  Designation
                  <input
                    name="designation"
                    minLength={2}
                    maxLength={100}
                    required
                    placeholder="e.g. Software Developer"
                  />
                </label>

                <label>
                  Department
                  <input
                    name="department"
                    minLength={2}
                    maxLength={100}
                    required
                    placeholder="e.g. IT"
                  />
                </label>

                <label>
                  Joining Date
                  <input name="joining_date" type="date" required />
                </label>

                <label>
                  Salary (INR)
                  <input
                    name="salary"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="e.g. 30000"
                  />
                </label>

                <label>
                  Status
                  <select name="status" defaultValue="ACTIVE">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>

                {employeeFormError && (
                  <div className="error-message">{employeeFormError}</div>
                )}

                <div className="form-actions">
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={savingEmployee}
                  >
                    {savingEmployee ? "Saving..." : "Save Employee"}
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
                    disabled={savingEmployee}
                    onClick={() => {
                      setShowAddEmployee(false);
                      setEmployeeFormError("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeMenu === "Dashboard" && (
            <>
              <div className="stats-grid">
                <StatCard
                  title="Total Employees"
                  value={loadingEmployees ? "..." : employees.length}
                  detail="Employee records"
                  icon="♙"
                  color="purple"
                />
                <StatCard
                  title="Active Employees"
                  value={
                    loadingEmployees
                      ? "..."
                      : employees.filter((item) => item.status === "ACTIVE")
                          .length
                  }
                  detail="Currently active"
                  icon="✓"
                  color="green"
                />
                <StatCard
                  title="Departments"
                  value={
                    loadingEmployees
                      ? "..."
                      : new Set(
                          employees.map((item) => item.department).filter(Boolean)
                        ).size
                  }
                  detail="Across the organization"
                  icon="▦"
                  color="orange"
                />
                <StatCard
                  title="Monthly Payroll"
                  value="—"
                  detail="Payroll integration pending"
                  icon="₹"
                  color="blue"
                />
              </div>

              <div className="content-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Employee Overview</h3>
                      <p>Latest employee records</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setActiveMenu("Employees")}
                    >
                      View all →
                    </button>
                  </div>

                  <EmployeeTable
                    employees={filteredEmployees.slice(0, 5)}
                    loading={loadingEmployees}
                    error={employeeError}
                  />
                </section>

                <section className="panel quick-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Quick Actions</h3>
                      <p>Common HR tasks</p>
                    </div>
                  </div>

                  <button
                    className="quick-action"
                    onClick={() => {
                      setActiveMenu("Employees");
                      setShowAddEmployee(true);
                      setEmployeeFormError("");
                    }}
                    disabled={!canManageEmployees}
                  >
                    <span className="quick-icon">♙</span>
                    <span>
                      <strong>Add Employee</strong>
                      <small>Manage employee records</small>
                    </span>
                    <b>→</b>
                  </button>

                  {["Attendance", "Leave Management", "Payroll"].map((item) => (
                    <button
                      key={item}
                      className="quick-action"
                      onClick={() => setActiveMenu(item)}
                    >
                      <span className="quick-icon">▦</span>
                      <span>
                        <strong>{item}</strong>
                        <small>Open {item.toLowerCase()}</small>
                      </span>
                      <b>→</b>
                    </button>
                  ))}
                </section>
              </div>
            </>
          )}

          {activeMenu === "Employees" && (
            <section className="panel employee-panel">
              <div className="panel-heading">
                <div>
                  <h3>Employee Directory</h3>
                  <p>{filteredEmployees.length} employee record(s)</p>
                </div>

                <button
                  className="secondary-button"
                  onClick={loadEmployees}
                  disabled={loadingEmployees}
                >
                  {loadingEmployees ? "Loading..." : "Refresh"}
                </button>
              </div>

              <EmployeeTable
                employees={filteredEmployees}
                loading={loadingEmployees}
                error={employeeError}
                showSalary
              />
            </section>
          )}

          
          {activeMenu === "Attendance" && (
            <AttendancePage token={token} />
          )}

          {activeMenu === "Leave Management" && (
            <LeaveManagementPage token={token} user={user} />
          )}

          {activeMenu === "Payroll" && (
            <PayrollPage token={token} user={user} />
          )}

          {activeMenu === "Notifications" && (
            <NotificationsPage token={token} />
          )}
</section>
      </main>
    </div>
  );
}

function StatCard({ title, value, detail, icon, color }) {
  return (
    <div className={`stat-card ${color || ""}`}>
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <h2>{value}</h2>
      <div className="stat-bottom">
        <span>{detail}</span>
      </div>
    </div>
  );
}

function EmployeeTable({
  employees,
  loading,
  error,
  showSalary = false,
}) {
  if (loading) {
    return <p className="message">Loading employees...</p>;
  }

  if (error) {
    return (
      <div className="error-message">
        <strong>Unable to load employees</strong>
        <p>{error}</p>
        <p>
          Check that the backend is running and that your account has a valid
          login token.
        </p>
      </div>
    );
  }

  if (!employees.length) {
    return (
      <div className="empty-state">
        <div className="placeholder-icon">♙</div>
        <strong>No employees found</strong>
        <p>Try another search or add an employee if your account has permission.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>EMPLOYEE</th>
            <th>DEPARTMENT</th>
            <th>DESIGNATION</th>
            <th>JOINING DATE</th>
            <th>STATUS</th>
            {showSalary && <th>SALARY</th>}
          </tr>
        </thead>

        <tbody>
          {employees.map((employee) => {
            const name = getEmployeeName(employee);

            return (
              <tr key={employee.id}>
                <td>
                  <div className="employee-cell">
                    <div className="avatar employee-avatar">
                      {getInitials(name)}
                    </div>
                    <div>
                      <strong>{name}</strong>
                      <small>ID: {employee.id}</small>
                    </div>
                  </div>
                </td>
                <td>{employee.department || "—"}</td>
                <td>{employee.designation || "—"}</td>
                <td>{formatDate(employee.joining_date)}</td>
                <td>
                  <span
                    className={`status-badge ${
                      employee.status === "ACTIVE" ? "active" : "inactive"
                    }`}
                  >
                    {employee.status || "UNKNOWN"}
                  </span>
                </td>
                {showSalary && <td>{formatSalary(employee.salary)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function LeaveManagementPage({ token, user }) {
  const [leaves, setLeaves] = useState([]);
  const [leaveType, setLeaveType] = useState("CASUAL");
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canDecide = ["ADMIN", "HR"].includes(
    String(user?.role || "").toUpperCase()
  );

  async function loadLeaves() {
    setError("");

    try {
      const result = await apiRequest("/leaves", {}, token);
      setLeaves(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || "Unable to load leave requests.");
    }
  }
async function loadLeaveBalances() {
  try {
    const result = await apiRequest("/leave-balances", {}, token);
    setLeaveBalances(Array.isArray(result) ? result : []);
  } catch (err) {
    console.error("Leave balance ലഭിച്ചില്ല:", err);
  }
}
  
   useEffect(() => {
  loadLeaves();
  loadLeaveBalances();
}, [token]);
  async function applyLeave(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        "/leaves",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
    setBusy(true);
    setError("");
    setMessage("");

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

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Leave Management</h3>
          <p>Apply for leave and track request status.</p>
        </div>

        <button
          className="secondary-button"
          onClick={loadLeaves}
          disabled={busy}
        >
          Refresh
        </button>
      </div>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="panel">
  <h3>എന്റെ Leave Balance</h3>

  {leaveBalances.length === 0 ? (
    <p>Leave Balance ലഭ്യമല്ല.</p>
  ) : (
    leaveBalances
      .filter((balance) =>
        canDecide ||
        Number(balance.employee_id) === Number(user?.employee_id)
      )
      .map((balance) => (
        <div key={balance.id}>
          <strong>{balance.leave_type}</strong>
          <p>ബാക്കിയുള്ള ദിവസങ്ങൾ: {balance.remaining_days}</p>
        </div>
      ))
  )}
</div>
      {!canDecide && (
        <form onSubmit={applyLeave} className="leave-form">
          <h3>Apply for Leave</h3>

          <div className="form-group">
            <label htmlFor="leave-type">Leave Type</label>
            <select
              id="leave-type"
              value={leaveType}
              onChange={(event) => setLeaveType(event.target.value)}
              required
            >
              <option value="CASUAL">Casual Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="PAID">Paid Leave</option>
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
            />
          </div>

          <div className="form-group">
            <label htmlFor="leave-reason">Reason</label>
            <textarea
              id="leave-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={3}
              maxLength={1000}
              rows={3}
              placeholder="Enter your reason for leave"
              required
            />
          </div>

          <button
            className="primary-button"
            type="submit"
            disabled={busy}
          >
            {busy ? "Please wait..." : "Submit Leave Request"}
          </button>
        </form>
      )}

      <div className="panel-heading">
        <div>
          <h3>{canDecide ? "Employee Leave Requests" : "My Leave History"}</h3>
          <p>{leaves.length} request(s)</p>
        </div>
      </div>

      {leaves.length === 0 ? (
        <p>No leave requests found.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {canDecide && <th>Employee ID</th>}
                <th>Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Reason</th>
                <th>Status</th>
                {canDecide && <th>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {leaves.map((leave) => (
                <tr key={leave.id}>
                  {canDecide && <td>{leave.employee_id}</td>}
                  <td>{leave.leave_type}</td>
                  <td>{String(leave.start_date).slice(0, 10)}</td>
                  <td>{String(leave.end_date).slice(0, 10)}</td>
                  <td>{leave.reason}</td>
                  <td>
                    <span className="status-badge">
                      {leave.status}
                    </span>
                  </td>

                  {canDecide && (
                    <td>
                      {leave.status === "PENDING" ? (
                        <div className="attendance-buttons">
                          <button
                            className="primary-button"
                            disabled={busy}
                            onClick={() =>
                              decideLeave(leave.id, "APPROVED")
                            }
                          >
                            Approve
                          </button>

                          <button
                            className="secondary-button"
                            disabled={busy}
                            onClick={() =>
                              decideLeave(leave.id, "REJECTED")
                            }
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        "Decision completed"
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PayrollPage({ token, user }) {
  const [records, setRecords] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState("2026-10");
  const [basicSalary, setBasicSalary] = useState("");
  const [allowances, setAllowances] = useState("0");
  const [bonus, setBonus] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canManage = ["ADMIN", "HR"].includes(
    String(user?.role || "").toUpperCase()
  );

  const netSalary =
  (Number(basicSalary) || 0) +
  (Number(allowances) || 0) +
  (Number(bonus) || 0) -
  (Number(deductions) || 0);
  async function loadPayroll() {
    setError("");

    try {
      const result = await apiRequest("/payroll", {}, token);
      setRecords(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || "Unable to load payroll records.");
    }
  }

  useEffect(() => {
    loadPayroll();
  }, [token]);

  async function generatePayroll(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        "/payroll",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: Number(employeeId),
            basic_salary: Number(basicSalary),
            allowances: Number(allowances),
            bonus: Number(bonus),
            deductions: Number(deductions),
            month,
          }),
        },
        token
      );

      setMessage(
        `Payroll generated. Net salary: ₹${Number(result.net_salary).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      );

      setEmployeeId("");
      setBasicSalary("");
      setAllowances("0");
      setBonus("0");
      setDeductions("0");

      await loadPayroll();
    } catch (err) {
      setError(err.message || "Unable to generate payroll.");
    } finally {
      setBusy(false);
    }
  }

  function money(value) {
    return `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Payroll Management</h3>
          <p>Generate salaries and review payroll history.</p>
        </div>

        <button
          className="secondary-button"
          onClick={loadPayroll}
          disabled={busy}
        >
          Refresh
        </button>
      </div>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      {canManage && (
        <form onSubmit={generatePayroll} className="leave-form">
          <h3>Generate Payroll</h3>

          <div className="form-group">
            <label htmlFor="pay-employee">Employee ID</label>
            <input
              id="pay-employee"
              type="number"
              min="1"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="pay-month">Payroll Month</label>
            <input
              id="pay-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="pay-basic">Basic Salary (₹)</label>
            <input
              id="pay-basic"
              type="number"
              min="0"
              step="0.01"
              value={basicSalary}
              onChange={(event) => setBasicSalary(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
         
<div className="form-group">
  <label htmlFor="pay-allowances">Allowances (₹)</label>
  <input
    id="pay-allowances"
    type="number"
    min="0"
    step="0.01"
    value={allowances}
    onChange={(event) => setAllowances(event.target.value)}
    required
  />
</div>

            <label htmlFor="pay-bonus">Bonus (₹)</label>
            <input
              id="pay-bonus"
              type="number"
              min="0"
              step="0.01"
              value={bonus}
              onChange={(event) => setBonus(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="pay-deductions">Deductions (₹)</label>
            <input
              id="pay-deductions"
              type="number"
              min="0"
              step="0.01"
              value={deductions}
              onChange={(event) => setDeductions(event.target.value)}
              required
            />
          </div>

          <div className="attendance-actions">
            <div>
              <strong>Calculated Net Salary</strong>
              <h2>{money(netSalary)}</h2>
            </div>
          </div>

          <button
            className="primary-button"
            type="submit"
            disabled={
              busy ||
              !employeeId ||
              !month ||
              basicSalary === "" ||
              netSalary < 0
            }
          >
            {busy ? "Please wait..." : "Generate Payroll"}
          </button>
        </form>
      )}

      <div className="panel-heading">
        <div>
          <h3>Payroll History</h3>
          <p>{records.length} record(s)</p>
        </div>
      </div>

      {records.length === 0 ? (
        <p>No payroll records found.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {canManage && <th>Employee ID</th>}
                <th>Month</th>
                <th>Basic Salary</th>
                <th>Allowances</th>
                <th>Bonus</th>
                <th>Deductions</th>
                <th>Net Salary</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  {canManage && <td>{record.employee_id}</td>}
                  <td>{record.month}</td>
                  <td>{money(record.basic_salary)}</td>
                  <td>{money(record.allowances)}</td>
                  <td>{money(record.bonus)}</td>
                  <td>{money(record.deductions)}</td>
                  <td><strong>{money(record.net_salary)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
