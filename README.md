# Shattering Glass: Battle Royale v2

A Blooket-inspired multiplayer classroom review game for *Shattering Glass* by Gail Giles.

## Added in v2
- Power-up shop using coins
- 4 power-ups: 2X, Shield, Steal, Freeze
- Coin rewards for correct answers and streaks
- Avatar selection
- Random round events
- Streak bonuses
- Speed-based scoring
- Final top-3 podium
- Game-show UI
- Live class leaderboard
- 30+ player Socket.IO room architecture
- Mobile-friendly controls

## Run
Install Node.js 18+, then:

    npm install
    npm start

Open http://localhost:3000

## Deploy
Use a Node-compatible host. Build/install command: `npm install`
Start command: `npm start`

The server stores active rooms in memory, so restarting the server ends active games.
