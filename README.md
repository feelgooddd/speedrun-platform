# Speedrun Platform

A full-stack speedrunning leaderboard platform with a game-agnostic backend API and a Harry Potter-themed reference frontend. Built for the Harry Potter speedrunning community as **Wizarding Runs**, but designed so any community can build their own frontend on top of the same backend.

**Live site:** [speedrun-platform-web.vercel.app](https://speedrun-platform-web.vercel.app)

---

## What's in this repo

This is a pnpm monorepo with two packages:

- `apps/api` — Express + Prisma REST API (game-agnostic)
- `apps/web` — Next.js 15 frontend (Harry Potter themed)

---

## Backend

The API is designed to be reusable. It has no Harry Potter-specific logic — games, platforms, categories, and variables are all data-driven. Any speedrunning community can seed their own game structure and build a frontend against the same endpoints.

### Features

- **Games → Platforms → Categories** slug-based URL hierarchy
- **Variable system** for multi-dimensional category splits (e.g. Players, Version, Platform)
- **Subcategory support** for legacy HP1-3 style splits (Console/Emulator, ACE/No ACE)
- **Co-op run support** with RunRunner join table and per-runner PB deduplication
- **Tie-aware leaderboard ranking** using PostgreSQL `RANK()` window function
- **Run submission and approval workflow** with mod queue
- **Role-based moderation** (admin / mod / user)
- **Better Auth** with email(Twitch OAuth planned)
- **Soft deletes** on runs
- **Placeholder/unregistered runner** support for SRDC guest players
- **System/hardware tracking** per run

### Stack

- Node.js + TypeScript
- Express
- Prisma ORM
- PostgreSQL (tested on Neon serverless)
- Better Auth

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
GET    /api/games/:slug
GET    /api/games/:slug/:platform/systems
GET    /api/games/:slug/:platform/categories
GET    /api/games/:slug/:platform/:category
GET    /api/games/:slug/:platform/:category/:subcategory
POST   /api/games                                           (admin)
DELETE /api/games/:slug                                     (admin)
POST   /api/games/:slug/platforms                           (admin)
POST   /api/games/:slug/:platform/categories                (admin)
POST   /api/games/:slug/:platform/:category/subcategories   (admin)
DELETE /api/games/:slug/:platform                           (admin)
DELETE /api/games/:slug/:platform/:category                 (admin)
DELETE /api/games/:slug/:platform/:category/:subcategory    (admin)
```

**Runs**
```
GET    /api/runs/:id
POST   /api/runs                (auth required)
PATCH  /api/runs/:id            (admin)
DELETE /api/runs/:id            (admin)
```

**Moderation**
```
GET   /api/moderation/queue                  (admin)
GET   /api/moderation/:gameSlug/mod-queue    (mod)
PATCH /api/moderation/runs/:id/verify        (mod)
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
```

---

## Frontend (Wizarding Runs)

The included frontend is built for the Harry Potter speedrunning community. It is intentionally themed and not generic — treat it as a reference implementation for how to build against the API.

### Features

- Harry Potter house theming (Gryffindor, Slytherin, Ravenclaw, Hufflepuff) with CSS custom properties
- Leaderboard tabs with variable/subcategory filtering
- Run submission form
- User profiles with accordion PB tables grouped by game
- Co-op run display with runner lists
- Moderation dashboard
- Mobile responsive

### Stack

- Next.js 15 (App Router)
- TypeScript
- CSS Modules

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

```bash
cd apps/api
cp .env.example .env
# Fill in DATABASE_URL, BETTER_AUTH_SECRET,
npx prisma migrate deploy
npx prisma generate
pnpm dev
```

### Web

```bash
cd apps/web
cp .env.example .env
# Fill in NEXT_PUBLIC_API_URL this is the url to your backend e.g localhost:3001 by default on express.
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
2. Seed your game structure (game → platforms → categories → variables) via the Prisma client or SQL
3. Import your runs from SRDC or another source using the seeder pattern
4. Build your frontend against the REST API

The leaderboard endpoint supports variable filtering via query params, making it straightforward to build filtered views for any category structure:

```
/api/leaderboard/your-game/pc/any?players=1p
/api/leaderboard/your-game/handheld/any?version=gba
```

---

## Deployment

The reference deployment uses:

- **Frontend:** [Vercel](https://vercel.com)
- **Backend:** [Render](https://render.com)
- **Database:** [Neon](https://neon.tech)

All free tiers. Cold starts on Render's free plan will cause initial API latency.

---