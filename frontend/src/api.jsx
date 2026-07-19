import axios from "axios";

export const endpoints = {
  REGISTER: "/register",
  LOGIN: "/login",
  ME: "/me",
  LOGOUT: "/logout",
  UPLOAD_RESUME: "/upload-resume",
  GENERATE_APPLICATION: "/generate-application",
  GENERATE_EMAIL: "/generate-email",
  SEND_EMAIL: "/send-email",
};

export const instance = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_URL,
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("ai_job_application_token");

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
