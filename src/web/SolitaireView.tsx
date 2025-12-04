// src/web/SolitaireView.tsx
import React, { useState } from "react";
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
}

// Rank helpers
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
    foundations
  };
};

type DragSource =
  | { from: "waste"; cardId: string }
  | { from: "tableau"; pileIndex: number; cardId: string };

type DropTarget =
  | { type: "foundation"; suit: Suit }
  | { type: "tableau"; pileIndex: number };

const SolitaireView: React.FC = () => {
  const [state, setState] = useState<SolitaireState>(() =>
    makeInitialSolitaireState()
  );

  const handleReset = () => {
    setState(makeInitialSolitaireState());
  };

  const handleDrawFromStock = () => {
    setState(prev => {
      // If stock has cards, draw one to waste
      if (prev.stock.length > 0) {
        const stock = [...prev.stock];
        const waste = [...prev.waste];
        const card = stock.pop();
        if (!card) return prev;

        const faceUpCard: SolitaireCard = { ...card, faceUp: true };
        waste.push(faceUpCard);

        return {
          ...prev,
          stock,
          waste
        };
      }

      // If stock empty but waste not, recycle waste into stock (face down)
      if (prev.waste.length > 0) {
        const wasteCopy = [...prev.waste];
        // Reverse waste so the first card dealt remains last in new stock
        const newStock = wasteCopy
          .reverse()
          .map(c => ({ ...c, faceUp: false }));

        return {
          ...prev,
          stock: newStock,
          waste: []
        };
      }

      // Nothing to do
      return prev;
    });
  };

  const moveCards = (source: DragSource, target: DropTarget) => {
    setState(prev => {
      const next: SolitaireState = {
        stock: [...prev.stock],
        waste: [...prev.waste],
        tableau: prev.tableau.map(pile => [...pile]),
        foundations: cloneFoundations(prev.foundations)
      };

      let movingCards: SolitaireCard[] = [];

      // Extract moving cards from source
      if (source.from === "waste") {
        const waste = next.waste;
        const idx = waste.findIndex(c => c.id === source.cardId);
        if (idx === -1 || idx !== waste.length - 1) {
          // Only allow dragging top card of waste
          return prev;
        }
        const [card] = waste.splice(idx, 1);
        movingCards = [card];
      } else if (source.from === "tableau") {
        const pile = next.tableau[source.pileIndex];
        if (!pile) return prev;

        const idx = pile.findIndex(c => c.id === source.cardId);
        if (idx === -1) return prev;

        // Only allow dragging face-up cards (and anything beneath)
        if (!pile[idx].faceUp) return prev;

        movingCards = pile.slice(idx);
        // Remove them from the source pile
        next.tableau[source.pileIndex] = pile.slice(0, idx);

        // If a face-down card is now on top, flip it
        const remaining = next.tableau[source.pileIndex];
        if (remaining.length > 0) {
          const topIdx = remaining.length - 1;
          const topCard = remaining[topIdx];
          if (!topCard.faceUp) {
            remaining[topIdx] = { ...topCard, faceUp: true };
          }
        }
      } else {
        return prev;
      }

      if (movingCards.length === 0) return prev;
      const firstCard = movingCards[0];

      // Handle drop target
      if (target.type === "foundation") {
        // Only allow single card moves to foundation
        if (movingCards.length !== 1) {
          return prev;
        }
        // Must match suit
        if (firstCard.suit !== target.suit) {
          return prev;
        }

        const pile = next.foundations[target.suit];
        const top = pile[pile.length - 1];
        const cardRank = getRankValue(firstCard.rank);

        if (!top) {
          // Only Ace on empty foundation
          if (cardRank !== 1) return prev;
        } else {
          const topRank = getRankValue(top.rank);
          if (cardRank !== topRank + 1) return prev;
        }

        pile.push(firstCard);
        return next;
      }

      if (target.type === "tableau") {
        const destPile = next.tableau[target.pileIndex];
        if (!destPile) return prev;

        const cardRank = getRankValue(firstCard.rank);
        const cardRed = isRedSuit(firstCard.suit as Suit);

        if (destPile.length === 0) {
          // Only King can go on empty tableau
          if (cardRank !== 13) return prev;
        } else {
          const top = destPile[destPile.length - 1];
          const topRank = getRankValue(top.rank);
          const topRed = isRedSuit(top.suit as Suit);

          // Must alternate color and be one lower in rank
          if (cardRed === topRed) return prev;
          if (cardRank !== topRank - 1) return prev;
        }

        destPile.push(...movingCards);
        return next;
      }

      return prev;
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

  const foundationsOrder: Suit[] = ["♠", "♥", "♦", "♣"];

  return (
    <section
      style={{
        padding: "1rem",
        borderRadius: 8,
        background: "#151a2c"
      }}
    >
      {/* Controls */}
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
          Draw / Recycle Stock
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
          <div
            onClick={handleDrawFromStock}
            style={{
              width: 60,
              height: 90,
              borderRadius: 8,
              border: "1px solid #4a5568",
              background:
                state.stock.length > 0 ? "#2d3748" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#a0aec0",
              cursor: "pointer",
              userSelect: "none"
            }}
          >
            {state.stock.length > 0 ? "Deck" : "Empty"}
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
            {state.waste.length === 0 ? (
              <div
                style={{
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
                Empty
              </div>
            ) : (
              <CardView
                card={state.waste[state.waste.length - 1]}
                draggable={true}
                onDragStart={handleDragStartFromWaste(
                  state.waste[state.waste.length - 1].id
                )}
              />
            )}
          </div>
        </div>

        {/* Foundations (2 columns x 2 rows) */}
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
                const yOffset = idx * 24; // vertical overlap
                const isFaceUp = card.faceUp;

                return (
                  <div
                    key={card.id}
                    style={{
                      position: "absolute",
                      top: yOffset,
                      left: 0
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
                      <div
                        style={{
                          width: 60,
                          height: 90,
                          borderRadius: 8,
                          border: "1px solid #4a5568",
                          background: "#2d3748"
                        }}
                      />
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