
const API_BASE_URL  = "http://localhost:8001";


async function parseJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Request failed.");
  }
  return data;
}

export async function fetchHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  return parseJson(response);
}

export async function fetchDocuments() {
  const response = await fetch(`${API_BASE_URL}/api/documents`);
  return parseJson(response);
}

export async function uploadDocuments(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
    method: "POST",
    body: formData,
  });

  return parseJson(response);
}

export async function deleteDocument(documentId) {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Unable to delete document.");
  }
}

export async function sendMessage(message) {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  return parseJson(response);
}
// He file chya shevti add kara
export async function loginUser(email, password) { // role सुद्धा ॲड करा
  const response = await fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
  email: email, 
  password: password
}),  // बॅकएंडला 'role' ची पण गरज आहे (Administrator/Student)
    });
 

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Login failed');
  }
  return response.json();
}
export async function createUser(email, password, role, name) {
  const response = await fetch(`${API_BASE_URL}/api/admin/create-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, role, name }),
  });

  return parseJson(response);
}
export async function deleteUser(email) {
  const response = await fetch(`${API_BASE_URL}/api/admin/delete-user/${email}`, {
    method: "DELETE",
  });

  return parseJson(response);
}
export async function getUsers() {
  const res = await fetch(`${API_BASE_URL}/api/admin/users`);
  return parseJson(res);
}