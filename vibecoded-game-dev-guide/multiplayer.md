# Multiplayer Games

**Difficulty:** ⭐⭐⭐⭐⭐ Very Hard | **SpacetimeDB removes the hardest part — without it, don't attempt this solo**

---

## A. Real Examples from the Community

### Blackholio
- **Source:** [SpacetimeDB blog — "We built Blackholio in 30 minutes"](https://spacetimedb.com/blog/blackholio)
- **Genre:** Real-time multiplayer arena (Agar.io-style eat-or-be-eaten)
- **Backend:** SpacetimeDB
- **Engine:** Unity (client)
- **Time:** 30 minutes to a working multiplayer prototype
- **What worked:** SpacetimeDB handled all server state, real-time subscriptions, and player persistence. The developer wrote almost no networking code — just described the game rules and SpacetimeDB's SDK handled the rest.
- **What it proved:** With the right backend, real-time multiplayer is achievable in a vibe-coded session.
- **Shipped:** Yes

### Broth & Bullets
- **Source:** SpacetimeDB community Discord + blog
- **Genre:** Multiplayer survival MMORPG — extraction shooter meets survival crafting
- **Backend:** SpacetimeDB
- **Notable:** Built during a SpacetimeDB game jam. Represents one of the most complex multiplayer builds in the vibe coding community — MMORPG-scale ambition built with AI assistance.
- **What SpacetimeDB provided:** Real-time state sync for all players, inventory persistence, world state management, server-authoritative validation
- **Shipped:** Yes (jam release)

### Multiplayer Card Games (community pattern)
- **Source:** r/vibecoding + r/aigamedev
- **Pattern:** Turn-based multiplayer (chess, card games) is significantly easier than real-time multiplayer. A single WebSocket message per turn (rather than 60 messages/second) is manageable without SpacetimeDB.
- **Common approach:** Socket.io (Node.js) for turn-based multiplayer — well within vibe-coding range.

### Simple co-op (community pattern)
- **Source:** Multiple itch.io entries
- **Pattern:** "Multiplayer" in many vibe-coded games means same-device co-op (two players sharing one keyboard) rather than networked multiplayer. WASD + arrow keys or two controllers. Requires no networking at all.

---

## B. Recommended Stack

Multiplayer is a spectrum from trivially easy to brutally hard. The vibe coding community has found clear demarcation lines:

**Tier 1: Same-device co-op (easiest, no networking)**
- Any engine. Two players, one device, shared screen. Player 1 uses WASD, Player 2 uses arrow keys.
- Works in any single-HTML file game. No server required.
- Underrated: many polished local multiplayer games ship on itch.io without network code.

**Tier 2: Turn-based networked (moderate)**
- **Socket.io + Node.js backend + Phaser 3 / HTML frontend**
- One message per turn (player submits move → server validates → broadcasts to all players)
- 60fps network sync is NOT required for turn-based — any internet connection works
- Set up free hosting on Render.com or Railway.app (both have free tiers for Node.js)
- This is achievable with careful planning and 2–3 vibe-coding sessions

**Tier 3: Real-time networked (hard)**
- **SpacetimeDB + Godot or Unity** — the only viable path for a solo vibe-coder
- Without SpacetimeDB: requires a WebSocket server, game state reconciliation, lag compensation, and cheat prevention — this is professional backend engineering, not a vibe-coding weekend
- With SpacetimeDB: write game rules as a Rust/C# module; SDK handles sync, subscriptions, and persistence automatically

**What NOT to do:** Build real-time multiplayer with raw WebSockets from scratch. This has consumed many vibe-coded games that worked perfectly as single-player but collapsed when networking was added. The networking layer is the #1 scope trap in this genre.

---

## C. Prompting Strategy

**Choose your tier before writing a single prompt.** These tiers have completely different architectures and you cannot easily migrate between them.

**Tier 1 — Same-device co-op:**
```
Make this a 2-player same-device game:
- Player 1: WASD to move
- Player 2: Arrow keys to move
- Add player 2 as a second colored sprite (Player 1: blue, Player 2: orange)
- Player 2 has independent HP and can be hit by the same enemies
- Game ends when either player reaches 0 HP (cooperative) / 
  OR last player standing wins (competitive)
All other game logic is identical for both players.
```

**Tier 2 — Turn-based with Socket.io:**
```
Backend (Node.js + Socket.io):
- Room system: players join with a room code (4-digit random)
- Game state stored in server memory: {roomId, players, board, currentTurn}
- Events:
  PLAYER_JOIN: add player to room, emit GAME_READY when 2 players joined
  PLAYER_MOVE: validate move on server, update state, broadcast GAME_STATE to all
  PLAYER_DISCONNECT: pause game, emit OPPONENT_DISCONNECTED
- Server validates all moves (never trust client input)

Frontend (HTML + Socket.io client):
- Connect to server via socket.io
- Show "Waiting for opponent..." until GAME_READY fires
- On your turn: enable interaction, send PLAYER_MOVE
- On opponent turn: disable interaction, show "Waiting for [name]..."
- Always render from server state (GAME_STATE event), never from local prediction
```

**SpacetimeDB architecture (Tier 3):**
```
SpacetimeDB module (Rust or C#):
Define tables:
- Player: identity, position_x, position_y, hp, score
- Bullet: id, owner_id, x, y, direction_x, direction_y
- GameState: started, wave_number, elapsed_seconds

Define reducers (server-side logic that clients call):
- move_player(dx, dy): update player position, validate bounds
- shoot(direction_x, direction_y): spawn bullet in Bullet table
- hit_player(target_id): deduct HP, check death

Client (Unity/Godot) subscribes to tables:
- Subscription: SELECT * FROM Player — auto-updates when any player moves
- Subscription: SELECT * FROM Bullet — auto-updates for all bullets
Client renders from subscriptions only (never predict/reconcile manually)
```

**Real-time position sync (SpacetimeDB pattern):**
```
Position update strategy:
- Client sends move_player reducer call every 50ms (20 times/second)
- Server validates position is within bounds and within max speed
- All clients receive updated Player table row via subscription
- Client interpolates between received positions (lerp over 50ms)
- This produces smooth movement without client-side prediction complexity
```

**Lag handling (Tier 2 turn-based):**
```
Add timeout handling:
- If opponent doesn't respond within 30 seconds, emit OPPONENT_TIMEOUT
- Waiting player sees: "Opponent is taking a long time..."
- At 60 seconds: offer "Claim victory by forfeit?" option
- On disconnect: save game state to Redis (or JSON file), offer reconnection for 5 minutes
```

---

## D. Common Pitfalls

**Underestimating network complexity.** Every multiplayer game has the same hidden iceberg: movement sync is 10% of the code, but lag compensation, cheat prevention, reconnection handling, and server authority validation are the other 90%. This is why SpacetimeDB is so transformative — it handles the 90%.

**Trusting client input.** "The client says the bullet hit the enemy" is trivially exploitable. All game-critical calculations (damage, win conditions, collision) must happen on the server. Claude will often generate code that validates on the client — catch this early:
```
Rule: The server is the source of truth for all game state.
Clients send INTENT (I pressed the shoot button, I moved left).
Server applies the intent to game state and broadcasts the result.
Clients render the broadcast result.
Clients NEVER directly modify game state.
```

**State desync.** If two clients have different views of the game (Player A thinks they killed Player B, Player B thinks they're still alive), the game breaks. In SpacetimeDB, this can't happen (all clients subscribe to the same server state). In hand-rolled WebSocket code, desyncs happen when any message is dropped or processed out of order. Design for this: send full game state on every important event, not incremental diffs.

**Same-device co-op key conflicts.** When Player 1 uses WASD and Player 2 uses Arrow keys, they often share the keyboard on a laptop where the arrow keys conflict with text input or browser shortcuts. Test all key combinations early.

**Room code collision.** If your room-code generator produces 4-digit codes, there are only 10,000 possibilities. With many concurrent players, collisions become likely. Use 6-character alphanumeric codes (36^6 = 2.2 billion possibilities) or generate UUIDs.

**The "waiting room" dead-end.** A multiplayer game where the waiting-room experience is "stare at a screen that says Waiting for opponent..." will struggle to retain players. Add a simple single-player practice mode or add a bot opponent that fills in when no human is available. Ask Claude to implement a bot AI first, before the networking, so the game is playable alone while you build the network layer.

---

## E. Kick-off Prompt Templates

**Template A — Same-device co-op (simplest start):**
```
I'm adding 2-player local co-op to this game.
Engine: Phaser 3, single HTML file.

Player 1: WASD movement, existing blue sprite
Player 2: Arrow key movement, new orange sprite  
Player 2 starts at opposite side of map from Player 1.

Both players:
- Can pick up items (both see the same items, first to reach picks it up)
- Have independent HP
- Game ends when both players are dead (co-op mode)

Do NOT change any existing single-player logic — add Player 2 alongside it.
Start by adding Player 2 sprite and movement only. 
Confirm both players move independently before adding any interaction.
```

**Template B — Turn-based networked:**
```
I'm building a 2-player turn-based game with networking.
Stack: Node.js + Socket.io backend, HTML/JS frontend.

Game: Tic-tac-toe (for testing the network layer before building real game)

Backend requirements:
- Players create/join rooms by 4-digit code
- Room holds 2 players, game state (3x3 board), current turn
- Events: join_room, make_move, game_reset
- Server validates all moves, broadcasts new state to both players
- Handle disconnection gracefully

Frontend: Simple HTML form to join room, render board, highlight whose turn.
Do NOT build the actual game I want yet — just get tic-tac-toe working 
to prove the network layer works. I'll swap in the real game after.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Same-device co-op added to existing game | 2–4 hours |
| Turn-based networked (lobby + basic game) | 3–5 days |
| Real-time multiplayer with SpacetimeDB | 1–2 weeks |
| Polished multiplayer release | 1–3 months |

**"Done" at MVP (co-op):** Two players can control independent characters and share a game objective.

**"Done" at MVP (networked):** Two players connect with a room code, play one complete game session, see results.

**The honest truth about multiplayer vibe coding:** Real-time networked multiplayer remains the hardest problem in this community. The Blackholio and Broth & Bullets examples that "worked in 30 minutes" used SpacetimeDB specifically because it offloads the networking complexity to a purpose-built system. Without that kind of infrastructure, multiplayer vibe coding ends in frustration in nearly every case. Use SpacetimeDB or choose local co-op.

---

*Sources: [SpacetimeDB Blackholio blog](https://spacetimedb.com/blog/blackholio) · [SpacetimeDB community](https://spacetimedb.com) · [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre) · [r/vibecoding](https://reddit.com/r/vibecoding)*
