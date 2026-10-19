
export default function AttendancePage({ token }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Attendance Management</h3>
          <p>Monitor employee attendance and working hours.</p>
        </div>
      </div>

      <div className="empty-state">
        <div className="placeholder-icon">◷</div>
        <strong>Attendance Dashboard</strong>
        <p>
          Attendance records and check-in/check-out
          features will be added next.
        </p>
      </div>
    </section>
  );
}
