import axios from "axios";

export const endpoints = {
  REGISTER: "/register",
  LOGIN: "/login",
  GOOGLE_AUTH: "/auth/google",
  ME: "/me",
  LOGOUT: "/logout",
  UPDATE_PROFILE: "/me/profile",
  CHANGE_PASSWORD: "/me/password",
  APPLICATIONS: "/applications",
  STATS: "/stats",
  UPLOAD_RESUME: "/upload-resume",
  GENERATE_APPLICATION: "/generate-application",
  GENERATE_EMAIL: "/generate-email",
  SEND_EMAIL: "/send-email",
};

export const instance = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_URL || "http://127.0.0.1:8000/",
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("ai_job_application_token");

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If token expired or invalid, clear token
      const currentToken = localStorage.getItem("ai_job_application_token");
      if (currentToken) {
        localStorage.removeItem("ai_job_application_token");
        window.dispatchEvent(new Event("auth_token_expired"));
      }
    }
    return Promise.reject(error);
  }
);

