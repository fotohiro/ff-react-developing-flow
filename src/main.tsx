import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./global.css";
import App from "./App";
import PricingProvider from "./components/PricingProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PricingProvider>
      <App />
    </PricingProvider>
  </StrictMode>
);
