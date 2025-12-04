// src/web/SandboxView.tsx
import React, { useState } from "react";
import { createDeck, shuffle, Card } from "../core/cards";
import { CardView } from "./components/CardView";

type PileKey = "deck" | "tableA" | "tableB" | "discard";

interface SandboxCard extends Card {
  id: string;
}

interface SandboxState {
  piles: Record<PileKey, SandboxCard[]>;
}

const makeInitialSandboxState = (): SandboxState => {
  const baseDeck = shuffle(createDeck());
  const deck: SandboxCard[] = baseDeck.map((c, idx) => ({
    ...c,
    id: `${c.rank}${c.suit}-${idx}`
  }));

  return {
    piles: {
      deck,
      tableA: [],
      tableB: [],
      discard: []
    }
  };
};

const pileLabels: Record<PileKey, string> = {
  deck: "Deck",
  tableA: "Table A",
  tableB: "Table B",
  discard: "Discard"
};

const SandboxView: React.FC = () => {
  const [state, setState] = useState<SandboxState>(() => makeInitialSandboxState());

  const moveCard = (from: PileKey, to: PileKey, cardId: string) => {
    if (from === to) return;

    setState(prev => {
      const next: SandboxState = {
        piles: {
          deck: [...prev.piles.deck],
          tableA: [...prev.piles.tableA],
          tableB: [...prev.piles.tableB],
          discard: [...prev.piles.discard]
        }
      };

      const fromPile = next.piles[from];
      const cardIndex = fromPile.findIndex(c => c.id === cardId);
      if (cardIndex === -1) return prev;

      const [card] = fromPile.splice(cardIndex, 1);
      next.piles[to].push(card);
      return next;
    });
  };

  const handleDragStart = (pile: PileKey, cardId: string) =>
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({ from: pile, cardId }));
      e.dataTransfer.effectAllowed = "move";
    };

  const handleDropOnPile = (pile: PileKey) =>
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.dataTransfer.getData("text/plain");
      if (!text) return;
      try {
        const { from, cardId } = JSON.parse(text) as { from: PileKey; cardId: string };
        moveCard(from, pile, cardId);
      } catch {
        // ignore parse errors
      }
    };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleReset = () => {
    setState(makeInitialSandboxState());
  };

  const handleDealToTable = (pile: PileKey) => {
    setState(prev => {
      const deck = [...prev.piles.deck];
      if (deck.length === 0) return prev;

      const card = deck.pop()!;
      const next = {
        piles: {
          deck,
          tableA: [...prev.piles.tableA],
          tableB: [...prev.piles.tableB],
          discard: [...prev.piles.discard]
        }
      } as SandboxState;

      next.piles[pile].push(card);
      return next;
    });
  };

  return (
    <section
      style={{
        padding: "1rem",
        borderRadius: 8,
        background: "#151a2c"
      }}
    >
      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap"
        }}
      >
        <span style={{ color: "#a0aec0", fontSize: 14 }}>
          Tabletop sandbox: drag cards between piles, or deal from the deck.
        </span>
        <button
          onClick={handleReset}
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
          Reset Deck
        </button>
        <button
          onClick={() => handleDealToTable("tableA")}
          style={{
            padding: "0.35rem 0.7rem",
            borderRadius: 6,
            border: "none",
            background: "#4c51bf",
            color: "#f7fafc",
            cursor: "pointer",
            fontSize: 14
          }}
        >
          Deal to Table A
        </button>
        <button
          onClick={() => handleDealToTable("tableB")}
          style={{
            padding: "0.35rem 0.7rem",
            borderRadius: 6,
            border: "none",
            background: "#4c51bf",
            color: "#f7fafc",
            cursor: "pointer",
            fontSize: 14
          }}
        >
          Deal to Table B
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "1rem"
        }}
      >
        {(Object.keys(pileLabels) as PileKey[]).map(pileKey => {
          const cards = state.piles[pileKey];
          const isDeck = pileKey === "deck";

          return (
            <div
              key={pileKey}
              onDrop={handleDropOnPile(pileKey)}
              onDragOver={handleDragOver}
              style={{
                borderRadius: 8,
                padding: "0.75rem",
                border: "1px dashed #4a5568",
                background: "#111827",
                minHeight: 140,
                display: "flex",
                flexDirection: "column"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                  alignItems: "center"
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{pileLabels[pileKey]}</div>
                  <div style={{ fontSize: 12, color: "#a0aec0" }}>
                    {cards.length} card{cards.length !== 1 ? "s" : ""}
                  </div>
                </div>
                {isDeck && (
                  <div style={{ fontSize: 12, color: "#a0aec0" }}>
                    Drag from here or use deal buttons.
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.35rem"
                }}
              >
                {cards.map(card => (
                    <CardView
                        key={card.id}
                        card={card}
                        draggable={true}
                        onDragStart={handleDragStart(pileKey, card.id)}
                    />
                ))}

                {cards.length === 0 && (
                  <div style={{ fontSize: 12, color: "#4a5568" }}>
                    Drop cards here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default SandboxView;