
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";
import "./Performance.css";

export default function Performance({ token, user }) {
  const isHRAdmin = ["HR", "ADMIN"].includes(
    String(user?.role || "").toUpperCase()
  );

  const [employeeId, setEmployeeId] = useState("");
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState("4");
  const [reviewPeriod, setReviewPeriod] = useState("2026-Q4");
  const [goals, setGoals] = useState("");
  const [achievements, setAchievements] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query =
        isHRAdmin && employeeId
          ? `?employee_id=${encodeURIComponent(employeeId)}`
          : "";

      const data = await apiRequest(
        `/performance-reviews${query}`,
        {},
        token
      );

      setReviews(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, isHRAdmin, employeeId]);

  useEffect(() => {
    if (token) loadReviews();
  }, [token, loadReviews]);

  async function createReview(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!employeeId || !reviewPeriod.trim()) {
      setError("Employee ID and review period are required.");
      return;
    }

    const params = new URLSearchParams({
      employee_id: employeeId,
      review_period: reviewPeriod.trim(),
      rating,
      goals,
      achievements,
      feedback,
    });

    setLoading(true);

    try {
      const result = await apiRequest(
        `/performance-reviews?${params.toString()}`,
        { method: "POST" },
        token
      );

      setMessage(result.message || "Performance review created successfully.");
      setGoals("");
      setAchievements("");
      setFeedback("");
      await loadReviews();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="performance-page">
      <header className="performance-header">
        <div>
          <h2>Performance Management</h2>
          <p>
            {isHRAdmin
              ? "Create and manage employee performance reviews."
              : "View your performance ratings and feedback."}
          </p>
        </div>

        <button
          type="button"
          onClick={loadReviews}
          disabled={loading}
          className="performance-refresh"
        >
          Refresh
        </button>
      </header>

      {error && <p className="performance-error" role="alert">{error}</p>}
      {message && <p className="performance-success" role="status">{message}</p>}

      {isHRAdmin && (
        <form className="performance-form" onSubmit={createReview}>
          <h3>Create Performance Review</h3>

          <label htmlFor="performance-employee-id">Employee ID</label>
          <input
            id="performance-employee-id"
            type="number"
            min="1"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            required
          />

          <label htmlFor="performance-period">Review Period</label>
          <input
            id="performance-period"
            value={reviewPeriod}
            onChange={(event) => setReviewPeriod(event.target.value)}
            placeholder="2026-Q4"
            required
          />

          <label htmlFor="performance-rating">Rating (1–5)</label>
          <select
            id="performance-rating"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
          >
            <option value="1">1 - Needs Improvement</option>
            <option value="2">2 - Fair</option>
            <option value="3">3 - Good</option>
            <option value="4">4 - Very Good</option>
            <option value="4.5">4.5 - Excellent</option>
            <option value="5">5 - Outstanding</option>
          </select>

          <label htmlFor="performance-goals">Goals</label>
          <textarea
            id="performance-goals"
            value={goals}
            onChange={(event) => setGoals(event.target.value)}
            placeholder="Enter employee goals"
          />

          <label htmlFor="performance-achievements">Achievements</label>
          <textarea
            id="performance-achievements"
            value={achievements}
            onChange={(event) => setAchievements(event.target.value)}
            placeholder="Enter achievements"
          />

          <label htmlFor="performance-feedback">Feedback</label>
          <textarea
            id="performance-feedback"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="Enter review feedback"
          />

          <button type="submit" disabled={loading}>
            {loading ? "Please wait..." : "Save Review"}
          </button>
        </form>
      )}

      {isHRAdmin && (
        <div className="performance-filter">
          <label htmlFor="performance-filter-id">
            Filter by Employee ID (optional)
          </label>
          <input
            id="performance-filter-id"
            type="number"
            min="1"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            placeholder="Leave blank to show all reviews"
          />
          <button type="button" onClick={loadReviews} disabled={loading}>
            Apply Filter
          </button>
        </div>
      )}

      <section className="performance-list">
        <h3>{isHRAdmin ? "Employee Reviews" : "My Performance Reviews"}</h3>

        {loading && <p>Loading reviews...</p>}

        {!loading && reviews.length === 0 && (
          <p>No performance reviews found.</p>
        )}

        <div className="performance-grid">
          {reviews.map((review) => (
            <article className="performance-card" key={review.id}>
              <div className="performance-card-top">
                <h4>{review.review_period}</h4>
                <span className="performance-rating">
                  {review.rating} / 5
                </span>
              </div>

              {isHRAdmin && (
                <p><strong>Employee ID:</strong> {review.employee_id}</p>
              )}

              <p><strong>Goals:</strong> {review.goals || "Not specified"}</p>
              <p>
                <strong>Achievements:</strong>{" "}
                {review.achievements || "Not specified"}
              </p>
              <p>
                <strong>Feedback:</strong> {review.feedback || "No feedback"}
              </p>

              <small>
                {review.created_at
                  ? new Date(review.created_at).toLocaleDateString()
                  : ""}
              </small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
