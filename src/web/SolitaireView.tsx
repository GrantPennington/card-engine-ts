// src/web/SolitaireView.tsx
import React, { useEffect, useState } from "react";
import { createDeck, shuffle, Card, Suit } from "../core/cards";
import { CardView } from "./components/CardView";

interface SolitaireCard extends Card {
  id: string;
  faceUp: boolean;
}

interface SolitaireState {
  stock: SolitaireCard[];
  waste: SolitaireCard[];
  tableau: SolitaireCard[][];
  foundations: Record<Suit, SolitaireCard[]>;
  moves: number;
  startedAt: number | null;
  won: boolean;
}

// ----- Helpers -----

const rankOrder: Card["rank"][] = [
  "A", "2", "3", "4", "5", "6", "7",
  "8", "9", "10", "J", "Q", "K"
];

const getRankValue = (rank: Card["rank"]): number => {
  const idx = rankOrder.indexOf(rank);
  return idx === -1 ? 0 : idx + 1;
};

const isRedSuit = (suit: Suit) => suit === "♥" || suit === "♦";

const cloneFoundations = (
  foundations: Record<Suit, SolitaireCard[]>
): Record<Suit, SolitaireCard[]> => ({
  "♠": [...foundations["♠"]],
  "♥": [...foundations["♥"]],
  "♦": [...foundations["♦"]],
  "♣": [...foundations["♣"]]
});

const foundationsOrder: Suit[] = ["♠", "♥", "♦", "♣"];

const makeInitialSolitaireState = (): SolitaireState => {
  const baseDeck = shuffle(createDeck());
  const allCards: SolitaireCard[] = baseDeck.map((c, idx) => ({
    ...c,
    id: `c${idx}`,
    faceUp: false
  }));

  // 7 tableau piles with growing sizes
  const tableau: SolitaireCard[][] = Array.from({ length: 7 }, () => []);

  let index = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      tableau[col].push(allCards[index++]);
    }
  }

  // Flip top card of each tableau pile face up
  for (let col = 0; col < 7; col++) {
    const pile = tableau[col];
    if (pile.length > 0) {
      const topIdx = pile.length - 1;
      pile[topIdx] = { ...pile[topIdx], faceUp: true };
    }
  }

  const stock = allCards.slice(index); // remaining cards, all face down

  const foundations: Record<Suit, SolitaireCard[]> = {
    "♠": [],
    "♥": [],
    "♦": [],
    "♣": []
  };

  return {
    stock,
    waste: [],
    tableau,
    foundations,
    moves: 0,
    startedAt: null,
    won: false
  };
};

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${mm}:${ss}`;
};

const isWin = (state: SolitaireState): boolean => {
  const total = foundationsOrder.reduce(
    (sum, suit) => sum + state.foundations[suit].length,
    0
  );
  return total === 52;
};

const canMoveToFoundation = (
  card: SolitaireCard,
  pile: SolitaireCard[]
): boolean => {
  const cardRank = getRankValue(card.rank);
  const top = pile[pile.length - 1];
  if (!top) {
    // Only Ace on empty foundation
    return cardRank === 1;
  }
  const topRank = getRankValue(top.rank);
  return cardRank === topRank + 1;
};

const canAutoComplete = (state: SolitaireState): boolean => {
  // Heuristic: no stock, no face-down cards anywhere
  if (state.stock.length > 0) return false;
  if (state.waste.some(c => !c.faceUp)) return false;
  if (state.tableau.some(pile => pile.some(c => !c.faceUp))) return false;
  return true;
};

// ----- Drag types -----

type DragSource =
  | { from: "waste"; cardId: string }
  | { from: "tableau"; pileIndex: number; cardId: string };

type DropTarget =
  | { type: "foundation"; suit: Suit }
  | { type: "tableau"; pileIndex: number };

// ----- Component -----

const SolitaireView: React.FC = () => {
  const [state, setState] = useState<SolitaireState>(() =>
    makeInitialSolitaireState()
  );

  const [elapsedMs, setElapsedMs] = useState(0);
  const [drawMode, setDrawMode] = useState<1 | 3>(1); // Draw 1 or 3

  const stockBackCard: Card = { rank: "A", suit: "♠" }; // rank/suit not used when faceDown

  // Timer effect
  useEffect(() => {
    if (state.startedAt == null || state.won) {
      return;
    }
    // Sync immediately
    setElapsedMs(Date.now() - state.startedAt);

    const id = setInterval(() => {
      setElapsedMs(Date.now() - (state.startedAt as number));
    }, 1000);

    return () => clearInterval(id);
  }, [state.startedAt, state.won]);

  const handleReset = () => {
    setState(makeInitialSolitaireState());
    setElapsedMs(0);
  };

  const handleDrawFromStock = () => {
    setState(prev => {
      if (prev.won) return prev;

      let changed = false;
      const next: SolitaireState = {
        stock: [...prev.stock],
        waste: [...prev.waste],
        tableau: prev.tableau.map(p => [...p]),
        foundations: cloneFoundations(prev.foundations),
        moves: prev.moves,
        startedAt: prev.startedAt,
        won: prev.won
      };

      if (next.stock.length > 0) {
        const count = Math.min(drawMode, next.stock.length);
        for (let i = 0; i < count; i++) {
          const card = next.stock.pop();
          if (!card) break;
          const faceUpCard: SolitaireCard = { ...card, faceUp: true };
          next.waste.push(faceUpCard);
        }
        changed = true;
      } else if (next.waste.length > 0) {
        const recycled = [...next.waste]
          .reverse()
          .map(c => ({ ...c, faceUp: false }));
        next.stock = recycled;
        next.waste = [];
        changed = true;
      }

      if (!changed) return prev;

      const now = Date.now();
      if (next.startedAt == null) next.startedAt = now;
      next.moves = prev.moves + 1;
      next.won = isWin(next);
      return next;
    });
  };

  const moveCards = (source: DragSource, target: DropTarget) => {
    setState(prev => {
      if (prev.won) return prev;

      const next: SolitaireState = {
        stock: [...prev.stock],
        waste: [...prev.waste],
        tableau: prev.tableau.map(pile => [...pile]),
        foundations: cloneFoundations(prev.foundations),
        moves: prev.moves,
        startedAt: prev.startedAt,
        won: prev.won
      };

      let movingCards: SolitaireCard[] = [];

      // Extract from source
      if (source.from === "waste") {
        const waste = next.waste;
        const idx = waste.findIndex(c => c.id === source.cardId);
        if (idx === -1 || idx !== waste.length - 1) {
          // only top card allowed
          return prev;
        }
        const [card] = waste.splice(idx, 1);
        movingCards = [card];
      } else {
        const pile = next.tableau[source.pileIndex];
        if (!pile) return prev;
        const idx = pile.findIndex(c => c.id === source.cardId);
        if (idx === -1) return prev;
        if (!pile[idx].faceUp) return prev;

        movingCards = pile.slice(idx);
        next.tableau[source.pileIndex] = pile.slice(0, idx);

        // Flip new top if needed
        const remaining = next.tableau[source.pileIndex];
        if (remaining.length > 0) {
          const topIdx = remaining.length - 1;
          const topCard = remaining[topIdx];
          if (!topCard.faceUp) {
            remaining[topIdx] = { ...topCard, faceUp: true };
          }
        }
      }

      if (movingCards.length === 0) return prev;
      const firstCard = movingCards[0];

      // Handle drop target
      if (target.type === "foundation") {
        // Single-card only
        if (movingCards.length !== 1) return prev;
        if (firstCard.suit !== target.suit) return prev;

        const pile = next.foundations[target.suit];
        if (!canMoveToFoundation(firstCard, pile)) return prev;

        pile.push(firstCard);
      } else {
        const destPile = next.tableau[target.pileIndex];
        if (!destPile) return prev;

        const cardRank = getRankValue(firstCard.rank);
        const cardRed = isRedSuit(firstCard.suit as Suit);

        if (destPile.length === 0) {
          // only King on empty
          if (cardRank !== 13) return prev;
        } else {
          const top = destPile[destPile.length - 1];
          const topRank = getRankValue(top.rank);
          const topRed = isRedSuit(top.suit as Suit);
          if (cardRed === topRed) return prev;
          if (cardRank !== topRank - 1) return prev;
        }

        destPile.push(...movingCards);
      }

      // Valid move
      const now = Date.now();
      if (next.startedAt == null) next.startedAt = now;
      next.moves = prev.moves + 1;
      next.won = isWin(next);
      return next;
    });
  };

  const handleDragStartFromWaste = (cardId: string) =>
    (e: React.DragEvent<HTMLDivElement>) => {
      const payload: DragSource = { from: "waste", cardId };
      e.dataTransfer.setData("text/plain", JSON.stringify(payload));
      e.dataTransfer.effectAllowed = "move";
    };

  const handleDragStartFromTableau = (pileIndex: number, cardId: string) =>
    (e: React.DragEvent<HTMLDivElement>) => {
      const payload: DragSource = { from: "tableau", pileIndex, cardId };
      e.dataTransfer.setData("text/plain", JSON.stringify(payload));
      e.dataTransfer.effectAllowed = "move";
    };

  const handleDropOnFoundation = (suit: Suit) =>
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.dataTransfer.getData("text/plain");
      if (!text) return;
      try {
        const source = JSON.parse(text) as DragSource;
        moveCards(source, { type: "foundation", suit });
      } catch {
        // ignore
      }
    };

  const handleDropOnTableau = (pileIndex: number) =>
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.dataTransfer.getData("text/plain");
      if (!text) return;
      try {
        const source = JSON.parse(text) as DragSource;
        moveCards(source, { type: "tableau", pileIndex });
      } catch {
        // ignore
      }
    };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleAutoComplete = () => {
    setState(prev => {
      if (!canAutoComplete(prev) || prev.won) return prev;

      let next: SolitaireState = {
        stock: [...prev.stock],
        waste: [...prev.waste],
        tableau: prev.tableau.map(p => [...p]),
        foundations: cloneFoundations(prev.foundations),
        moves: prev.moves,
        startedAt: prev.startedAt ?? Date.now(),
        won: prev.won
      };

      let movesAdded = 0;

      // Keep moving top visible cards to foundations while possible
      while (true) {
        let moved = false;

        // 1. Try from waste
        const wasteTop = next.waste[next.waste.length - 1];
        if (wasteTop) {
          const pile = next.foundations[wasteTop.suit];
          if (canMoveToFoundation(wasteTop, pile)) {
            next.waste.pop();
            pile.push(wasteTop);
            movesAdded++;
            moved = true;
          }
        }

        // 2. Try from tableau
        if (!moved) {
          for (let i = 0; i < next.tableau.length; i++) {
            const pile = next.tableau[i];
            if (pile.length === 0) continue;
            const topCard = pile[pile.length - 1];
            if (!topCard.faceUp) continue;

            const f = next.foundations[topCard.suit];
            if (canMoveToFoundation(topCard, f)) {
              pile.pop();
              f.push(topCard);
              movesAdded++;
              moved = true;

              // Flip new top card if needed
              if (pile.length > 0) {
                const newTop = pile[pile.length - 1];
                if (!newTop.faceUp) {
                  pile[pile.length - 1] = { ...newTop, faceUp: true };
                }
              }

              break; // restart search from beginning
            }
          }
        }

        if (!moved) break;
      }

      if (movesAdded === 0) return prev;
      next.moves += movesAdded;
      next.won = isWin(next);

      return next;
    });
  };

  const autoCompleteAvailable = canAutoComplete(state) && !state.won;

  const topWaste = state.waste[state.waste.length - 1] ?? null;

  return (
    <section
      style={{
        padding: "1rem",
        borderRadius: 8,
        background: "#151a2c"
      }}
    >
      {/* Controls & stats */}
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
          Solitaire: click the stock to draw; drag cards between tableau and foundations.
        </span>

        <button
          onClick={handleDrawFromStock}
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
          Draw / Recycle
        </button>

        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            onClick={() => setDrawMode(1)}
            style={{
              padding: "0.3rem 0.6rem",
              borderRadius: 6,
              border: "none",
              background: drawMode === 1 ? "#2b6cb0" : "#1a202c",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: 13
            }}
          >
            Draw 1
          </button>
          <button
            onClick={() => setDrawMode(3)}
            style={{
              padding: "0.3rem 0.6rem",
              borderRadius: 6,
              border: "none",
              background: drawMode === 3 ? "#2b6cb0" : "#1a202c",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: 13
            }}
          >
            Draw 3
          </button>
        </div>

        <button
          onClick={handleAutoComplete}
          disabled={!autoCompleteAvailable}
          style={{
            padding: "0.35rem 0.7rem",
            borderRadius: 6,
            border: "none",
            background: autoCompleteAvailable ? "#48bb78" : "#22543d",
            color: "#f7fafc",
            cursor: autoCompleteAvailable ? "pointer" : "not-allowed",
            fontSize: 14
          }}
        >
          Auto-complete
        </button>

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
          New Game
        </button>

        <div style={{ marginLeft: "auto", display: "flex", gap: "1rem" }}>
          <span style={{ fontSize: 14, color: "#e2e8f0" }}>
            Moves: <strong>{state.moves}</strong>
          </span>
          <span style={{ fontSize: 14, color: "#e2e8f0" }}>
            Time: <strong>{formatTime(elapsedMs)}</strong>
          </span>
          {state.won && (
            <span style={{ fontSize: 14, color: "#68d391" }}>
              🎉 You win!
            </span>
          )}
        </div>
      </div>

      {/* Top row: Stock, Waste, Foundations */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "1rem",
          marginBottom: "1rem"
        }}
      >
        {/* Stock */}
        <div
          style={{
            borderRadius: 8,
            padding: "0.75rem",
            border: "1px solid #4a5568",
            background: "#111827",
            minHeight: 120
          }}
        >
          <div style={{ marginBottom: "0.5rem" }}>
            <div style={{ fontWeight: 600 }}>Stock</div>
            <div style={{ fontSize: 12, color: "#a0aec0" }}>
              {state.stock.length} card{state.stock.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div onClick={handleDrawFromStock} style={{ cursor: "pointer" }}>
            {state.stock.length > 0 ? (
              <CardView card={stockBackCard} faceDown />
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

        {/* Waste */}
        <div
          style={{
            borderRadius: 8,
            padding: "0.75rem",
            border: "1px solid #4a5568",
            background: "#111827",
            minHeight: 120
          }}
        >
          <div style={{ marginBottom: "0.5rem" }}>
            <div style={{ fontWeight: 600 }}>Waste</div>
            <div style={{ fontSize: 12, color: "#a0aec0" }}>
              {state.waste.length} card{state.waste.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div>
            {!topWaste ? (
              <div
                style={{
                  width: 80,
                  height: 120,
                  borderRadius: 8,
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
            ) : (
              <CardView
                card={topWaste}
                draggable={true}
                onDragStart={handleDragStartFromWaste(topWaste.id)}
              />
            )}
          </div>
        </div>

        {/* Foundations (4 suits) */}
        <div
          style={{
            gridColumn: "span 2",
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "0.75rem"
          }}
        >
          {foundationsOrder.map(suit => {
            const pile = state.foundations[suit];
            const topCard = pile[pile.length - 1];
            return (
              <div
                key={suit}
                onDrop={handleDropOnFoundation(suit)}
                onDragOver={handleDragOver}
                style={{
                  borderRadius: 8,
                  padding: "0.5rem",
                  border: "1px dashed #4a5568",
                  background: "#111827",
                  minHeight: 120
                }}
              >
                <div style={{ marginBottom: "0.5rem" }}>
                  <div style={{ fontWeight: 600 }}>Foundation {suit}</div>
                  <div style={{ fontSize: 12, color: "#a0aec0" }}>
                    {pile.length} card{pile.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div>
                  {topCard ? (
                    <CardView card={topCard} draggable={false} />
                  ) : (
                    <div
                      style={{
                        width: 80,
                        height: 120,
                        borderRadius: 8,
                        border: "1px dashed #4a5568",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: "#4a5568"
                      }}
                    >
                      Drop A, 2, 3...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tableau row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "0.5rem",
          marginTop: "1rem"
        }}
      >
        {state.tableau.map((pile, pileIndex) => (
          <div
            key={pileIndex}
            onDrop={handleDropOnTableau(pileIndex)}
            onDragOver={handleDragOver}
            style={{
              borderRadius: 8,
              padding: "0.5rem",
              border: "1px dashed #4a5568",
              background: "#111827",
              minHeight: 160,
              position: "relative"
            }}
          >
            <div
              style={{
                marginBottom: "0.25rem",
                fontSize: 12,
                color: "#a0aec0"
              }}
            >
              Pile {pileIndex + 1}
            </div>
            <div style={{ position: "relative", minHeight: 120 }}>
              {pile.length === 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 60,
                    height: 90,
                    borderRadius: 8,
                    border: "1px dashed #4a5568",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "#4a5568"
                  }}
                >
                  Drop K here
                </div>
              )}
              {pile.map((card, idx) => {
                const yOffset = idx * 18;
                const isFaceUp = card.faceUp;

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
                    {isFaceUp ? (
                      <CardView
                        card={card}
                        draggable={true}
                        onDragStart={handleDragStartFromTableau(
                          pileIndex,
                          card.id
                        )}
                      />
                    ) : (
                      // <div
                      //   style={{
                      //     width: 80,
                      //     height: 120,
                      //     borderRadius: 8,
                      //     border: "1px solid #4a5568",
                      //     background: "#2d3748"
                      //   }}
                      // />
                      <CardView card={card} faceDown />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SolitaireView;
