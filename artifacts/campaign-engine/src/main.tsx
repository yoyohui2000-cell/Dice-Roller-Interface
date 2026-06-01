import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
console.log("VITE_API_BASE_URL =", baseUrl);
setBaseUrl(baseUrl);

createRoot(document.getElementById("root")!).render(<App />);
