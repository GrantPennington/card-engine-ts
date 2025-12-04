// src/web/NertsView.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  initNerts,
  applyNertsAction,
  botStep,
  NertsState,
  NertsPlayerState,
  PlayerId
} from "../core/nerts";
import type { Card } from "../core/cards";
import { CardView } from "./components/CardView";

const HUMAN_ID: PlayerId = "you";

type DragSourceKind = "nerts" | "waste" | "tableau";

interface DragPayload {
  from: DragSourceKind;
  playerId: PlayerId;
  tableauIndex?: number;
  cardId?: string;
}

// simple dummy card for backs if needed
const dummyCard: Card = { rank: "A", suit: "♠" };

const NertsView: React.FC = () => {
  const [state, setState] = useState<NertsState>(() =>
    initNerts({ playerIds: [HUMAN_ID, "bot1", "bot2"] })
  );

  const [botsEnabled, setBotsEnabled] = useState(true);
  const [botIntervalMs, setBotIntervalMs] = useState(220); // slightly slower default
  const [botSkill, setBotSkill] = useState(0.6);           // 0.0–1.0

  // Bot loop: every tick, let each bot maybe take a step based on skill
  useEffect(() => {
    if (!botsEnabled) return;

    const id = setInterval(() => {
      setState(prev => {
        let s = prev;
        if (s.finished) return s;

        for (const p of s.players) {
          if (p.id !== HUMAN_ID) {
            // Skill: chance the bot actually "acts" this tick
            if (Math.random() > botSkill) {
              continue;
            }
            s = botStep(s, p.id);
          }
        }

        return s;
      });
    }, botIntervalMs);

    return () => clearInterval(id);
  }, [botsEnabled, botIntervalMs, botSkill]);

  const handleNewGame = () => {
    setState(initNerts({ playerIds: [HUMAN_ID, "bot1", "bot2"] }));
  };

  const humanPlayer = useMemo(
    () => state.players.find(p => p.id === HUMAN_ID) ?? null,
    [state.players]
  );
  const botPlayers = useMemo(
    () => state.players.filter(p => p.id !== HUMAN_ID),
    [state.players]
  );

  const handleApplyAction = (action: Parameters<typeof applyNertsAction>[1]) => {
    setState(prev => applyNertsAction(prev, action));
  };

  const handleStockClick = (playerId: PlayerId) => {
    if (playerId !== HUMAN_ID || state.finished) return;
    handleApplyAction({ type: "stock_draw", playerId });
  };

  // ---- Drag helpers ----

  const handleDragStartFromNerts = (playerId: PlayerId) =>
    (e: React.DragEvent<HTMLDivElement>) => {
      if (playerId !== HUMAN_ID || state.finished) {
        e.preventDefault();
        return;
      }
      const payload: DragPayload = { from: "nerts", playerId };
      e.dataTransfer.setData("text/plain", JSON.stringify(payload));
      e.dataTransfer.effectAllowed = "move";
    };

  const handleDragStartFromWaste = (playerId: PlayerId) =>
    (e: React.DragEvent<HTMLDivElement>) => {
      if (playerId !== HUMAN_ID || state.finished) {
        e.preventDefault();
        return;
      }
      const payload: DragPayload = { from: "waste", playerId };
      e.dataTransfer.setData("text/plain", JSON.stringify(payload));
      e.dataTransfer.effectAllowed = "move";
    };

  const handleDragStartFromTableau = (
    playerId: PlayerId,
    tableauIndex: number,
    cardId: string
  ) =>
    (e: React.DragEvent<HTMLDivElement>) => {
      if (playerId !== HUMAN_ID || state.finished) {
        e.preventDefault();
        return;
      }
      const payload: DragPayload = {
        from: "tableau",
        playerId,
        tableauIndex,
        cardId
      };
      e.dataTransfer.setData("text/plain", JSON.stringify(payload));
      e.dataTransfer.effectAllowed = "move";
    };

  const parsePayload = (e: React.DragEvent<HTMLDivElement>): DragPayload | null => {
    const text = e.dataTransfer.getData("text/plain");
    if (!text) return null;
    try {
      return JSON.parse(text) as DragPayload;
    } catch {
      return null;
    }
  };

  const handleDropOnFoundation = (foundationIndex: number) =>
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const payload = parsePayload(e);
      if (!payload) return;
      if (payload.playerId !== HUMAN_ID || state.finished) return;

      switch (payload.from) {
        case "nerts":
          handleApplyAction({
            type: "nerts_to_foundation",
            playerId: HUMAN_ID,
            foundationIndex
          });
          break;
        case "waste":
          handleApplyAction({
            type: "waste_to_foundation",
            playerId: HUMAN_ID,
            foundationIndex
          });
          break;
        case "tableau":
          if (payload.tableauIndex == null) return;
          handleApplyAction({
            type: "tableau_to_foundation",
            playerId: HUMAN_ID,
            fromIndex: payload.tableauIndex,
            foundationIndex
          });
          break;
      }
    };

  const handleDropOnTableau = (destIndex: number) =>
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const payload = parsePayload(e);
      if (!payload) return;
      if (payload.playerId !== HUMAN_ID || state.finished) return;

      switch (payload.from) {
        case "nerts":
          handleApplyAction({
            type: "nerts_to_tableau",
            playerId: HUMAN_ID,
            tableauIndex: destIndex
          });
          break;
        case "waste":
          handleApplyAction({
            type: "waste_to_tableau",
            playerId: HUMAN_ID,
            tableauIndex: destIndex
          });
          break;
        case "tableau":
          if (payload.tableauIndex == null || !payload.cardId) return;
          handleApplyAction({
            type: "tableau_to_tableau",
            playerId: HUMAN_ID,
            fromIndex: payload.tableauIndex,
            toIndex: destIndex,
            cardId: payload.cardId
          });
          break;
      }
    };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const isHumanWinner = state.finished && state.winnerId === HUMAN_ID;

  // ---- Shared rendering helper for players ----

  const renderPlayerPanel = (player: NertsPlayerState, isHuman: boolean) => {
    const topNerts = player.nertsPile[player.nertsPile.length - 1] ?? null;
    const topWaste = player.waste[player.waste.length - 1] ?? null;

    const label =
      player.id === HUMAN_ID
        ? "You"
        : player.id.startsWith("bot")
        ? `Bot ${player.id.slice(3)}`
        : player.id;

    return (
      <div
        style={{
          borderRadius: 8,
          padding: "0.6rem",
          border: isHuman ? "2px solid #ecc94b" : "1px solid #2d3748",
          background: "#111827",
          boxShadow: isHuman
            ? "0 0 10px rgba(236, 201, 75, 0.3)"
            : "none"
        }}
      >
        {/* player header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.4rem"
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 12, color: "#a0aec0" }}>
              Nerts: {player.nertsPile.length} • Stock: {player.stock.length} • Waste:{" "}
              {player.waste.length}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, color: "#e2e8f0" }}>
              Score: <strong>{player.score}</strong>
            </div>
          </div>
        </div>

        {/* player row: Nerts / stock+ waste */}
        <div
          style={{
            display: "flex",
            gap: "0.8rem",
            marginBottom: "0.5rem",
            alignItems: "flex-start",
            flexWrap: "wrap"
          }}
        >
          {/* Nerts pile */}
          <div>
            <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 4 }}>
              Nerts pile
            </div>
            {topNerts ? (
              <div title={`Nerts: ${player.nertsPile.length} cards`}>
                {isHuman ? (
                  <CardView
                    card={topNerts}
                    draggable
                    onDragStart={handleDragStartFromNerts(player.id)}
                  />
                ) : (
                  <CardView card={topNerts} draggable={false} />
                )}
              </div>
            ) : (
              <div
                style={{
                  width: 80,
                  height: 120,
                  borderRadius: 10,
                  border: "1px solid #4a5568",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: "#68d391"
                }}
              >
                Nerts cleared
              </div>
            )}
          </div>

          {/* Stock & waste */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <div>
              <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 4 }}>
                Stock
              </div>
              <div
                onClick={() => (isHuman ? handleStockClick(player.id) : undefined)}
                style={{ cursor: isHuman ? "pointer" : "default" }}
              >
                {player.stock.length > 0 ? (
                  <CardView card={dummyCard} faceDown />
                ) : (
                  <div
                    style={{
                      width: 80,
                      height: 120,
                      borderRadius: 10,
                      border: "1px dashed #4a5568",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      color: "#4a5568"
                    }}
                  >
                    Empty
                  </div>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 4 }}>
                Waste
              </div>
              {topWaste ? (
                isHuman ? (
                  <CardView
                    card={topWaste}
                    draggable
                    onDragStart={handleDragStartFromWaste(player.id)}
                  />
                ) : (
                  <CardView card={topWaste} draggable={false} />
                )
              ) : (
                <div
                  style={{
                    width: 80,
                    height: 120,
                    borderRadius: 10,
                    border: "1px dashed #4a5568",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "#4a5568"
                  }}
                >
                  Empty
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tableau row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "0.45rem"
          }}
        >
          {player.tableau.map((pile, tIdx) => (
            <div
              key={tIdx}
              onDrop={isHuman ? handleDropOnTableau(tIdx) : undefined}
              onDragOver={isHuman ? handleDragOver : undefined}
              style={{
                borderRadius: 8,
                padding: "0.45rem",
                border: "1px dashed #4a5568",
                background: "#1a202c",
                minHeight: 140,
                position: "relative"
              }}
            >
              <div
                style={{
                  marginBottom: "0.2rem",
                  fontSize: 12,
                  color: "#a0aec0"
                }}
              >
                Tableau {tIdx + 1}
              </div>
              <div style={{ position: "relative", minHeight: 120 }}>
                {pile.length === 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: 80,
                      height: 120,
                      borderRadius: 10,
                      border: "1px dashed #4a5568",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      color: "#4a5568"
                    }}
                  >
                    Drop K / Nerts here
                  </div>
                )}
                {pile.map((card, idx) => {
                  const yOffset = idx * 18;
                  return (
                    <div
                      key={card.id}
                      style={{
                        position: "absolute",
                        top: yOffset,
                        left: 0,
                        transition: "top 120ms ease"
                      }}
                    >
                      {card.faceUp ? (
                        <CardView
                          card={card}
                          draggable={isHuman}
                          onDragStart={
                            isHuman
                              ? handleDragStartFromTableau(player.id, tIdx, card.id)
                              : undefined
                          }
                        />
                      ) : (
                        <CardView card={card} faceDown />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <section
      style={{
        padding: "1rem",
        paddingBottom: "2.5rem",
        borderRadius: 8,
        background: "#151a2c"
      }}
    >
      {/* Controls / status */}
      <div
        style={{
          marginBottom: "0.75rem",
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap"
        }}
      >
        <span style={{ color: "#a0aec0", fontSize: 14 }}>
          Nerts: your solitaire vs bots on shared foundations. Drag your cards onto tableau or foundations.
        </span>

        <button
          onClick={handleNewGame}
          style={{
            padding: "0.35rem 0.7rem",
            borderRadius: 6,
            border: "1px solid #4a5568",
            background: "transparent",
            color: "#e2e8f0",
            cursor: "pointer",
            fontSize: 14
          }}
        >
          New Game
        </button>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: 13,
            color: "#e2e8f0"
          }}
        >
          <input
            type="checkbox"
            checked={botsEnabled}
            onChange={e => setBotsEnabled(e.target.checked)}
          />
          Bots running
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: 13,
            color: "#a0aec0"
          }}
        >
          Bot speed (ms)
          <input
            type="number"
            min={80}
            max={1000}
            value={botIntervalMs}
            onChange={e =>
              setBotIntervalMs(Math.max(80, Number(e.target.value) || 220))
            }
            style={{
              width: 80,
              padding: "0.2rem 0.3rem",
              borderRadius: 4,
              border: "1px solid #4a5568",
              background: "#0b1020",
              color: "#f5f5f5"
            }}
          />
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: 13,
            color: "#a0aec0"
          }}
        >
          Bot skill
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(botSkill * 100)}
            onChange={e => setBotSkill(Number(e.target.value) / 100)}
            style={{ width: 120 }}
          />
          <span style={{ minWidth: 32, textAlign: "right" }}>
            {Math.round(botSkill * 100)}%
          </span>
        </label>

        {state.finished && (
          <span style={{ marginLeft: "auto", fontSize: 14 }}>
            {isHumanWinner ? (
              <span style={{ color: "#68d391" }}>
                🎉 You emptied your Nerts pile first!
              </span>
            ) : (
              <span style={{ color: "#fc8181" }}>
                Game over – winner: <strong>{state.winnerId}</strong>
              </span>
            )}
          </span>
        )}
      </div>

      {/* TWO-COLUMN LAYOUT: LEFT = BOARDS, RIGHT = FOUNDATIONS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2.5fr) minmax(260px, 1.4fr)",
          gap: "1rem",
          alignItems: "flex-start"
        }}
      >
        {/* LEFT: your board big + bots in scroll */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            maxHeight: "calc(100vh - 220px)",
            overflowY: "auto",
            paddingRight: "0.4rem"
          }}
        >
          {humanPlayer && renderPlayerPanel(humanPlayer, true)}

          {botPlayers.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "#a0aec0",
                  marginBottom: "0.3rem"
                }}
              >
                Other players
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem"
                }}
              >
                {botPlayers.map(p => (
                  <div key={p.id}>{renderPlayerPanel(p, false)}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: foundations column */}
        <div
          style={{
            borderRadius: 8,
            padding: "0.6rem",
            border: "1px solid #4a5568",
            background: "#111827",
            maxHeight: "calc(100vh - 220px)",
            overflowY: "auto"
          }}
        >
          <div
            style={{
              marginBottom: "0.4rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <div style={{ fontWeight: 600 }}>Shared Foundations</div>
            <div style={{ fontSize: 12, color: "#a0aec0" }}>
              Any Ace can start a pile; suits then build A→K.
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0.6rem"
            }}
          >
            {state.foundations.map((f, idx) => {
              const top = f.cards[f.cards.length - 1];
              const suitLabel = f.suit ?? (top?.suit ?? "–");

              return (
                <div
                  key={idx}
                  onDrop={handleDropOnFoundation(idx)}
                  onDragOver={handleDragOver}
                  style={{
                    borderRadius: 8,
                    padding: "0.45rem",
                    border: "1px dashed #4a5568",
                    background: "#1a202c",
                    minHeight: 130
                  }}
                >
                  <div style={{ marginBottom: "0.3rem" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      Pile {idx + 1} {f.cards.length > 0 ? `(${suitLabel})` : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "#a0aec0" }}>
                      {f.cards.length} card{f.cards.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div>
                    {top ? (
                      <CardView card={top} draggable={false} />
                    ) : (
                      <div
                        style={{
                          width: 80,
                          height: 120,
                          borderRadius: 10,
                          border: "1px dashed #4a5568",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          color: "#4a5568"
                        }}
                      >
                        Drop Ace to start
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default NertsView;