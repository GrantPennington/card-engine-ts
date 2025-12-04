// src/web/components/CardView.tsx
import React, { useState } from "react";
import type { Card } from "../../core/cards";
import "./CardView.css";

interface CardViewProps {
  card: Card;
  onClick?: () => void; // kept for compatibility, but not used in the click handler now
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  faceDown?: boolean;              // 👈 NEW
  backImageSrc?: string;           // 👈 optional override
}


const getSuitSymbol = (rawSuit: string): string => {
  const map: Record<string, string> = {
    H: "♥",
    D: "♦",
    C: "♣",
    S: "♠",
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠"
  };

  if (["♥", "♦", "♣", "♠"].includes(rawSuit)) return rawSuit;
  return map[rawSuit] ?? rawSuit;
};

const isRedSuit = (s: string) => s === "♥" || s === "♦";

const getRankValue = (rank: string): number => {
  const upper = rank.toUpperCase();
  if (upper === "A") return 1;
  if (upper === "T") return 10;
  if (upper === "J") return 11;
  if (upper === "Q") return 12;
  if (upper === "K") return 13;

  const num = parseInt(upper, 10);
  return Number.isNaN(num) ? 0 : num;
};

type PipSlot =
  | "center"
  | "top-center"
  | "bottom-center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "middle-left"
  | "middle-right"
  | "upper-middle-left"
  | "upper-middle-right"
  | "lower-middle-left"
  | "lower-middle-right";

const getPipSlots = (rankValue: number): PipSlot[] => {
  switch (rankValue) {
    case 1: // Ace
      return ["center"];
    case 2:
      return ["top-center", "bottom-center"];
    case 3:
      return ["top-center", "center", "bottom-center"];
    case 4:
      return ["top-left", "top-right", "bottom-left", "bottom-right"];
    case 5:
      return ["top-left", "top-right", "center", "bottom-left", "bottom-right"];
    case 6:
      return [
        "top-left",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-right"
      ];
    case 7:
      return [
        "top-left",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-right",
        "center"
      ];
    case 8:
      return [
        "top-left",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-right",
        "top-center",
        "bottom-center"
      ];
    case 9:
      return [
        "top-left",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-right",
        "top-center",
        "center",
        "bottom-center"
      ];
    case 10:
      return [
        "top-left",
        "top-right",
        "upper-middle-left",
        "upper-middle-right",
        "lower-middle-left",
        "lower-middle-right",
        "bottom-left",
        "bottom-right",
        "top-center",
        "bottom-center"
      ];
    default:
      return ["center"];
  }
};

export const CardView: React.FC<CardViewProps> = ({
  card,
  draggable,
  onDragStart,
  faceDown,
  backImageSrc = "/cards/card_back_black.png"
}) => {
  const [expanded, setExpanded] = useState(false);

  const suitSymbol = getSuitSymbol(String(card.suit));
  const rankLabel = String(card.rank).toUpperCase();
  const rankValue = getRankValue(rankLabel);
  const isFaceCard = rankValue >= 11; // J/Q/K
  const colorClass = isRedSuit(suitSymbol) ? "card-view--red" : "card-view--black";

  const pipSlots = !isFaceCard ? getPipSlots(rankValue || 1) : [];

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(true);
  };

  const closeExpanded = () => setExpanded(false);

  const cardClasses = `card-view ${colorClass}`;

  if (faceDown) {
    return (
      <div
        className={`${cardClasses} card-view--back`}
        draggable={draggable}
        onDragStart={onDragStart}
      >
        <img
          src={backImageSrc}
          alt="Card back"
          className="card-view-back-image"
        />
      </div>
    );
  }

  const renderCardInner = () => (
    <>
      {/* Top-left corner */}
      <div className="card-corner card-corner--top">
        <span className="card-rank">{rankLabel}</span>
        <span className="card-suit">{suitSymbol}</span>
      </div>

      {/* Pips or face styling */}
      {!isFaceCard ? (
        <div className="card-pips">
          {pipSlots.map((slot, idx) => (
            <span key={idx} className={`card-pip card-pip--${slot}`}>
              {suitSymbol}
            </span>
          ))}
        </div>
      ) : (
        <div className="card-face card-face--face-card">
          <span className="card-face-rank">{rankLabel}</span>
          <span className="card-face-suit">{suitSymbol}</span>
        </div>
      )}

      {/* Bottom-right corner (rotated) */}
      <div className="card-corner card-corner--bottom">
        <span className="card-rank">{rankLabel}</span>
        <span className="card-suit">{suitSymbol}</span>
      </div>
    </>
  );

  return (
    <>
      {/* Small card */}
      <div
        className={cardClasses}
        onClick={handleCardClick}
        draggable={draggable}
        onDragStart={onDragStart} // 👈 new
      >
        {renderCardInner()}
      </div>

      {/* Expanded overlay */}
      {expanded && (
        <div className="card-view-overlay" onClick={closeExpanded}>
          <div
            className={`${cardClasses} card-view--large`}
            onClick={e => e.stopPropagation()}
          >
            {renderCardInner()}
          </div>
        </div>
      )}
    </>
  );
};

// import React from "react";
// import type { Card } from "../../core/cards";
// import "./CardView.css";

// interface CardViewProps {
//   card: Card;
//   onClick?: () => void;
//   draggable?: boolean;
// }

// const getSuitSymbol = (rawSuit: string): string => {
//   // Support a bunch of common suit encodings
//   const map: Record<string, string> = {
//     H: "♥",
//     D: "♦",
//     C: "♣",
//     S: "♠",
//     hearts: "♥",
//     diamonds: "♦",
//     clubs: "♣",
//     spades: "♠"
//   };

//   if (["♥", "♦", "♣", "♠"].includes(rawSuit)) return rawSuit;
//   return map[rawSuit] ?? rawSuit;
// };

// const isRedSuit = (suitSymbol: string) => suitSymbol === "♥" || suitSymbol === "♦";

// export const CardView: React.FC<CardViewProps> = ({ card, onClick, draggable }) => {
//   const suitSymbol = getSuitSymbol(String(card.suit));
//   const rankLabel = String(card.rank);
//   const colorClass = isRedSuit(suitSymbol) ? "card-view--red" : "card-view--black";

//   return (
//     <div
//       className={`card-view ${colorClass}`}
//       onClick={onClick}
//       draggable={draggable}
//     >
//       {/* Top-left corner */}
//       <div className="card-corner card-corner--top">
//         <span className="card-rank">{rankLabel}</span>
//         <span className="card-suit">{suitSymbol}</span>
//       </div>

//       {/* Center pip / icon */}
//       <div className="card-face">
//         {suitSymbol}
//       </div>

//       {/* Bottom-right corner (rotated) */}
//       <div className="card-corner card-corner--bottom">
//         <span className="card-rank">{rankLabel}</span>
//         <span className="card-suit">{suitSymbol}</span>
//       </div>
//     </div>
//   );
// };

