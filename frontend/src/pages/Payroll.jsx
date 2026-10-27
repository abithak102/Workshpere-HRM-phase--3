
import { useEffect, useState } from "react";
import { apiRequest } from "../api";
import "./Payroll.css";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export default function PayrollPage({ token, user }) {
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
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [payslipBusy, setPayslipBusy] = useState(false);

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
    if (token) {
      loadPayroll();
    }
    // Load records when the logged-in token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function generatePayroll(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!employeeId || !month || basicSalary === "") {
      setError("Please enter employee ID, month, and basic salary.");
      return;
    }

    const payload = {
      employee_id: Number(employeeId),
      month,
      basic_salary: Number(basicSalary),
      allowances: Number(allowances) || 0,
      bonus: Number(bonus) || 0,
      deductions: Number(deductions) || 0,
    };

    if (
      Object.values(payload).some(
        (value) => typeof value === "number" && !Number.isFinite(value)
      ) ||
      payload.basic_salary < 0 ||
      payload.allowances < 0 ||
      payload.bonus < 0 ||
      payload.deductions < 0
    ) {
      setError("Please enter valid, non-negative salary amounts.");
      return;
    }

    setBusy(true);

    try {
      await apiRequest(
        "/payroll",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        token
      );

      setMessage("Payroll record created successfully.");
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

  async function viewPayslip(record) {
    setError("");
    setMessage("");
    setPayslipBusy(true);

    try {
      const result = await apiRequest(
        `/payroll/${record.id}/payslip`,
        {},
        token
      );
      setSelectedPayslip(result);
    } catch (err) {
      setError(err.message || "Unable to load payslip.");
    } finally {
      setPayslipBusy(false);
    }
  }

  function printPayslip() {
    if (!selectedPayslip) return;

    const data = selectedPayslip;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Employee Payslip</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #172033; }
          h1 { color: #047857; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 12px; border: 1px solid #d1d5db; text-align: left; }
          th { background: #ecfdf5; }
          .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>WorkSphere</h1>
        <h2>Employee Payslip</h2>
        <p><strong>Employee:</strong> ${escapeHtml(
          data.employee_name || data.full_name || data.name || "Employee"
        )}</p>
        <p><strong>Employee ID:</strong> ${escapeHtml(
          data.employee_id ?? ""
        )}</p>
        <p><strong>Month:</strong> ${escapeHtml(data.month || "")}</p>
        <table>
          <tr><th>Description</th><th>Amount</th></tr>
          <tr><td>Basic Salary</td><td>${escapeHtml(
            formatMoney(data.basic_salary)
          )}</td></tr>
          <tr><td>Allowances</td><td>${escapeHtml(
            formatMoney(data.allowances)
          )}</td></tr>
          <tr><td>Bonus</td><td>${escapeHtml(
            formatMoney(data.bonus)
          )}</td></tr>
          <tr><td>Deductions</td><td>${escapeHtml(
            formatMoney(data.deductions)
          )}</td></tr>
        </table>
        <p class="total">Net Salary: ${escapeHtml(
          formatMoney(data.net_salary ?? data.net_pay)
        )}</p>
        <script>window.onload = () => window.print();<\/script>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setError("Allow pop-ups in your browser to print the payslip.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  return (
    <section className="panel payroll-page">
      <div className="panel-heading">
        <div>
          <h2>Payroll Management</h2>
          <p>Manage monthly salary records and employee payslips.</p>
        </div>

        <button
          type="button"
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
        <form className="leave-form" onSubmit={generatePayroll}>
          <div className="form-group">
            <label htmlFor="payroll-employee-id">Employee ID</label>
            <input
              id="payroll-employee-id"
              type="number"
              min="1"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="payroll-month">Payroll Month</label>
            <input
              id="payroll-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="payroll-basic">Basic Salary (₹)</label>
            <input
              id="payroll-basic"
              type="number"
              min="0"
              step="0.01"
              value={basicSalary}
              onChange={(event) => setBasicSalary(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="payroll-allowances">Allowances (₹)</label>
            <input
              id="payroll-allowances"
              type="number"
              min="0"
              step="0.01"
              value={allowances}
              onChange={(event) => setAllowances(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="payroll-bonus">Bonus (₹)</label>
            <input
              id="payroll-bonus"
              type="number"
              min="0"
              step="0.01"
              value={bonus}
              onChange={(event) => setBonus(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="payroll-deductions">Deductions (₹)</label>
            <input
              id="payroll-deductions"
              type="number"
              min="0"
              step="0.01"
              value={deductions}
              onChange={(event) => setDeductions(event.target.value)}
            />
          </div>

          <div className="form-group payroll-net-preview">
            <label>Estimated Net Salary</label>
            <strong>{formatMoney(netSalary)}</strong>
          </div>

          <div className="attendance-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={busy}
            >
              {busy ? "Generating..." : "Generate Payroll"}
            </button>
          </div>
        </form>
      )}

      <div className="payroll-history">
        <h3>Payroll History</h3>

        {records.length === 0 ? (
          <p>No payroll records found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Record ID</th>
                  <th>Employee ID</th>
                  <th>Month</th>
                  <th>Basic Salary</th>
                  <th>Net Salary</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.id}</td>
                    <td>{record.employee_id ?? "—"}</td>
                    <td>{record.month ?? "—"}</td>
                    <td>{formatMoney(record.basic_salary)}</td>
                    <td>
                      {formatMoney(
                        record.net_salary ?? record.net_pay
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => viewPayslip(record)}
                        disabled={payslipBusy}
                      >
                        View Payslip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedPayslip && (
        <div className="payslip">
          <div className="panel-heading">
            <h3>Payslip Details</h3>
            <button
              type="button"
              className="primary-button"
              onClick={printPayslip}
            >
              Print / Save as PDF
            </button>
          </div>

          <p>
            <strong>Employee:</strong>{" "}
            {selectedPayslip.employee_name ||
              selectedPayslip.full_name ||
              selectedPayslip.name ||
              `Employee ${selectedPayslip.employee_id ?? ""}`}
          </p>
          <p>
            <strong>Employee ID:</strong>{" "}
            {selectedPayslip.employee_id ?? "—"}
          </p>
          <p>
            <strong>Month:</strong> {selectedPayslip.month ?? "—"}
          </p>

          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <th>Basic Salary</th>
                  <td>{formatMoney(selectedPayslip.basic_salary)}</td>
                </tr>
                <tr>
                  <th>Allowances</th>
                  <td>{formatMoney(selectedPayslip.allowances)}</td>
                </tr>
                <tr>
                  <th>Bonus</th>
                  <td>{formatMoney(selectedPayslip.bonus)}</td>
                </tr>
                <tr>
                  <th>Deductions</th>
                  <td>{formatMoney(selectedPayslip.deductions)}</td>
                </tr>
                <tr>
                  <th>Net Salary</th>
                  <td>
                    <strong>
                      {formatMoney(
                        selectedPayslip.net_salary ??
                          selectedPayslip.net_pay
                      )}
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
