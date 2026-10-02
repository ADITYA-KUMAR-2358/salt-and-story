// Apply the reader's saved theme before first paint (no flash). External because the CSP blocks inline scripts.
try {
  var t = localStorage.getItem("salt-and-story:theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch { /* private mode: follow the device */ }
