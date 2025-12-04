// src/web/BlackjackView.tsx
import React, { useMemo, useState } from "react";
import {
  BlackjackState,
  BlackjackConfig,
  initBlackjack,
  hit,
  stand,
  nextPlayer,
  handScore,
  isBusted,
  dealerAutoPlay,
  botAutoPlay,
  allNonDealerDone
} from "../core/blackjack";
import { CardView } from "./components/CardView";

// Auto-play bots & dealer until it's a human's turn or the game ends
function advanceNonHumanTurns(state: BlackjackState): BlackjackState {
  let s = state;

  while (!s.finished) {
    // If all non-dealers are done, let dealer resolve
    if (allNonDealerDone(s)) {
      s = dealerAutoPlay(s);
      break;
    }

    const current = s.players[s.currentPlayerIndex];
    if (!current) break;

    // Dealer's turn → auto-play and stop
    if (current.isDealer) {
      s = dealerAutoPlay(s);
      break;
    }

    const done =
      current.busted ||
      current.standing ||
      current.hasTwentyOne ||
      current.isBlackjack;

    // Human
    if (!current.isBot) {
      if (done) {
        s = nextPlayer(s);
        continue;
      }
      break; // human who needs to act
    }

    // Bot
    if (done) {
      s = nextPlayer(s);
      continue;
    }

    s = botAutoPlay(s);
    s = nextPlayer(s);
  }

  return s;
}

const defaultConfig: BlackjackConfig = {
  numHumans: 1,
  numBots: 2,
  humanNames: ["You"],
  botNames: ["Bot 1", "Bot 2"],
  dealerName: "Dealer"
};

const BlackjackView: React.FC = () => {
  const [config, setConfig] = useState<BlackjackConfig>(defaultConfig);

  const [state, setState] = useState<BlackjackState>(() =>
    advanceNonHumanTurns(initBlackjack(config))
  );

  const current = state.players[state.currentPlayerIndex];

  const canAct = useMemo(() => {
    if (!current || state.finished) return false;
    if (current.isDealer || current.isBot) return false;
    if (current.busted || current.standing || current.hasTwentyOne || current.isBlackjack) {
      return false;
    }
    return true;
  }, [current, state.finished]);

  // End-of-round summary
  const endResults = useMemo(() => {
    if (!state.finished) return null;
    if (state.players.length === 0) return null;

    const dealer = state.players[0];
    if (!dealer) return null;

    const dealerScore = isBusted(dealer.hand) ? 0 : handScore(dealer.hand);
    const dealerFlag =
      dealer.isBlackjack ? "BLACKJACK" :
      dealer.hasTwentyOne ? "21" :
      isBusted(dealer.hand) ? "BUST" :
      "";

    const players = state.players.slice(1).map((p, idx) => {
      const score = isBusted(p.hand) ? 0 : handScore(p.hand);
      const flag =
        p.isBlackjack ? "BLACKJACK" :
        p.hasTwentyOne ? "21" :
        isBusted(p.hand) ? "BUST" :
        p.standing ? "STAND" :
        "";

      let result: string;

      if (isBusted(p.hand)) {
        if (isBusted(dealer.hand)) {
          result = "LOSE (both bust – house wins)";
        } else {
          result = "LOSE (bust)";
        }
      } else if (isBusted(dealer.hand)) {
        result = "WIN (dealer bust)";
      } else if (p.isBlackjack && !dealer.isBlackjack) {
        result = "WIN (natural blackjack)";
      } else if (dealer.isBlackjack && !p.isBlackjack) {
        result = "LOSE (dealer blackjack)";
      } else if (score > dealerScore) {
        result = "WIN";
      } else if (score < dealerScore) {
        result = "LOSE";
      } else {
        if (p.hasTwentyOne && !dealer.hasTwentyOne) {
          result = "WIN (21 beats equal score)";
        } else if (dealer.hasTwentyOne && !p.hasTwentyOne) {
          result = "LOSE (dealer 21 beats equal score)";
        } else {
          result = "PUSH";
        }
      }

      const who = p.isBot ? `Bot (${p.id})` : `Player (${p.id})`;

      return {
        label: who,
        seatIndex: idx + 1,
        score,
        flag,
        result
      };
    });

    return {
      dealer: {
        label: config.dealerName ?? "Dealer",
        score: dealerScore,
        flag: dealerFlag
      },
      players
    };
  }, [state, config.dealerName]);

  const handleNewGame = () => {
    setState(advanceNonHumanTurns(initBlackjack(config)));
  };

  const handleConfigChange = (field: "numHumans" | "numBots") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Math.max(0, Number(e.target.value) || 0);
      setConfig(prev => ({
        ...prev,
        [field]: value
      }));
    };

  const applyConfigAndRestart = () => {
    setState(advanceNonHumanTurns(initBlackjack(config)));
  };

  const handleHit = () => {
    if (!canAct || !current) return;
    setState(prev => {
      let s = hit(prev);
      const now = s.players[s.currentPlayerIndex];
      if (now && (now.busted || now.standing || now.hasTwentyOne || now.isBlackjack)) {
        s = nextPlayer(s);
      }
      return advanceNonHumanTurns(s);
    });
  };

  const handleStand = () => {
    if (!canAct || !current) return;
    setState(prev => {
      let s = stand(prev);
      s = nextPlayer(s);
      return advanceNonHumanTurns(s);
    });
  };

  return (
    <>
      {/* Config panel */}
      <section
        style={{
          marginBottom: "1.5rem",
          padding: "1rem",
          borderRadius: 8,
          background: "#151a2c",
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap"
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            Humans
          </label>
          <input
            type="number"
            min={0}
            max={4}
            value={config.numHumans}
            onChange={handleConfigChange("numHumans")}
            style={{
              width: 80,
              padding: "0.3rem 0.4rem",
              borderRadius: 4,
              border: "1px solid #4a5568",
              background: "#0b1020",
              color: "#f5f5f5"
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            Bots
          </label>
          <input
            type="number"
            min={0}
            max={5}
            value={config.numBots ?? 0}
            onChange={handleConfigChange("numBots")}
            style={{
              width: 80,
              padding: "0.3rem 0.4rem",
              borderRadius: 4,
              border: "1px solid #4a5568",
              background: "#0b1020",
              color: "#f5f5f5"
            }}
          />
        </div>

        <button
          onClick={applyConfigAndRestart}
          style={{
            padding: "0.45rem 0.9rem",
            borderRadius: 6,
            border: "none",
            background: "#4c51bf",
            color: "white",
            cursor: "pointer",
            fontWeight: 500
          }}
        >
          Apply & New Game
        </button>

        <button
          onClick={handleNewGame}
          style={{
            padding: "0.45rem 0.9rem",
            borderRadius: 6,
            border: "1px solid #4a5568",
            background: "transparent",
            color: "#e2e8f0",
            cursor: "pointer"
          }}
        >
          New Deal
        </button>
      </section>

      {/* Table */}
      <section
        style={{
          padding: "1rem",
          borderRadius: 8,
          background: "#151a2c"
        }}
      >
        {/* Players */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem"
          }}
        >
          {state.players.map((p, idx) => {
            const score = handScore(p.hand);
            const isCurrent = idx === state.currentPlayerIndex;

            let role: string;
            if (p.isDealer) role = config.dealerName ?? "Dealer";
            else if (p.isBot) role = `Bot (${p.id})`;
            else role = `Player (${p.id})`;

            const flags: string[] = [];
            if (p.isBlackjack) flags.push("BLACKJACK");
            else if (p.hasTwentyOne) flags.push("21");
            if (p.busted) flags.push("BUST");
            else if (p.standing && !p.hasTwentyOne && !p.isBlackjack)
              flags.push("STAND");

            const flagsStr = flags.join(" · ");

            return (
              <div
                key={idx}
                style={{
                  borderRadius: 8,
                  padding: "0.75rem",
                  border: isCurrent
                    ? "2px solid #ecc94b"
                    : "1px solid #2d3748",
                  background: p.isDealer ? "#1a202c" : "#111827",
                  boxShadow: isCurrent
                    ? "0 0 12px rgba(236, 201, 75, 0.5)"
                    : "none"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{role}</div>
                    <div style={{ fontSize: 12, color: "#a0aec0" }}>
                      Seat #{idx}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600 }}>Score: {score}</div>
                    {flagsStr && (
                      <div style={{ fontSize: 12, color: "#f6e05e" }}>
                        {flagsStr}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {p.hand.map((card, i) => (
                    <CardView 
                      id={i}
                      card={card}
                      draggable={true}
                    />
                  ))}
                  {p.hand.length === 0 && (
                    <div style={{ fontSize: 12, color: "#718096" }}>No cards</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action area */}
        <div style={{ marginTop: "1.5rem" }}>
          {!state.finished && current && !current.isDealer && !current.isBot ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                flexWrap: "wrap"
              }}
            >
              <span>
                Your turn:{" "}
                <strong>
                  Player ({current.id})
                </strong>
              </span>
              <button
                onClick={handleHit}
                disabled={!canAct}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: 6,
                  border: "none",
                  background: canAct ? "#48bb78" : "#2f855a",
                  color: "white",
                  cursor: canAct ? "pointer" : "not-allowed"
                }}
              >
                Hit
              </button>
              <button
                onClick={handleStand}
                disabled={!canAct}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: 6,
                  border: "none",
                  background: canAct ? "#e53e3e" : "#742a2a",
                  color: "white",
                  cursor: canAct ? "pointer" : "not-allowed"
                }}
              >
                Stand
              </button>
            </div>
          ) : (
            <div style={{ color: "#a0aec0" }}>
              {state.finished
                ? "Round finished – adjust table settings or deal again."
                : "Waiting for bots/dealer..."}
            </div>
          )}
        </div>

        {/* End game summary */}
        {state.finished && endResults && (
          <div
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem 1rem",
              borderRadius: 8,
              border: "1px solid #4a5568",
              background: "#1a202c"
            }}
          >
            <div style={{ marginBottom: "0.5rem" }}>
              <strong>Round Results</strong>
            </div>

            <div style={{ fontSize: 14, marginBottom: "0.75rem" }}>
              Dealer:{" "}
              <strong>
                {endResults.dealer.label} – {endResults.dealer.score}
              </strong>{" "}
              {endResults.dealer.flag && (
                <span style={{ color: "#f6e05e" }}>
                  {" "}
                  ({endResults.dealer.flag})
                </span>
              )}
            </div>

            <div style={{ fontSize: 14, display: "grid", gap: "0.25rem" }}>
              {endResults.players.map(p => (
                <div key={p.seatIndex}>
                  <strong>{p.label}</strong>{" "}
                  – {p.score}{" "}
                  {p.flag && (
                    <span style={{ color: "#f6e05e" }}>
                      ({p.flag})
                    </span>
                  )}{" "}
                  →{" "}
                  <span
                    style={{
                      color:
                        p.result.startsWith("WIN")
                          ? "#68d391"
                          : p.result.startsWith("LOSE")
                          ? "#fc8181"
                          : "#e2e8f0"
                    }}
                  >
                    {p.result}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
};

export default BlackjackView;