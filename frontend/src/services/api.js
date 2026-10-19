
const API_BASE_URL = "http://127.0.0.1:8000";

export async function apiRequest(path, options = {}, token = null) {
  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : options.body
        ? { "Content-Type": "application/json" }
        : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`API error ${response.status}: ${message}`);
  }

  if (response.status === 204) return null;

  return response.json();
}

export async function login(username, password) {
  const form = new URLSearchParams();
  form.set("username", username);
  form.set("password", password);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error("Login failed. Username/password check cheyyuka.");
  }

  const data = await response.json();

  // Token browser session-il mathram store cheyyunnu.
  sessionStorage.setItem("worksphere_token", data.access_token);

  return data;
}

export async function getEmployees(token) {
  return apiRequest("/employees", {}, token);
}
