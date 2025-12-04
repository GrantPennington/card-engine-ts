// src/apps/cli/blackjack-cli.ts
import readline from "readline";
import {
  BlackjackState,
  BlackjackConfig,
  initBlackjack,
  hit,
  stand,
  nextPlayer,
  handScore,
  isBusted,
  allNonDealerDone,
  dealerAutoPlay,
  botAutoPlay
} from "../../core/blackjack";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (q: string): Promise<string> =>
  new Promise(resolve => rl.question(q, resolve));

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Configure the table here:
const TABLE_CONFIG: BlackjackConfig = {
  numHumans: 1,
  numBots: 2,
  humanNames: ["You"],              // optional
  botNames: ["Hal", "RNGesus"],     // optional
  dealerName: "Dealer"              // optional
};

let state: BlackjackState = initBlackjack(TABLE_CONFIG);

const renderState = () => {
  console.clear();
  console.log("=== Blackjack ===\n");

  state.players.forEach((p, index) => {
    const handStr = p.hand.map(c => `${c.rank}${c.suit}`).join(" ");
    const score = handScore(p.hand);
    const isCurrent = index === state.currentPlayerIndex;

    let roleLabel: string;
    if (p.isDealer) roleLabel = "Dealer";
    else if (p.isBot) roleLabel = `Bot ${p.id}`;
    else roleLabel = `Player ${p.id}`;

    const flags: string[] = [];
    if (p.isBlackjack) flags.push("BLACKJACK");
    else if (p.hasTwentyOne) flags.push("21");
    if (p.busted) flags.push("BUST");
    else if (p.standing && !p.hasTwentyOne && !p.isBlackjack) flags.push("STAND");

    const flagsStr = flags.length ? ` [${flags.join(", ")}]` : "";

    console.log(
      `${isCurrent ? "➡ " : "  "}${roleLabel}: ${handStr || "(no cards)"}`
    );
    console.log(`     Score: ${score}${flagsStr}`);
    console.log("");
  });

  if (state.finished) {
    console.log("Game over!\n");
  }
};

const computeOutcome = () => {
  const dealer = state.players[0]!;
  const dealerScore = isBusted(dealer.hand) ? 0 : handScore(dealer.hand);

  const dealerLabel =
    dealer.isBlackjack ? " (BLACKJACK)" :
    dealer.hasTwentyOne ? " (21)" :
    isBusted(dealer.hand) ? " (BUST)" :
    "";

  console.log("=== Results ===");
  console.log(`Dealer: ${dealerScore}${dealerLabel}\n`);

  // Each non-dealer player is evaluated vs dealer
  state.players.slice(1).forEach(p => {
    const score = isBusted(p.hand) ? 0 : handScore(p.hand);

    const flag =
      p.isBlackjack ? " (BLACKJACK)" :
      p.hasTwentyOne ? " (21)" :
      isBusted(p.hand) ? " (BUST)" :
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
      // score tie: give slight edge to 21 over non-21
      if (p.hasTwentyOne && !dealer.hasTwentyOne) {
        result = "WIN (21 beats equal score)";
      } else if (dealer.hasTwentyOne && !p.hasTwentyOne) {
        result = "LOSE (dealer 21 beats equal score)";
      } else {
        result = "PUSH";
      }
    }

    const who = p.isBot ? `Bot ${p.id}` : `Player ${p.id}`;
    console.log(`${who}: ${score}${flag} -> ${result}`);
  });

  console.log("");
};

const main = async () => {
  while (true) {
    renderState();

    // If all non-dealers are done, let dealer auto-play and finish
    if (allNonDealerDone(state) && !state.finished) {
      console.log("Dealer's turn...");
      await delay(1000);
      state = dealerAutoPlay(state);
      renderState();
      computeOutcome();
      break;
    }

    if (state.finished) {
      computeOutcome();
      break;
    }

    const current = state.players[state.currentPlayerIndex]!;

    // Safety: if we somehow land on dealer earlier, let dealer play and finish
    if (current.isDealer) {
      console.log("Dealer's turn...");
      await delay(1000);
      state = dealerAutoPlay(state);
      renderState();
      computeOutcome();
      break;
    }

    // Skip players who are already done
    if (
      current.busted ||
      current.standing ||
      current.hasTwentyOne ||
      current.isBlackjack
    ) {
      state = nextPlayer(state);
      continue;
    }

    // Bot turn
    if (current.isBot) {
      console.log(`Bot ${current.id} is thinking...`);
      await delay(800);
      state = botAutoPlay(state);     // bot hits/stands until done
      state = nextPlayer(state);
      continue;
    }

    // Human turn
    const ans = (await ask("(h)it, (s)tand, or (q)uit? ")).trim().toLowerCase();

    if (ans === "q") {
      console.log("Quitting...");
      break;
    } else if (ans === "h") {
      state = hit(state);
      if (state.players[state.currentPlayerIndex]!.busted) {
        state = nextPlayer(state);
      }
    } else if (ans === "s") {
      state = stand(state);
      state = nextPlayer(state);
    }
  }

  rl.close();
};

main().catch(err => {
  console.error("Error in game loop:", err);
  rl.close();
});