import { useEffect } from "preact/hooks";
import { anyTransferInProgress } from "./state";

function App() {
  // Navigation guard to prevent leaving during active transfers
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (anyTransferInProgress.value) {
        // Standard way to show a confirmation dialog before leaving
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
}

export default App;
