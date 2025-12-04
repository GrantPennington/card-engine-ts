// src/core/nerts.ts
import { Card, Suit, createDeck, shuffle } from "./cards";

export type PlayerId = string;

export interface NertsCard extends Card {
  id: string;
  ownerId: PlayerId;
  faceUp: boolean;
}

export interface NertsPlayerState {
  id: PlayerId;
  nertsPile: NertsCard[];       // 13-card Nerts pile (top is at end)
  tableau: NertsCard[][];       // 4 tableau piles
  stock: NertsCard[];           // face-down
  waste: NertsCard[];           // face-up, top at end
  score: number;
}

export interface NertsFoundationPile {
  suit: Suit | null;  // decided by first card (Ace), or null if empty
  cards: NertsCard[];
}

export interface NertsConfig {
  playerIds: PlayerId[];
}

export interface NertsState {
  players: NertsPlayerState[];
  foundations: NertsFoundationPile[];
  startedAt: number;
  finished: boolean;
  winnerId: PlayerId | null;
}

// ---- Rank / color helpers ----

const rankOrder: Card["rank"][] = [
  "A", "2", "3", "4", "5", "6", "7",
  "8", "9", "10", "J", "Q", "K"
];

function getRankValue(rank: Card["rank"]): number {
  const idx = rankOrder.indexOf(rank);
  return idx === -1 ? 0 : idx + 1;
}

function isRedSuit(suit: Suit): boolean {
  return suit === "♥" || suit === "♦";
}

function clonePlayer(p: NertsPlayerState): NertsPlayerState {
  return {
    id: p.id,
    nertsPile: [...p.nertsPile],
    tableau: p.tableau.map(col => [...col]),
    stock: [...p.stock],
    waste: [...p.waste],
    score: p.score
  };
}

function cloneFoundations(fs: NertsFoundationPile[]): NertsFoundationPile[] {
  return fs.map(f => ({
    suit: f.suit,
    cards: [...f.cards]
  }));
}

function makeFaceUp(c: NertsCard): NertsCard {
  return { ...c, faceUp: true };
}

// ---- Init ----

export function initNerts(config: NertsConfig): NertsState {
  // One slot per potential Ace (4 suits × players)
    const foundations: NertsFoundationPile[] = Array.from(
        { length: config.playerIds.length * 4 },
        () => ({
            suit: null,
            cards: []
        })
    );

  const players: NertsPlayerState[] = config.playerIds.map(playerId => {
    const baseDeck = shuffle(createDeck());
    const all: NertsCard[] = baseDeck.map((c, idx) => ({
      ...c,
      id: `${playerId}-${c.rank}${c.suit}-${idx}`,
      ownerId: playerId,
      faceUp: false
    }));

    // Nerts pile: 13 cards, top is last and face up
    const rawNerts = all.slice(0, 13);
    const nertsPile: NertsCard[] = rawNerts.map((card, i, arr) =>
      i === arr.length - 1 ? makeFaceUp(card) : card
    );

    // Tableau: 4 piles, 1 face-up card each from remaining cards
    const t0 = makeFaceUp(all[13]);
    const t1 = makeFaceUp(all[14]);
    const t2 = makeFaceUp(all[15]);
    const t3 = makeFaceUp(all[16]);
    const tableau: NertsCard[][] = [[t0], [t1], [t2], [t3]];

    const stock = all.slice(17); // rest of deck, all face down

    return {
      id: playerId,
      nertsPile,
      tableau,
      stock,
      waste: [],
      score: 0
    };
  });

  return {
    players,
    foundations,
    startedAt: Date.now(),
    finished: false,
    winnerId: null
  };
}

// ---- Actions ----

export type NertsAction =
  | { type: "stock_draw"; playerId: PlayerId }
  | { type: "waste_to_tableau"; playerId: PlayerId; tableauIndex: number }
  | { type: "waste_to_foundation"; playerId: PlayerId; foundationIndex: number }
  | { type: "tableau_to_tableau"; playerId: PlayerId; fromIndex: number; toIndex: number; cardId: string }
  | { type: "tableau_to_foundation"; playerId: PlayerId; fromIndex: number; foundationIndex: number }
  | { type: "nerts_to_tableau"; playerId: PlayerId; tableauIndex: number }
  | { type: "nerts_to_foundation"; playerId: PlayerId; foundationIndex: number };

export function isNertsFinished(state: NertsState): boolean {
  return state.finished;
}

// Rule helpers

function canPlaceOnTableau(
  destTop: NertsCard | undefined,
  card: NertsCard,
  allowAnyOnEmpty = false
): boolean {
  const cRank = getRankValue(card.rank);
  const cRed = isRedSuit(card.suit);

  if (!destTop) {
    if (allowAnyOnEmpty) {
      // e.g. top of Nerts pile may go to any empty tableau spot
      return true;
    }
    // Default: only Kings may start an empty tableau pile
    return cRank === 13;
  }

  const dRank = getRankValue(destTop.rank);
  const dRed = isRedSuit(destTop.suit);

  return cRed !== dRed && cRank === dRank - 1;
}


function canPlaceOnFoundation(pile: NertsFoundationPile, card: NertsCard): boolean {
  const cRank = getRankValue(card.rank);

  // Empty pile: only Ace may start it
  if (pile.cards.length === 0) {
    return cRank === 1;
  }

  const top = pile.cards[pile.cards.length - 1];

  // Suit must match the pile’s suit and the top card
  if (top.suit !== card.suit) return false;

  const topRank = getRankValue(top.rank);
  return cRank === topRank + 1;
}


// ---- Main reducer ----

export function applyNertsAction(state: NertsState, action: NertsAction): NertsState {
  if (state.finished) return state;

  const playerIndex = state.players.findIndex(p => p.id === action.playerId);
  if (playerIndex === -1) return state;

  const players = state.players.map(clonePlayer);
  const foundations = cloneFoundations(state.foundations);
  const player = players[playerIndex];

  let scoreDelta = 0;
  let used = false;

  const finalize = () => {
    if (!used) return state;

    player.score += scoreDelta;

    // Check for win: Nerts pile empty
    let finished = state.finished;
    let winnerId = state.winnerId;

    if (!finished && player.nertsPile.length === 0) {
      finished = true;
      winnerId = player.id;

      // Optional: penalty/bonus settling could happen here.
    }

    return {
      ...state,
      players,
      foundations,
      finished,
      winnerId
    };
  };

  switch (action.type) {
    case "stock_draw": {
      // Draw up to 3 cards from stock to waste; if stock empty, recycle waste back
      if (player.stock.length > 0) {
        const drawCount = Math.min(3, player.stock.length);
        for (let i = 0; i < drawCount; i++) {
          const c = player.stock.pop();
          if (!c) break;
          player.waste.push(makeFaceUp(c));
        }
        scoreDelta += 0; // drawing typically not scored
        used = true;
      } else if (player.waste.length > 0) {
        // Recycle waste back to stock face-down
        const recycled = [...player.waste].reverse().map(c => ({
          ...c,
          faceUp: false
        }));
        player.stock = recycled;
        player.waste = [];
        used = true;
      }
      return finalize();
    }

    case "waste_to_tableau": {
      const dest = player.tableau[action.tableauIndex];
      if (!dest) return state;
      const top = player.waste[player.waste.length - 1];
      if (!top) return state;

      if (!canPlaceOnTableau(dest[dest.length - 1], top)) return state;

      player.waste.pop();
      player.tableau[action.tableauIndex].push(top);
      used = true;
      return finalize();
    }

    case "waste_to_foundation": {
        const f = foundations[action.foundationIndex];
        if (!f) return state;
        const top = player.waste[player.waste.length - 1];
        if (!top) return state;

        if (!canPlaceOnFoundation(f, top)) return state;

        player.waste.pop();
        f.cards.push(top);
        if (f.suit === null) f.suit = top.suit;

        scoreDelta += 1;
        used = true;
        return finalize();
    }


    case "tableau_to_tableau": {
      const fromPile = player.tableau[action.fromIndex];
      const toPile = player.tableau[action.toIndex];
      if (!fromPile || !toPile) return state;

      const idx = fromPile.findIndex(c => c.id === action.cardId);
      if (idx === -1) return state;

      const moving = fromPile.slice(idx);
      if (moving.length === 0) return state;
      if (!moving[0].faceUp) return state;

      const destTop = toPile[toPile.length - 1];
      if (!canPlaceOnTableau(destTop, moving[0])) return state;

      // Remove from source
      player.tableau[action.fromIndex] = fromPile.slice(0, idx);

      // Flip new top if needed
      const newFrom = player.tableau[action.fromIndex];
      if (newFrom.length > 0) {
        const tIdx = newFrom.length - 1;
        const topCard = newFrom[tIdx];
        if (!topCard.faceUp) {
          newFrom[tIdx] = makeFaceUp(topCard);
        }
      }

      // Add to dest
      player.tableau[action.toIndex] = toPile.concat(moving);
      used = true;
      return finalize();
    }

    case "tableau_to_foundation": {
      const fromPile = player.tableau[action.fromIndex];
      const f = foundations[action.foundationIndex];
      if (!fromPile || !f) return state;

      const top = fromPile[fromPile.length - 1];
      if (!top || !top.faceUp) return state;
      if (!canPlaceOnFoundation(f, top)) return state;

      fromPile.pop();
      f.cards.push(top);
      if (f.suit === null) f.suit = top.suit;

      // Flip new top if needed
      if (fromPile.length > 0) {
        const tIdx = fromPile.length - 1;
        const newTop = fromPile[tIdx];
        if (!newTop.faceUp) {
          fromPile[tIdx] = makeFaceUp(newTop);
        }
      }

      scoreDelta += 1;
      used = true;
      return finalize();
    }

    case "nerts_to_tableau": {
      const dest = player.tableau[action.tableauIndex];
      if (!dest) return state;

      const top = player.nertsPile[player.nertsPile.length - 1];
      if (!top || !top.faceUp) return state;

      if (!canPlaceOnTableau(dest[dest.length - 1], top, true)) return state;

      player.nertsPile.pop();
      dest.push(top);

      // Reveal new top of Nerts pile (if any)
      if (player.nertsPile.length > 0) {
        const idx = player.nertsPile.length - 1;
        const c = player.nertsPile[idx];
        if (!c.faceUp) {
          player.nertsPile[idx] = makeFaceUp(c);
        }
      }

      used = true;
      return finalize();
    }

    case "nerts_to_foundation": {
      const f = foundations[action.foundationIndex];
      if (!f) return state;

      const top = player.nertsPile[player.nertsPile.length - 1];
      if (!top || !top.faceUp) return state;

      if (!canPlaceOnFoundation(f, top)) return state;

        player.nertsPile.pop();
        f.cards.push(top);
        if (f.suit === null) f.suit = top.suit;


      // Reveal new top of Nerts pile (if any)
      if (player.nertsPile.length > 0) {
        const idx = player.nertsPile.length - 1;
        const c = player.nertsPile[idx];
        if (!c.faceUp) {
          player.nertsPile[idx] = makeFaceUp(c);
        }
      }

      scoreDelta += 2; // reward Nerts → foundation more
      used = true;
      return finalize();
    }
  }
}

// ---- Bot logic ----

function findNertsToFoundation(state: NertsState, player: NertsPlayerState): NertsAction | null {
  const top = player.nertsPile[player.nertsPile.length - 1];
  if (!top || !top.faceUp) return null;

  for (let i = 0; i < state.foundations.length; i++) {
    const f = state.foundations[i];
    if (canPlaceOnFoundation(f, top)) {
        return { type: "nerts_to_foundation", playerId: player.id, foundationIndex: i };
    }
  }

  return null;
}

function findNertsToTableau(state: NertsState, player: NertsPlayerState): NertsAction | null {
  const top = player.nertsPile[player.nertsPile.length - 1];
  if (!top || !top.faceUp) return null;

  for (let i = 0; i < player.tableau.length; i++) {
    const dest = player.tableau[i];
    if (canPlaceOnTableau(dest[dest.length - 1], top, true)) {
      return { type: "nerts_to_tableau", playerId: player.id, tableauIndex: i };
    }
  }
  return null;
}

function findTableauToFoundation(state: NertsState, player: NertsPlayerState): NertsAction | null {
  for (let t = 0; t < player.tableau.length; t++) {
    const pile = player.tableau[t];
    if (pile.length === 0) continue;
    const top = pile[pile.length - 1];
    if (!top.faceUp) continue;

    for (let fIdx = 0; fIdx < state.foundations.length; fIdx++) {
      const f = state.foundations[fIdx];
      if (canPlaceOnFoundation(f, top)) {
        return {
          type: "tableau_to_foundation",
          playerId: player.id,
          fromIndex: t,
          foundationIndex: fIdx
        };
      }
    }
  }
  return null;
}

function findWasteToFoundation(state: NertsState, player: NertsPlayerState): NertsAction | null {
  const top = player.waste[player.waste.length - 1];
  if (!top) return null;

  for (let fIdx = 0; fIdx < state.foundations.length; fIdx++) {
    const f = state.foundations[fIdx];
    if (canPlaceOnFoundation(f, top)) {
      return {
        type: "waste_to_foundation",
        playerId: player.id,
        foundationIndex: fIdx
      };
    }
  }
  return null;
}

function findWasteToTableau(state: NertsState, player: NertsPlayerState): NertsAction | null {
  const top = player.waste[player.waste.length - 1];
  if (!top) return null;

  for (let i = 0; i < player.tableau.length; i++) {
    const dest = player.tableau[i];
    if (canPlaceOnTableau(dest[dest.length - 1], top)) {
      return {
        type: "waste_to_tableau",
        playerId: player.id,
        tableauIndex: i
      };
    }
  }
  return null;
}

function findTableauToTableau(state: NertsState, player: NertsPlayerState): NertsAction | null {
  for (let from = 0; from < player.tableau.length; from++) {
    const pile = player.tableau[from];

    for (let idx = 0; idx < pile.length; idx++) {
      const card = pile[idx];
      if (!card.faceUp) continue; // can only move visible sequences

      // ✅ Only consider moves that will reveal a face-down card behind the sequence
      const cardBefore = idx > 0 ? pile[idx - 1] : undefined;
      if (!cardBefore || cardBefore.faceUp) {
        // Either this is the very top card or the card behind is already face up.
        // Moving this doesn't uncover anything, so skip it to avoid pointless shuffles.
        continue;
      }

      for (let to = 0; to < player.tableau.length; to++) {
        if (to === from) continue;
        const dest = player.tableau[to];
        if (canPlaceOnTableau(dest[dest.length - 1], card)) {
          return {
            type: "tableau_to_tableau",
            playerId: player.id,
            fromIndex: from,
            toIndex: to,
            cardId: card.id
          };
        }
      }
    }
  }
  return null;
}


/**
 * One "step" for a bot: tries a prioritized move for a given bot playerId.
 */
export function botStep(state: NertsState, botId: PlayerId): NertsState {
  if (state.finished) return state;

  const player = state.players.find(p => p.id === botId);
  if (!player) return state;

  // Priority:
  // 1. Nerts → foundation
  // 2. Tableau → foundation
  // 3. Waste → foundation
  // 4. Nerts → tableau
  // 5. Tableau → tableau
  // 6. Waste → tableau
  // 7. Draw from stock
  const action =
    findNertsToFoundation(state, player) ??
    findTableauToFoundation(state, player) ??
    findWasteToFoundation(state, player) ??
    findNertsToTableau(state, player) ??
    findTableauToTableau(state, player) ??
    findWasteToTableau(state, player) ??
    ({ type: "stock_draw", playerId: botId } as NertsAction);

  return applyNertsAction(state, action);
}
