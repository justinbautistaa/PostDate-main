import axios from "axios";

const API_BASE = import.meta.env.DEV ? "http://localhost:5000/api" : "/api";
export const API_ORIGIN = import.meta.env.DEV ? "http://localhost:5000" : "";
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
  headers: { "X-Postdate-Request": "1" },
});
export default api;
api.interceptors.response.use(response => response, error => {
  // MFA verification authenticates a challenge, not the current session.
  // A rejected code must stay in the form so the user can try again.
  if (error?.response?.status === 401 && !/\/auth\/(login|recovery|mfa\/verify)/.test(error.config?.url || "")) {
    window.dispatchEvent(new Event("postdate:session-expired"));
  }
  return Promise.reject(error);
});
