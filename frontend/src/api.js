const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

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
