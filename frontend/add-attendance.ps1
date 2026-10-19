
$ErrorActionPreference = "Stop"

$appPath = Join-Path $PSScriptRoot "src\App.jsx"
$apiPath = Join-Path $PSScriptRoot "src\api.js"

if (!(Test-Path $appPath) -or !(Test-Path $apiPath)) {
    throw "App.jsx or api.js was not found."
}

$app = Get-Content $appPath -Raw
$api = Get-Content $apiPath -Raw

if ($app -notmatch 'function Dashboard\(.*\{') {
    throw "Dashboard function was not found. No changes made."
}

if ($app -match 'function AttendancePage\(') {
    Write-Host "Attendance page already exists. No duplicate added."
    exit 0
}

if ($api -notmatch 'export async function checkIn\(' -or
    $api -notmatch 'export async function checkOut\(') {
    throw "checkIn/checkOut API functions are missing from api.js."
}

$backup = "$appPath.backup-attendance-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item $appPath $backup

# Add attendance page component at the end of App.jsx
$component = @'

function AttendancePage({ token }) {
  const [records, setRecords] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAttendance() {
    setError("");
    try {
      const result = await apiRequest("/attendance", {}, token);
      setRecords(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || "Unable to load attendance.");
    }
  }

  useEffect(() => {
    loadAttendance();
  }, [token]);

  const today = new Date().toLocaleDateString("en-CA");
  const todaysRecord = records.find((item) => {
    const recordDate = String(item.date || "").slice(0, 10);
    return recordDate === today;
  });

  async function submitAttendance(action) {
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const result = await apiRequest(
        action === "in" ? "/attendance/check-in" : "/attendance/check-out",
        { method: "POST" },
        token
      );
      setMessage(result?.message || "Attendance updated successfully.");
      await loadAttendance();
    } catch (err) {
      setError(err.message || "Attendance action failed.");
    } finally {
      setBusy(false);
    }
  }

  function formatTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Attendance</h3>
          <p>Record your working hours</p>
        </div>
        <button className="secondary-button" onClick={loadAttendance} disabled={busy}>
          Refresh
        </button>
      </div>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <div className="attendance-actions">
        <div>
          <strong>Today's status</strong>
          <p>{todaysRecord?.status || "Not checked in"}</p>
          <p>Check-in: {formatTime(todaysRecord?.check_in)}</p>
          <p>Check-out: {formatTime(todaysRecord?.check_out)}</p>
          <p>
            Working hours: {todaysRecord?.working_hours == null
              ? "—"
              : `${todaysRecord.working_hours} hrs`}
          </p>
        </div>

        <div className="attendance-buttons">
          <button
            className="primary-button"
            onClick={() => submitAttendance("in")}
            disabled={busy || Boolean(todaysRecord?.check_in)}
          >
            {busy ? "Please wait..." : "Check In"}
          </button>
          <button
            className="secondary-button"
            onClick={() => submitAttendance("out")}
            disabled={busy || !todaysRecord?.check_in || Boolean(todaysRecord?.check_out)}
          >
            Check Out
          </button>
        </div>
      </div>

      <div className="panel-heading">
        <div>
          <h3>Attendance History</h3>
          <p>{records.length} record(s)</p>
        </div>
      </div>

      {records.length === 0 ? (
        <p>No attendance records found.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{String(record.date || "").slice(0, 10)}</td>
                  <td>{formatTime(record.check_in)}</td>
                  <td>{formatTime(record.check_out)}</td>
                  <td>{record.working_hours == null ? "—" : record.working_hours}</td>
                  <td>{record.status || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
'@

# Replace the existing placeholder block only.
$pattern = '(?s)\{\!?\[?"Dashboard".*'
$placeholder = @'
          {activeMenu === "Attendance" && <AttendancePage token={token} />}

          {!["Dashboard", "Employees", "Attendance"].includes(activeMenu) && (
            <section className="panel section-placeholder">
              <div className="placeholder-icon">□</div>
              <h2>{activeMenu}</h2>
              <p>
                This module's interface is ready for the next integration step.
                Leave management, payroll and notifications need their own API-driven workflows.
              </p>
              <button
                className="primary-button"
                onClick={() => setActiveMenu("Dashboard")}
              >
                ← Back to Dashboard
              </button>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
'@

# Anchor on the exact existing placeholder start, avoiding unrelated sections.
$anchor = '(?s)\{\!?\[?"Dashboard".*'
# Use the known section marker to replace only the existing conditional placeholder.
$marker = '(?s)          \{\!?\["Dashboard", "Employees"\]\.includes\(activeMenu\).*?          \)\}'
if ($app -notmatch $marker) {
    throw "Expected placeholder block not found. Backup saved; source not changed."
}

$replacement = @'
          {activeMenu === "Attendance" && <AttendancePage token={token} />}

          {!["Dashboard", "Employees", "Attendance"].includes(activeMenu) && (
            <section className="panel section-placeholder">
              <div className="placeholder-icon">□</div>
              <h2>{activeMenu}</h2>
              <p>
                This module's interface is ready for the next integration step.
                Leave management, payroll and notifications need their own API-driven workflows.
              </p>
              <button
                className="primary-button"
                onClick={() => setActiveMenu("Dashboard")}
              >
                ← Back to Dashboard
              </button>
            </section>
          )}
'@

$app = [regex]::Replace($app, $marker, $replacement, 1)
$app = $app + "`r`n" + $component + "`r`n"
Set-Content -Path $appPath -Value $app -Encoding UTF8

Write-Host "Attendance page added."
Write-Host "Backup: $backup"
Write-Host "Next run: npm run build"
