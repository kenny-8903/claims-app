import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — attach tokens, log requests, etc.
client.interceptors.request.use(
  (config) => {
    // Example: attach auth token if available
    // const token = localStorage.getItem('token')
    // if (token) config.headers.Authorization = `Bearer ${token}`
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — handle errors globally (e.g. 401 → redirect to login)
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("Unauthorized — redirecting to login");
      // window.location.href = '/login'
    }
    return Promise.reject(error);
  },
);

export default client;