# API Endpoints

Base URL: `http://localhost:3001/api`

All responses are JSON. Protected endpoints require a Bearer token in the `Authorization` header.

---

## Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | None | Register a new user. Body: `username`, `email`, `password`. Returns user object and JWT token. |
| POST | `/auth/login` | None | Login with email and password. Returns user object and JWT token. |

---

## Games

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/games` | None | List all games on the platform including their platforms and categories. |
| GET | `/games/:slug` | None | Get a single game by slug including all platforms, categories, and default platform. |
| GET | `/games/:slug/:category` | None | Get the leaderboard for a category. Returns ranked runs sorted by time. |

### Leaderboard Query Parameters

| Param | Description | Default |
|---|---|---|
| `platform` | Filter by platform slug. Use `all` for combined. | Game's default platform |
| `sub` | Filter by subcategory slug | None |
| `verified` | Filter by verification status | `true` |
| `page` | Page number | `1` |
| `limit` | Results per page | `25` |

**Examples:**
```
GET /api/games/hp1-pc/any
GET /api/games/hp1-pc/any?platform=gbc
GET /api/games/hp1-pc/any?platform=all
GET /api/games/hp1-pc/any?sub=no-major-glitches&page=2&limit=10
```

---

## Runs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/runs/:id` | None | Get a single run by ID including user, game, category, platform, time, and verification status. |
| POST | `/runs` | Required | Submit a new run. User is determined from the JWT token. Body: `category_id`, `platform_id`, `time_ms`, `video_url`. Run is created as unverified. |
| PATCH | `/runs/:id/verify` | Required | Mark a run as verified. Sets `verified: true` and `verified_at` timestamp. |
| PATCH | `/runs/:id/reject` | Required | Reject and permanently delete a run. |

---

## Users

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users/:id` | None | Get a user's public profile including stats, personal bests, and moderated games. |
| GET | `/users/:id/runs` | None | Get a paginated list of all runs submitted by a user. |

### User Runs Query Parameters

| Param | Description | Default |
|---|---|---|
| `page` | Page number | `1` |
| `limit` | Results per page | `25` |

---

## Moderation

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/moderation/queue/:gameSlug` | Required | Get all unverified runs pending review for a specific game, sorted by submission date ascending. |

---

## Notes

- Times are stored as `time_ms` (integer milliseconds) and returned with a human-readable `time_display` field (e.g. `1h 01m 01s`)
- Ranks are computed at query time and reflect the active filters — rank 1 on `?platform=pc` may differ from rank 1 on `?platform=all`
- Run submission requires authentication but the `user_id` is pulled from the JWT — users can only submit runs as themselves
- All GET endpoints are fully public and require no authentication — suitable for Discord bots and third party apps
