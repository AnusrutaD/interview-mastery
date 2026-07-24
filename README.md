# Interview Mastery

A full-stack web application to track your DSA and system design interview preparation. Built around the **NeetCode 150** problem list with spaced repetition principles — 5 problems/day, 25/week, with revision days.

🌐 **Live:** [interview-mastery-iota.vercel.app](https://interview-mastery-iota.vercel.app)

---

## Features

- **NeetCode 150 Dashboard** — all 150 problems with LeetCode links, pagination (5/page = 1 day's target), collapsible rows
- **Mastery Tracking** — 4 levels: Unseen → Learning → Familiar → Mastered
- **Per-problem Notes** — save your approach, edge cases, time complexity
- **Practice Timer** — stopwatch with hint counter per session
- **Stats & Profile** — progress by difficulty (Easy/Medium/Hard), by topic, recent activity
- **Authentication** — GitHub OAuth, Google OAuth, email/password signup
- **Cross-device Sync** — progress saved to Supabase PostgreSQL when logged in; localStorage fallback for guests
- **Dark / Light / System Theme** — persisted to localStorage
- **Mobile Friendly** — responsive layout for all screen sizes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | JavaScript (JSX) |
| Styling | Tailwind CSS v4 |
| Auth | Auth.js v5 (next-auth@beta) |
| ORM | Prisma 6 |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel |

---

## Project Structure

```
interview-mastery/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.js   # Auth.js route handler
│   │   │   ├── signup/route.js          # Email/password registration
│   │   │   └── check-provider/route.js  # OAuth vs password detection
│   │   ├── progress/route.js            # GET/POST user progress
│   │   └── profile/route.js             # Profile stats API
│   ├── login/page.jsx                   # Login + signup page
│   ├── profile/page.jsx                 # User profile page
│   ├── layout.jsx                       # Root layout with providers
│   ├── page.jsx                         # Home → Dashboard
│   └── globals.css                      # Tailwind v4 import + dark variant
│
├── components/
│   ├── Dashboard.jsx                    # Main app shell, state management
│   ├── ProblemTable.jsx                 # Paginated table with collapsible rows
│   ├── StatsBar.jsx                     # Progress bar + mastery stat cards
│   ├── Filters.jsx                      # Search, category, difficulty, mastery filters
│   ├── Stopwatch.jsx                    # Practice timer with hint counter
│   ├── AuthButton.jsx                   # Sign in/out + profile link
│   ├── ThemeProvider.jsx                # Dark/light/system theme context
│   ├── ThemeToggle.jsx                  # Theme toggle button (☀️ 🌙 💻)
│   └── SessionWrapper.jsx               # next-auth SessionProvider wrapper
│
├── data/
│   └── problems.js                      # All 150 NeetCode problems + config
│
├── lib/
│   └── prisma.js                        # Prisma client singleton
│
├── prisma/
│   └── schema.prisma                    # DB schema: User, Account, Session, Progress
│
└── auth.js                              # Auth.js config: GitHub, Google, Credentials
```

---

## Database Schema

```prisma
model User {
  id            String     @id @default(cuid())
  name          String?
  email         String?    @unique
  password      String?    # null for OAuth users
  image         String?
  accounts      Account[]
  sessions      Session[]
  progress      Progress[]
}

model Progress {
  id        String   @id @default(cuid())
  userId    String
  problemId Int
  mastery   String   @default("unseen")  # unseen | learning | familiar | mastered
  notes     String?
  updatedAt DateTime @updatedAt

  @@unique([userId, problemId])
}
```

---

## Local Development

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier)
- GitHub OAuth app
- Google OAuth app

### Setup

**1. Clone and install:**
```bash
git clone https://github.com/AnusrutaD/interview-mastery.git
cd interview-mastery
npm install
```

**2. Create `.env.local`:**
```env
# Auth.js — generate with: openssl rand -base64 32
AUTH_SECRET=

# Supabase — Settings → Database → Connect → Prisma section
DATABASE_URL="postgresql://..."        # Transaction pooler (port 6543)
DIRECT_URL="postgresql://..."          # Direct connection (port 5432)

# GitHub — github.com/settings/developers
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# Google — console.cloud.google.com
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

**3. Copy env for Prisma CLI and run migrations:**
```bash
cp .env.local .env
npx prisma migrate dev --name init
```

**4. Start dev server:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### OAuth Callback URLs (local)

| Provider | Callback URL |
|---|---|
| GitHub | `http://localhost:3000/api/auth/callback/github` |
| Google | `http://localhost:3000/api/auth/callback/google` |

---

## Deployment (Vercel)

**1. Push to GitHub, import project on [vercel.com](https://vercel.com)**

**2. Add environment variables in Vercel → Settings → Environment Variables:**
```
AUTH_SECRET
DATABASE_URL
DIRECT_URL
AUTH_GITHUB_ID
AUTH_GITHUB_SECRET
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
NEXTAUTH_URL = https://your-app.vercel.app
```

**3. Update OAuth callback URLs to production:**

| Provider | Callback URL |
|---|---|
| GitHub | `https://your-app.vercel.app/api/auth/callback/github` |
| Google | `https://your-app.vercel.app/api/auth/callback/google` |

**4. Redeploy** on Vercel after adding env vars.

**Note:** Run `npx prisma migrate deploy` manually whenever you change the database schema.

---

## Mastery Levels

| Level | Meaning |
|---|---|
| **Unseen** | Not attempted yet |
| **Learning** | Attempted but needed hints or struggled |
| **Familiar** | Solved but not fully confident |
| **Mastered** | Solved confidently without hints |

---

## Study Plan

| Schedule | Target |
|---|---|
| Daily | 5 problems (1 page) |
| Weekly | 25 problems (Mon–Fri) + 2 revision days |
| Total | 150 problems in 6 weeks |

---

## Roadmap

- [x] NeetCode 150 dashboard
- [x] Mastery tracking + notes
- [x] Practice timer with hint counter
- [x] GitHub + Google + email/password auth
- [x] Supabase database sync
- [x] User profile page with stats
- [x] Dark / light / system theme
- [x] Deployed on Vercel
- [ ] Chrome extension — auto-detect LeetCode submissions
- [ ] System design section
- [ ] Spaced repetition email reminders
- [ ] AI hint system (Claude as interviewer)

---

## Contributing

This is a personal learning project. Feel free to fork and adapt for your own interview prep.
