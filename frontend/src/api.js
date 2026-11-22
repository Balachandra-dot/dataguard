import axios from "axios";

export const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const errMsg = (e) => {
  const d = e.response?.data?.detail;
  if (typeof d === "string") return d;
  if (e.response) return "Something went wrong. Please try again.";
  return "Could not reach the server. Is the backend running?";
};

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadReport(id, filename) {
  const res = await axios.get(`${API}/analyses/${id}/report`, { responseType: "blob" });
  saveBlob(res.data, `audit_${filename.replace(/\.[^.]+$/, "")}.pdf`);
}