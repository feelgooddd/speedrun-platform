# Speedrun Platform

A full-stack speedrunning leaderboard platform with a game-agnostic backend API and a Harry Potter-themed reference frontend. Built for the Harry Potter speedrunning community as **Wizarding Runs**, but designed so any community can build their own frontend on top of the same backend.

**Live site:** [speedrun-platform-web.vercel.app](https://speedrun-platform-web.vercel.app)

---

## What's in this repo

A pnpm monorepo with two packages:

- `apps/api` — Express 5 + Prisma REST API (game-agnostic)
- `apps/web` — Next.js 16 frontend (Harry Potter themed)

---

## Backend

The API has no game-specific logic. Games, platforms, categories, variables, and levels are all data-driven. Any speedrunning community can seed their own game structure and build a frontend against the same endpoints.

### Stack

- Node.js + TypeScript
- Express 5
- Prisma ORM 7
- PostgreSQL (Neon serverless or any Postgres instance)
- JWT authentication (jsonwebtoken + bcryptjs)

### Data Model

```
Game
└── Platform (timing method: realtime | gametime)
    ├── Category (full_game | il | extension)
    │   ├── Variable (subcategory or filter)
    │   │   └── VariableValue
    │   └── Subcategory (legacy single-dimension splits)
    ├── Level
    │   └── LevelCategory
    │       └── Variable → VariableValue
    └── System (hardware, via PlatformSystem join)

Run
├── User (primary runner)
├── RunRunner[] (co-op runners)
├── RunVariableValue[] (variable filter values)
└── System (hardware used)

User
├── GameModerator[] (mod/admin roles per game)
└── Run[] (submitted and owned runs)
```

### Features

- **Games → Platforms → Categories** slug-based URL hierarchy
- **Variable system** for multi-dimensional category splits (e.g. Players, Version, Platform)
- **Subcategory support** for legacy single-dimension splits (Console/Emulator, ACE/No ACE)
- **Individual Level (IL) support** with Level → LevelCategory → Variable hierarchy
- **Co-op run support** with RunRunner join table and per-runner PB deduplication
- **Tie-aware leaderboard ranking** using PostgreSQL `RANK()` window function
- **Scoring types** — time (default), lowcast, highscore
- **Run submission and approval workflow** with mod queue
- **Role-based moderation** — admin / mod / user per game
- **JWT authentication** with email/password
- **Soft deletes** on games, platforms, categories, levels
- **Placeholder/unregistered runner** support for SRDC guest players
- **System/hardware tracking** per run
- **Hidden variable** support via `VariableValueHiddenVariable`

### API Endpoints

**Health**
```
GET  /health
```

**Auth**
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/check-username
POST /api/auth/verify-srdc
POST /api/auth/change-password          (auth required)
```

**Games**
```
GET    /api/games
GET    /api/games/stats
GET    /api/games/systems
GET    /api/games/:slug
GET    /api/games/:slug/:platform/systems
GET    /api/games/:slug/:platform/categories
GET    /api/games/:slug/:platform/levels
GET    /api/games/:slug/:platform/levels/:category
GET    /api/games/:slug/:platform/:category
GET    /api/games/:slug/:platform/:category/:subcategory
POST   /api/games                                           (admin)
DELETE /api/games/:slug                                     (admin)
POST   /api/games/:slug/platforms                           (admin)
POST   /api/games/:slug/:platform/categories                (admin)
POST   /api/games/:slug/:platform/systems                   (admin)
POST   /api/games/:slug/:platform/:category/variables       (admin)
POST   /api/games/:slug/:platform/:category/subcategories   (admin)
DELETE /api/games/:slug/:platform                           (admin)
DELETE /api/games/:slug/:platform/:category                 (admin)
DELETE /api/games/:slug/:platform/:category/:subcategory    (admin)
```

**Runs**
```
GET    /api/runs/my-rejected            (auth required)
GET    /api/runs/:id
POST   /api/runs                        (auth required)
PATCH  /api/runs/:id                    (admin)
DELETE /api/runs/:id                    (admin)
```

**Moderation**
```
GET   /api/moderation/queue                         (admin)
GET   /api/moderation/games/:slug/:platform/rules   (mod)
PATCH /api/moderation/games/:slug/:platform/rules   (mod)
GET   /api/moderation/:gameSlug/mod-queue           (mod)
PATCH /api/moderation/runs/:id/verify               (mod)
```

**Users**
```
GET    /api/users/me                              (auth required)
PATCH  /api/users/me                              (auth required)
GET    /api/users/me/moderated-games              (auth required)
GET    /api/users/search                          (admin)
PATCH  /api/users/:id/role                        (admin)
POST   /api/users/:id/moderate/:gameSlug          (admin)
DELETE /api/users/:id/moderate/:gameSlug          (admin)
GET    /api/users/:id
GET    /api/users/:id/runs
GET    /api/users/:id/pbs
```

---

## Frontend (Wizarding Runs)

The included frontend is built for the Harry Potter speedrunning community. It is intentionally themed — treat it as a reference implementation for how to build against the API.

### Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- CSS custom properties (no CSS framework)
- Vitest + React Testing Library

### Features

- Harry Potter house theming (Gryffindor, Slytherin, Ravenclaw, Hufflepuff) via CSS custom properties
- Non-blocking page rendering with React Suspense streaming
- Leaderboard tabs with variable/subcategory filtering
- Individual level leaderboards
- Run submission form with co-op support
- User profiles with PB tables grouped by game
- Rules modal with per-category and per-level rules
- Moderation dashboard and mod queue
- Mobile responsive

---

## Data Seeding

The repo includes seeders for importing runs from the [speedrun.com API](https://github.com/speedruncomorg/api):

- `apps/api/seed-hp4.ts` — Harry Potter and the Goblet of Fire (PC/Console + Handheld)
- `apps/api/seed-hp5.ts` — Harry Potter and the Order of the Phoenix (PC/Console + Handheld)

Seeders handle:

- Paginated run fetching (SRDC ignores variable filter params, so runs are fetched per category and filtered client-side)
- User upsert with SRDC profile data
- Guest/unregistered runner upsert as placeholder users
- Co-op run detection and RunRunner insertion
- Idempotent runs (safe to re-run, skips existing)

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL database (or a [Neon](https://neon.tech) serverless connection string)

### Setup

```bash
git clone https://github.com/feelgooddd/speedrun-platform
cd speedrun-platform
pnpm install
```

### API

Create `apps/api/.env`:

```env
DATABASE_URL=postgresql://user:password@host/dbname
JWT_SECRET=your-jwt-secret
ALLOWED_ORIGIN=http://localhost:3000
PORT=3001
```

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
pnpm dev
```

### Web

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

```bash
cd apps/web
pnpm dev
```

### Seeding

```bash
cd apps/api
npx ts-node seed-hp4.ts
npx ts-node seed-hp5.ts
```

---

## Building Your Own Frontend

The backend API is game-agnostic. To use it for a different game or community:

1. Deploy the API and database
2. Seed your game structure (game → platforms → categories → variables) via the admin endpoints or Prisma client
3. Import runs from SRDC or another source using the seeder pattern
4. Build your frontend against the REST API

The leaderboard endpoint supports variable filtering via query params:

```
GET /api/games/your-game/pc/any%25?players=1p
GET /api/games/your-game/handheld/any%25?version=gba
```

---

## Deployment

The reference deployment uses:

- **Frontend:** [Vercel](https://vercel.com)
- **Backend:** [Render](https://render.com)
- **Database:** [Neon](https://neon.tech)

Note: Render and Neon free tiers both have cold start delays on initial requests. The frontend uses React Suspense streaming to keep the UI non-blocking while the backend wakes up.

---

## Testing

```bash
cd apps/web
pnpm test
```

Tests use Vitest and React Testing Library. Current coverage includes the game creation wizard and API utility functions.