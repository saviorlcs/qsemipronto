import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import axios from "axios";

axios.defaults.withCredentials = true;
axios.defaults.baseURL =
  (process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000") + "/api";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
