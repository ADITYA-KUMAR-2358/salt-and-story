import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/caveat";
import "@fontsource-variable/hanken-grotesk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { CapabilitiesProvider } from "./components/Capabilities";
import { ToastProvider } from "./components/Toast";
import "./index.css";
import { router } from "./router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <CapabilitiesProvider>
        <RouterProvider router={router} />
      </CapabilitiesProvider>
    </ToastProvider>
  </StrictMode>,
);
