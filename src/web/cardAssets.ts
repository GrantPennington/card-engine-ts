// src/web/cardAssets.ts
import type { Card } from "../core/cards";

export function getCardImage(card: Card): string {
  // e.g. /public/cards/AS.png, /cards/10H.svg, etc.
  return `/cards/${card.rank}${normalizeSuit(card.suit)}.svg`;
}

function normalizeSuit(suit: Card["suit"]): string {
  switch (suit) {
    case "♠": return "S";
    case "♥": return "H";
    case "♦": return "D";
    case "♣": return "C";
  }
}