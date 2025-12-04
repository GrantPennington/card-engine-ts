// src/core/blackjack.ts
import { Card, createDeck, shuffle, dealOne } from "./cards";

export interface BlackjackConfig {
  numHumans: number;
  numBots?: number;
  humanNames?: string[]; // optional names for humans
  botNames?: string[];   // optional names for bots
  dealerName?: string;   // optional dealer label (e.g. "Dealer", "House")
}

export interface BlackjackPlayer {
  id: string;           // "H1", "B1", etc.
  hand: Card[];
  isDealer: boolean;
  isBot: boolean;
  standing: boolean;
  busted: boolean;
  isBlackjack: boolean;   // natural blackjack (2-card 21)
  hasTwentyOne: boolean;  // any exact 21 (including naturals)
}

export interface BlackjackState {
  deck: Card[];
  players: BlackjackPlayer[]; // index 0 = dealer
  currentPlayerIndex: number;
  finished: boolean;
}

const getPlayer = (players: BlackjackPlayer[], index: number): BlackjackPlayer => {
  const p = players[index];
  if (!p) {
    throw new Error(`Invalid player index: ${index}`);
  }
  return p;
};

const cardValue = (card: Card): number[] => {
  if (card.rank === "A") return [1, 11];
  if (["J", "Q", "K"].includes(card.rank)) return [10];
  return [parseInt(card.rank, 10)];
};

export const handScore = (hand: Card[]): number => {
  let totals = [0];

  for (const card of hand) {
    const values = cardValue(card);
    const nextTotals: number[] = [];

    for (const t of totals) {
      for (const v of values) {
        nextTotals.push(t + v);
      }
    }

    totals = Array.from(new Set(nextTotals));
  }

  const valid = totals.filter(t => t <= 21);
  return valid.length ? Math.max(...valid) : Math.min(...totals);
};

export const isBusted = (hand: Card[]): boolean => handScore(hand) > 21;

// natural blackjack = 2-card 21
export const isNaturalBlackjack = (hand: Card[]): boolean => {
  return hand.length === 2 && handScore(hand) === 21;
};

const isPlayerDone = (p: BlackjackPlayer): boolean =>
  p.busted || p.standing || p.hasTwentyOne || p.isBlackjack;

/**
 * numHumans: how many human players (for React later)
 * numBots: how many bot players
 *
 * Dealer is always index 0.
 * Humans come first (H1..Hn), then bots (B1..Bm).
 */
export const initBlackjack = (config: BlackjackConfig): BlackjackState => {
  const {
    numHumans,
    numBots = 0,
    humanNames = [],
    botNames = [],
    dealerName = "Dealer"
  } = config;

  if (numHumans < 0 || numBots < 0) {
    throw new Error("numHumans and numBots must be >= 0");
  }

  const totalPlayers = numHumans + numBots;

  let deck = shuffle(createDeck());
  const players: BlackjackPlayer[] = [];

  // Dealer at index 0
  const dealerHand = [dealOne(deck), dealOne(deck)];
  const dealerScore = handScore(dealerHand);
  const dealerNatural = isNaturalBlackjack(dealerHand);
  const dealerHas21 = dealerScore === 21;

  players.push({
    id: dealerName,
    hand: dealerHand,
    isDealer: true,
    isBot: false,
    standing: dealerHas21,
    busted: false,
    isBlackjack: dealerNatural,
    hasTwentyOne: dealerHas21
  });

  // Humans: H1..Hn or names from humanNames[]
  for (let i = 0; i < numHumans; i++) {
    const hand = [dealOne(deck), dealOne(deck)];
    const score = handScore(hand);
    const natural = isNaturalBlackjack(hand);
    const has21 = score === 21;

    const name = humanNames[i] ?? `H${i + 1}`;

    players.push({
      id: name,
      hand,
      isDealer: false,
      isBot: false,
      standing: has21,
      busted: false,
      isBlackjack: natural,
      hasTwentyOne: has21
    });
  }

  // Bots: B1..Bm or names from botNames[]
  for (let i = 0; i < numBots; i++) {
    const hand = [dealOne(deck), dealOne(deck)];
    const score = handScore(hand);
    const natural = isNaturalBlackjack(hand);
    const has21 = score === 21;

    const name = botNames[i] ?? `B${i + 1}`;

    players.push({
      id: name,
      hand,
      isDealer: false,
      isBot: true,
      standing: has21,
      busted: false,
      isBlackjack: natural,
      hasTwentyOne: has21
    });
  }

  return {
    deck,
    players,
    currentPlayerIndex: totalPlayers > 0 ? 1 : 0, // first non-dealer seat
    finished: false
  };
};

// export const initBlackjack = (numHumans: number, numBots: number = 0): BlackjackState => {
//   if (numHumans < 0 || numBots < 0) {
//     throw new Error("numHumans and numBots must be >= 0");
//   }

//   const totalPlayers = numHumans + numBots;

//   let deck = shuffle(createDeck());
//   const players: BlackjackPlayer[] = [];

//   // Dealer (index 0)
//   const dealerHand = [dealOne(deck), dealOne(deck)];
//   const dealerScore = handScore(dealerHand);
//   const dealerNatural = isNaturalBlackjack(dealerHand);
//   const dealerHas21 = dealerScore === 21;

//   players.push({
//     id: "D",
//     hand: dealerHand,
//     isDealer: true,
//     isBot: false,
//     standing: dealerHas21,
//     busted: false,
//     isBlackjack: dealerNatural,
//     hasTwentyOne: dealerHas21
//   });

//   // Humans: H1..Hn
//   for (let i = 1; i <= numHumans; i++) {
//     const hand = [dealOne(deck), dealOne(deck)];
//     const score = handScore(hand);
//     const natural = isNaturalBlackjack(hand);
//     const has21 = score === 21;

//     players.push({
//       id: `H${i}`,
//       hand,
//       isDealer: false,
//       isBot: false,
//       standing: has21,
//       busted: false,
//       isBlackjack: natural,
//       hasTwentyOne: has21
//     });
//   }

//   // Bots: B1..Bm
//   for (let i = 1; i <= numBots; i++) {
//     const hand = [dealOne(deck), dealOne(deck)];
//     const score = handScore(hand);
//     const natural = isNaturalBlackjack(hand);
//     const has21 = score === 21;

//     players.push({
//       id: `B${i}`,
//       hand,
//       isDealer: false,
//       isBot: true,
//       standing: has21,
//       busted: false,
//       isBlackjack: natural,
//       hasTwentyOne: has21
//     });
//   }

//   return {
//     deck,
//     players,
//     currentPlayerIndex: totalPlayers > 0 ? 1 : 0, // first non-dealer seat
//     finished: false
//   };
// };


// Player hits (if not already done)
export const hit = (prev: BlackjackState): BlackjackState => {
  if (prev.finished) return prev;

  const deck = [...prev.deck];
  const players = prev.players.map(p => ({ ...p }));
  const current = getPlayer(players, prev.currentPlayerIndex);

  if (isPlayerDone(current)) {
    return prev;
  }

  current.hand = [...current.hand, dealOne(deck)];
  current.busted = isBusted(current.hand);

  if (!current.busted) {
    const score = handScore(current.hand);
    const natural = isNaturalBlackjack(current.hand);

    current.isBlackjack = current.isBlackjack || natural;
    current.hasTwentyOne = score === 21;

    if (current.hasTwentyOne) {
      current.standing = true;
    }
  }

  return { ...prev, deck, players };
};

// Player stands (if not already done)
export const stand = (prev: BlackjackState): BlackjackState => {
  if (prev.finished) return prev;

  const players = prev.players.map(p => ({ ...p }));
  const current = getPlayer(players, prev.currentPlayerIndex);

  if (isPlayerDone(current)) {
    return prev;
  }

  current.standing = true;

  return { ...prev, players };
};

export const nextPlayer = (prev: BlackjackState): BlackjackState => {
  if (prev.finished) return prev;

  const players = prev.players;
  let idx = prev.currentPlayerIndex;

  while (true) {
    idx++;

    if (idx >= players.length) {
      // we've looped past last seat → dealer or game over
      if (prev.currentPlayerIndex === 0) {
        return { ...prev, finished: true };
      }
      return { ...prev, currentPlayerIndex: 0 }; // dealer's turn
    }

    const p = players[idx];
    if (!p) continue;

    if (!isPlayerDone(p)) {
      return { ...prev, currentPlayerIndex: idx };
    }
  }
};

export const allNonDealerDone = (state: BlackjackState): boolean => {
  return state.players.slice(1).every(isPlayerDone);
};

// Dealer AI: hit until >= 17, then stand / lock
export const dealerAutoPlay = (state: BlackjackState): BlackjackState => {
  let s: BlackjackState = state;
  let dealer = getPlayer(s.players, 0);

  if (isPlayerDone(dealer)) {
    return { ...s, finished: true };
  }

  while (!dealer.busted && handScore(dealer.hand) < 17) {
    s = hit(s);
    dealer = getPlayer(s.players, 0);
  }

  if (!dealer.busted) {
    const score = handScore(dealer.hand);
    dealer = getPlayer(s.players, 0);
    dealer.hasTwentyOne = dealer.hasTwentyOne || score === 21;
    dealer.isBlackjack = dealer.isBlackjack || isNaturalBlackjack(dealer.hand);
    dealer.standing = true;
  }

  return { ...s, finished: true };
};

// Basic bot AI: hit < 16, otherwise stand, until done
export const botAutoPlay = (state: BlackjackState): BlackjackState => {
  let s: BlackjackState = state;
  let current = getPlayer(s.players, s.currentPlayerIndex);

  if (!current.isBot || current.isDealer) {
    return state;
  }

  while (!isPlayerDone(current)) {
    const score = handScore(current.hand);

    if (score < 16) {
      s = hit(s);
    } else {
      s = stand(s);
    }

    current = getPlayer(s.players, s.currentPlayerIndex);
  }

  return s;
};
