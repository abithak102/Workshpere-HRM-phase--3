
import { useEffect, useState } from "react";
import { apiRequest } from "../api";
import "./Documents.css";

export default function Documents({ token, user }) {
  const [employeeId, setEmployeeId] = useState("");
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isHRAdmin = ["HR", "ADMIN"].includes(
    String(user?.role || "").toUpperCase()
  );

  useEffect(() => {
    async function loadEmployee() {
      try {
        const employees = await apiRequest("/employees", {}, token);

        const ownEmployee = employees.find(
          (employee) => Number(employee.user_id) === Number(user?.id)
        );

        if (ownEmployee) {
          setEmployeeId(String(ownEmployee.id));
        } else if (isHRAdmin && employees.length > 0) {
          setEmployeeId(String(employees[0].id));
        }
      } catch (err) {
        setError(err.message || "Employee details load cheyyan kazhinjilla.");
      }
    }

    if (token && user) {
      loadEmployee();
    }
  }, [token, user, isHRAdmin]);

  async function loadDocuments() {
    if (!employeeId) {
      setDocuments([]);
      setError("Employee profile kandethiyilla. Employee ID check cheyyuka.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await apiRequest(
        `/documents/employee/${employeeId}`,
        {},
        token
      );

      setDocuments(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || "Documents load cheyyan kazhinjilla.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (employeeId && token) {
      loadDocuments();
    }
  }, [employeeId, token]);

  async function uploadDocument(event) {
    event.preventDefault();

    if (!employeeId || !file) {
      setError("Employee ID-യും file-ഉം select cheyyuka.");
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("PDF, JPG, PNG files mathram upload cheyyam.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File size 5 MB-ൽ താഴെയായിരിക്കണം.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    if (expiryDate) {
      formData.append("expiry_date", expiryDate);
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        `/documents/upload/${employeeId}`,
        {
          method: "POST",
          body: formData,
        },
        token
      );

      setMessage(
        result.expiry_date
          ? `Document uploaded successfully. Expiry date: ${result.expiry_date}`
          : "Document uploaded successfully. Expiry date save aayittundo ennu verify cheyyuka."
      );

      setFile(null);
      setExpiryDate("");

      event.target.reset();

      await loadDocuments();
    } catch (err) {
      setError(err.message || "Document upload cheyyan kazhinjilla.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteDocument(documentId) {
    if (!window.confirm("Do you want to delete this document?")) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        `/documents/${documentId}`,
        { method: "DELETE" },
        token
      );

      setMessage(result.message || "Document deleted successfully.");
      await loadDocuments();
    } catch (err) {
      setError(err.message || "Document delete cheyyan kazhinjilla.");
    } finally {
      setLoading(false);
    }
  }

  function formatSize(bytes) {
    if (bytes == null) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatDate(value) {
    if (!value) return "Not specified";

    // Date-only values should not shift because of timezone conversion.
    const dateOnly = String(value).match(/^\d{4}-\d{2}-\d{2}$/);

    if (dateOnly) {
      const [year, month, day] = value.split("-");
      return `${day}/${month}/${year}`;
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return String(value);
    }

    return parsedDate.toLocaleString();
  }

  return (
    <div className="documents-page">
      <h2>Document Management</h2>
      <p>Upload and manage employee documents.</p>

      {error && (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      )}

      {message && (
        <p role="status" style={{ color: "green" }}>
          {message}
        </p>
      )}

      {isHRAdmin && (
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="document-employee-id">Employee ID</label>
          <input
            id="document-employee-id"
            type="number"
            min="1"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
          />
        </div>
      )}

      <form onSubmit={uploadDocument}>
        <label htmlFor="document-expiry-date">
          Expiry Date (optional)
        </label>

        <input
          id="document-expiry-date"
          type="date"
          value={expiryDate}
          onChange={(event) => setExpiryDate(event.target.value)}
        />

        <label htmlFor="document-file">
          Choose document (PDF, JPG, PNG)
        </label>

        <input
          id="document-file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(event) =>
            setFile(event.target.files?.[0] || null)
          }
          required
        />

        <button
          type="submit"
          disabled={loading || !file || !employeeId}
        >
          {loading ? "Please wait..." : "Upload Document"}
        </button>
      </form>

      <div style={{ marginTop: 24 }}>
        <h3>Documents</h3>

        <button
          type="button"
          onClick={loadDocuments}
          disabled={loading || !employeeId}
        >
          Refresh List
        </button>

        {loading && <p>Loading...</p>}

        {!loading && documents.length === 0 && (
          <p>No documents found.</p>
        )}

        {documents.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Document Name</th>
                  <th>File Name</th>
                  <th>Size</th>
                  <th>Expiry Date</th>
                  <th>Uploaded At</th>
                  {isHRAdmin && <th>Action</th>}
                </tr>
              </thead>

              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.document_name}</td>
                    <td>{doc.original_filename}</td>
                    <td>{formatSize(doc.file_size)}</td>
                    <td>{formatDate(doc.expiry_date)}</td>
                    <td>{formatDate(doc.uploaded_at)}</td>

                    {isHRAdmin && (
                      <td>
                        <button
                          type="button"
                          onClick={() => deleteDocument(doc.id)}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
