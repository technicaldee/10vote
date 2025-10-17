
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AppProviders } from "./lib/wallet";

createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <App />
  </AppProviders>
);
  