// src/core/cards.ts

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7"
  | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const createDeck = (): Card[] => {
  const suits: Suit[] = ["♠", "♥", "♦", "♣"];
  const ranks: Rank[] = [
    "A","2","3","4","5","6","7","8","9","10","J","Q","K"
  ];

  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
};

export const shuffle = (deck: Card[]): Card[] => {
  const copy = [...deck];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    const ci = copy[i];
    const cj = copy[j];
    if (!ci || !cj) continue; // or throw new Error("Unexpected undefined in shuffle");

    copy[i] = cj;
    copy[j] = ci;
  }

  return copy;
};

// ✅ Safe helper: always returns Card, throws if deck empty
export const dealOne = (deck: Card[]): Card => {
  const card = deck.pop();
  if (!card) {
    throw new Error("Tried to deal from an empty deck");
  }
  return card;
};