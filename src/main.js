import "./styles/app.css";
import { init, registerAppUpdatePrompt, runTests } from "./app/runtime.js";

document.addEventListener("DOMContentLoaded", init);
registerAppUpdatePrompt();

if (location.search.includes("test")) {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(runTests, 100);
  });
}
