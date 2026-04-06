# Juicy Merge

A fruit-merging puzzle game built as a Reddit app with Devvit. Drop and merge fruits to score points — combine identical fruits to create bigger ones. Reach the score threshold to unlock the event reward code.

## Stack

- [Devvit](https://developers.reddit.com/) — Reddit's developer platform for embedded apps
- [Phaser 3](https://phaser.io/) — 2D game engine with Matter.js physics
- [Vite](https://vite.dev/) — build toolchain
- [Hono](https://hono.dev/) — lightweight backend for server-side logic
- [TypeScript](https://www.typescriptlang.org/)

## Project Structure

```
src/
  client/
    scenes/       # Phaser scenes: Boot, Preloader, MainMenu, Game, GameOver
    config.ts     # Game constants (reward code, score threshold, event ID)
    theme.ts      # Shared color palette and CSS/Phaser color helpers
    game.ts       # Phaser app entry point
    splash.ts     # Reddit post splash screen entry point
  server/
    index.ts      # Hono server (post creation, app install trigger)
  shared/
    index.ts      # Types shared between client and server
```

## Requirements

- Node >= 22.2.0
- A Reddit account connected to [Reddit Developers](https://developers.reddit.com/)

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start live playtest on Reddit |
| `npm run build` | Build client and server |
| `npm run deploy` | Type-check, lint, and upload to Reddit |
| `npm run launch` | Deploy and publish for review |
| `npm run login` | Authenticate the Devvit CLI |
| `npm run type-check` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |

## Moderator Actions

Mods can create or remove Juicy Merge game posts from the subreddit or post context menu in Reddit.
