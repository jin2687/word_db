import { useEffect, useState } from "react";
import { checkHealth, HealthStatus } from "../api/client";
import "./StatusBar.css";

export default function StatusBar() {
  const [status, setStatus] = useState<HealthStatus | null>(null);

  const refresh = async () => {
    const s = await checkHealth();
    setStatus(s);
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!status) return null;

  const allOk = status.api && status.ollama && status.anki;

  return (
    <div className={`status-bar ${allOk ? "ok" : "warn"}`}>
      <span className={`dot ${status.api ? "green" : "red"}`} /> API
      <span className={`dot ${status.ollama ? "green" : "red"}`} /> Ollama
      <span className={`dot ${status.anki ? "green" : "red"}`} /> Anki
      <button className="refresh-btn" onClick={refresh}>
        Re-check
      </button>
    </div>
  );
}
