// frontend/src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";                           // <-- AQUI: ./App (não ./pages/App)
import { CycleProvider } from "./context/CycleContext";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <CycleProvider>
      <App />
    </CycleProvider>
  </React.StrictMode>
);
