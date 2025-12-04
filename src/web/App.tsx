// src/web/App.tsx
import React, { useState } from "react";
import BlackjackView from "./BlackjackView";
import SandboxView from "./SandboxView";
import SolitaireView from "./SolitaireView";

type Mode = "blackjack" | "sandbox" | "solitaire";

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>("blackjack");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1020",
        color: "#f5f5f5",
        padding: "1.5rem",
        boxSizing: "border-box"
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "2rem" }}>CardEngineTS</h1>
          <p style={{ marginTop: "0.5rem", color: "#a0aec0" }}>
            Shared TypeScript card engine with multiple frontends.
          </p>

          <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setMode("blackjack")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
                background: mode === "blackjack" ? "#4c51bf" : "#1a202c",
                color: "#edf2f7"
              }}
            >
              Blackjack
            </button>
            <button
              onClick={() => setMode("sandbox")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
                background: mode === "sandbox" ? "#4c51bf" : "#1a202c",
                color: "#edf2f7"
              }}
            >
              Tabletop Sandbox
            </button>
            <button
              onClick={() => setMode("solitaire")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
                background: mode === "solitaire" ? "#4c51bf" : "#1a202c",
                color: "#edf2f7"
              }}
            >
              Solitaire
            </button>
          </div>
        </header>

        {mode === "blackjack" ? (
            <BlackjackView />
          ) : mode === "sandbox" ? (
            <SandboxView />
          ) : (
            <SolitaireView />
        )}
      </div>
    </div>
  );
};

export default App;
