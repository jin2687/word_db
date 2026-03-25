import { useState } from "react";
import CaptureRegister from "./components/CaptureRegister";
import Review from "./components/Review";
import StatusBar from "./components/StatusBar";
import "./App.css";

type Tab = "capture" | "review";

export default function App() {
  const [tab, setTab] = useState<Tab>("capture");

  return (
    <div className="app">
      <StatusBar />
      <nav className="tab-bar">
        <button
          className={tab === "capture" ? "tab active" : "tab"}
          onClick={() => setTab("capture")}
        >
          登録
        </button>
        <button
          className={tab === "review" ? "tab active" : "tab"}
          onClick={() => setTab("review")}
        >
          学習
        </button>
      </nav>

      <main className="main">
        {tab === "capture" ? <CaptureRegister /> : <Review />}
      </main>
    </div>
  );
}
