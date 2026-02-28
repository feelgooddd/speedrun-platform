# Speedrun Leaderboard Platform

## Overview

An open source, self-hostable speedrun leaderboard platform. Built with a Harry Potter speedrunning community as the reference implementation, designed so any community can fork and deploy their own instance. Includes a public API for third-party integrations like Discord bots.

---

## Goals

- Provide a modern, community-owned alternative to speedrun.com
- Keep the platform self-hostable with minimal technical overhead
- Expose a clean public REST API for Discord bots and other integrations
- Use the Harry Potter speedrunning community as the reference deployment
- Open source so communities can fork, customize, and own their data

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (TypeScript) |
| Backend | Express (TypeScript) |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | Better Auth |
| OAuth | Twitch |
| Monorepo | TBD (npm workspaces or Turborepo) |
| Hosting | Vercel (frontend) + Railway (backend) |
| Caching | Redis or in-memory (leaderboard endpoints) |

---

## Architecture

The project is structured as a monorepo with a clear separation between frontend and backend. The Express backend is the single source of truth for both data and authentication. The Next.js frontend is a pure client — it stores the JWT in an httpOnly cookie and passes it with requests to the API.

This separation means communities can build their own frontend entirely and consume the API independently, and third-party tools like Discord bots interact with the same API the frontend uses.

---

## Database Schema

### `users`
| Field | Type |
|---|---|
| id | string (pk) |
| username | string |
| avatar_url | string |
| country | string |
| twitch | string |
| created_at | timestamp |

### `games`
| Field | Type |
|---|---|
| id | string (pk) |
| slug | string (unique) |
| name | string |
| default_platform_id | string (fk) |
| created_at | timestamp |

### `platforms`
| Field | Type |
|---|---|
| id | string (pk) |
| game_id | string (fk) |
| name | string |
| slug | string |

### `categories`
| Field | Type |
|---|---|
| id | string (pk) |
| game_id | string (fk) |
| name | string |
| slug | string |

### `runs`
| Field | Type |
|---|---|
| id | string (pk) |
| user_id | string (fk) |
| category_id | string (fk) |
| platform_id | string (fk) |
| time_ms | integer |
| video_url | string |
| verified | boolean |
| submitted_at | timestamp |
| verified_at | timestamp |

### `game_moderators`
| Field | Type |
|---|---|
| user_id | string (fk) |
| game_id | string (fk) |
| role | string |

> **Note:** Ranks are never stored. They are computed at query time using PostgreSQL `RANK()` window functions based on whatever filters are active. `time_ms` is always stored as raw milliseconds; `time_display` is computed and returned in responses.

---

## API Endpoints

### Games
```
GET /games                                  List all games
GET /games/:slug                            Game info + categories
GET /games/:slug/:category                  Leaderboard for category
GET /games/:slug/:category/runs/:id         Specific run detail
```

### Users
```
GET /users/:id                              Profile, PBs, moderated games
GET /users/:id/runs                         Paginated run history
```

### Runs
```
POST   /runs                                Submit a run
PATCH  /runs/:id/verify                     Verify a run (mod only)
PATCH  /runs/:id/reject                     Reject a run (mod only)
```

### Moderation
```
GET /moderation/queue/:gameSlug             Pending runs for a game (mod only)
```

---

## Query Parameters

The leaderboard endpoint (`GET /games/:slug/:category`) supports the following query params:

| Param | Description | Default |
|---|---|---|
| `platform` | Filter by platform slug, or `all` for combined | game's `default_platform` |
| `sub` | Filter by subcategory slug | none |
| `verified` | Filter by verification status | `true` |
| `page` | Page number | `1` |
| `limit` | Results per page | `25` |

**Examples:**
```
GET /games/hp1pc/any%
GET /games/hp1pc/any%?platform=gbc
GET /games/hp1pc/any%?platform=all
GET /games/hp1pc/any%?sub=no-major-glitches&platform=pc&page=2
```

---

## Example API Response

`GET /games/hp1pc/any%?platform=pc`

```json
{
  "game": "Harry Potter and the Philosopher's Stone",
  "category": "Any%",
  "platform": "PC",
  "total": 214,
  "page": 1,
  "limit": 25,
  "runs": [
    {
      "rank": 1,
      "user": {
        "id": "usr_123",
        "username": "ryanruns",
        "country": "CA"
      },
      "time_ms": 3661000,
      "time_display": "1h 01m 01s",
      "platform": "PC",
      "subcategory": null,
      "video_url": "https://twitch.tv/videos/123456",
      "submitted_at": "2024-03-10T14:22:00Z"
    }
  ]
}
```

---

## Auth Flow

1. User clicks "Login with Twitch"
2. Better Auth handles OAuth flow on the Express backend
3. On success, Express issues a JWT stored in an httpOnly cookie
4. All protected routes on Express validate the JWT via middleware
5. Next.js frontend passes the cookie automatically with every request
6. Third-party API consumers (Discord bots etc.) authenticate via token in the `Authorization` header

---

## Moderation Workflow

1. User submits a run via `POST /runs` with a video URL and time
2. Run is created with `verified: false`
3. Moderators for that game see the run in their queue at `GET /moderation/queue/:gameSlug`
4. Moderator verifies or rejects via `PATCH /runs/:id/verify` or `PATCH /runs/:id/reject`
5. Verified runs appear on the public leaderboard

---

## MVP Scope

**Backend**
- Auth (registration, Twitch OAuth, JWT middleware)
- Game, category, platform, run, user CRUD
- Leaderboard query with ranking
- Mod verification queue and actions
- Public API with pagination

**Frontend**
- Leaderboard pages per game/category
- User profile pages
- Run submission form
- Admin dashboard (mod queue, category management, user management)

**Out of scope for MVP**
- Notifications
- Run comments
- Discord integration
- Video embedding
- Multi-language / localization

---

## Estimated Timeline

| Week | Focus |
|---|---|
| 1-2 | Monorepo setup, Express scaffolding, DB schema, auth |
| 3-4 | Core API routes (leaderboards, runs, users, moderation) |
| 5-6 | Next.js frontend (leaderboards, profiles, submission form) |
| 7-8 | Admin dashboard, cleanup, deployment, documentation |

**Estimated total:** 6-8 weeks at 10-15 hours/week

---

## Open Source Strategy

- Harry Potter instance serves as the live reference implementation
- Communities fork the repo and deploy their own instance
- Prisma migration history makes version upgrades straightforward for self-hosters
- API is fully documented for third-party developers
- Self-hosters can run just the backend with a custom frontend if desired
