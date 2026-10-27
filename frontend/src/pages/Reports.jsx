
import { useEffect, useState } from "react";
import "./Reports.css";

const API_URL = "http://127.0.0.1:8000";

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export default function ReportsPage({ user }) {
  const [summary, setSummary] = useState(null);
  const [payroll, setPayroll] = useState(null);
  const [personal, setPersonal] = useState(null);
  const [month, setMonth] = useState("2026-10");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const role = String(user?.role || "").toUpperCase();
  const isEmployee = role === "EMPLOYEE";
  const isAuthorizedRole = ["ADMIN", "HR"].includes(role);

  async function loadReports(selectedMonth = month) {
    setLoading(true);
    setError("");

    try {
      const token = sessionStorage.getItem("worksphere_token");

      if (!token) {
        throw new Error("Please log in first.");
      }

      if (!isEmployee && !isAuthorizedRole) {
        throw new Error("Your account role could not be verified. Please log in again.");
      }

      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };

      if (isEmployee) {
        const response = await fetch(`${API_URL}/reports/my`, {
          headers,
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(
              "Your employee profile was not found. Please contact HR."
            );
          }
          if (response.status === 401 || response.status === 403) {
            throw new Error("You do not have permission to view these reports.");
          }
          throw new Error("Unable to load your personal reports.");
        }

        const data = await response.json();
        setPersonal(data);
        setSummary(null);
        setPayroll(null);
      } else {
        const [summaryResponse, payrollResponse] = await Promise.all([
          fetch(`${API_URL}/reports/summary`, { headers }),
          fetch(
            `${API_URL}/reports/payroll?month=${encodeURIComponent(selectedMonth)}`,
            { headers }
          ),
        ]);

        if (!summaryResponse.ok || !payrollResponse.ok) {
          if (
            summaryResponse.status === 401 ||
            summaryResponse.status === 403 ||
            payrollResponse.status === 401 ||
            payrollResponse.status === 403
          ) {
            throw new Error("You do not have permission to view HR reports.");
          }
          throw new Error("Unable to load reports. Please try again.");
        }

        const summaryData = await summaryResponse.json();
        const payrollData = await payrollResponse.json();

        setSummary(summaryData);
        setPayroll(payrollData);
        setPersonal(null);
      }
    } catch (err) {
      setError(err.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
    // Load the correct reports when the logged-in role changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  function renderPersonalReports() {
    if (!personal) return null;

    return (
      <>
        <section className="reports-section">
          <h2>My Employee Profile</h2>
          <div className="reports-grid">
            <article className="report-card">
              <span>Employee ID</span>
              <strong>{personal.employee?.id ?? "—"}</strong>
            </article>
            <article className="report-card">
              <span>Full Name</span>
              <strong>{personal.employee?.full_name || "—"}</strong>
            </article>
            <article className="report-card">
              <span>Designation</span>
              <strong>{personal.employee?.designation || "—"}</strong>
            </article>
            <article className="report-card">
              <span>Department</span>
              <strong>{personal.employee?.department || "—"}</strong>
            </article>
          </div>
        </section>

        <section className="reports-section">
          <h2>My Attendance</h2>
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {personal.attendance?.length ? (
                  personal.attendance.map((record) => (
                    <tr key={record.id}>
                      <td>{record.date}</td>
                      <td>{record.check_in || "—"}</td>
                      <td>{record.check_out || "—"}</td>
                      <td>{record.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="reports-empty">
                      No attendance records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="reports-section">
          <h2>My Leave Records</h2>
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {personal.leaves?.length ? (
                  personal.leaves.map((record) => (
                    <tr key={record.id}>
                      <td>{record.leave_type}</td>
                      <td>{record.start_date}</td>
                      <td>{record.end_date}</td>
                      <td>{record.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="reports-empty">
                      No leave records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="reports-section">
          <h2>My Payroll</h2>
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Basic Salary</th>
                  <th>Allowances</th>
                  <th>Deductions</th>
                  <th>Net Salary</th>
                </tr>
              </thead>
              <tbody>
                {personal.payroll?.length ? (
                  personal.payroll.map((record) => (
                    <tr key={record.id}>
                      <td>{record.month}</td>
                      <td>{formatMoney(record.basic_salary)}</td>
                      <td>{formatMoney(record.allowances)}</td>
                      <td>{formatMoney(record.deductions)}</td>
                      <td className="reports-net-salary">
                        {formatMoney(record.net_salary)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="reports-empty">
                      No payroll records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <p className="reports-eyebrow">WORKSPHERE HRMS</p>
          <h1>{isEmployee ? "My Personal Reports" : "Reports & Analytics"}</h1>
          <p>
            {isEmployee
              ? "View your own attendance, leave and payroll information."
              : "Overview of employees, attendance, leaves and payroll."}
          </p>
        </div>

        <button
          className="reports-refresh"
          onClick={() => loadReports(month)}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh Reports"}
        </button>
      </div>

      {error && <div className="reports-error">{error}</div>}

      {loading && !summary && !personal && (
        <p>Loading reports...</p>
      )}

      {!loading && isEmployee && renderPersonalReports()}

      {!isEmployee && summary && (
        <>
          <section className="reports-section">
            <h2>Employee Overview</h2>
            <div className="reports-grid">
              <article className="report-card">
                <span>Total Employees</span>
                <strong>{summary.total_employees ?? 0}</strong>
              </article>
              <article className="report-card">
                <span>Active Employees</span>
                <strong>{summary.active_employees ?? 0}</strong>
              </article>
              <article className="report-card">
                <span>Inactive Employees</span>
                <strong>{summary.inactive_employees ?? 0}</strong>
              </article>
              <article className="report-card">
                <span>Attendance Records</span>
                <strong>{summary.attendance_records ?? 0}</strong>
              </article>
            </div>
          </section>

          <section className="reports-section">
            <h2>Attendance Summary</h2>
            <div className="reports-grid reports-grid-three">
              <article className="report-card report-present">
                <span>Present Records</span>
                <strong>{summary.present_records ?? 0}</strong>
              </article>
              <article className="report-card report-absent">
                <span>Absent Records</span>
                <strong>{summary.absent_records ?? 0}</strong>
              </article>
            </div>
          </section>

          <section className="reports-section">
            <h2>Leave Summary</h2>
            <div className="reports-grid">
              <article className="report-card">
                <span>Pending Leaves</span>
                <strong>{summary.pending_leaves ?? 0}</strong>
              </article>
              <article className="report-card report-present">
                <span>Approved Leaves</span>
                <strong>{summary.approved_leaves ?? 0}</strong>
              </article>
              <article className="report-card report-absent">
                <span>Rejected Leaves</span>
                <strong>{summary.rejected_leaves ?? 0}</strong>
              </article>
            </div>
          </section>

          <section className="reports-section">
            <h2>Payroll Summary</h2>
            <div className="reports-payroll-total">
              <span>Total Payroll — All Months</span>
              <strong>{formatMoney(summary.total_payroll)}</strong>
            </div>

            <div className="reports-payroll-toolbar">
              <label htmlFor="reports-month">Select payroll month</label>
              <input
                id="reports-month"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
              <button onClick={() => loadReports(month)} disabled={loading}>
                View Payroll
              </button>
            </div>

            {payroll && (
              <>
                <div className="reports-payroll-info">
                  <span>Month: {payroll.month}</span>
                  <span>Records: {payroll.record_count}</span>
                  <strong>
                    Monthly Total: {formatMoney(payroll.total_net_salary)}
                  </strong>
                </div>

                <div className="reports-table-wrap">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Payroll ID</th>
                        <th>Employee ID</th>
                        <th>Basic Salary</th>
                        <th>Allowances</th>
                        <th>Deductions</th>
                        <th>Net Salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payroll.records?.length ? (
                        payroll.records.map((record) => (
                          <tr key={record.id}>
                            <td>{record.id}</td>
                            <td>{record.employee_id}</td>
                            <td>{formatMoney(record.basic_salary)}</td>
                            <td>{formatMoney(record.allowances)}</td>
                            <td>{formatMoney(record.deductions)}</td>
                            <td className="reports-net-salary">
                              {formatMoney(record.net_salary)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="reports-empty">
                            No payroll records found for this month.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
