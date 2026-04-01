# FinPlan - Household Financial Planner

## Project Overview

Comprehensive financial management app for a Canadian couple (Ken & Lan). Nx monorepo: React SPA + Fastify API + shared TypeScript types, containerized with Docker, deployable on Kubernetes.

## Architecture

```
Browser: React SPA (Vite) + TanStack Query + Zustand + Recharts + shadcn/ui + Tailwind
    ↓ HTTPS (REST/JSON)
Nginx (Reverse Proxy): Static files + API proxy
    ↓
Fastify API: Drizzle ORM + JWT Auth Plugin
    ↓
PostgreSQL 16: Financial data + user config
```

## Monorepo Structure

```
finplan/
├── packages/
│   ├── frontend/         # React SPA (Vite, @nx/vite)
│   ├── backend/          # Fastify API (@nx/node)
│   └── shared/           # @finplan/shared — types, validators, constants
├── infra/
│   ├── docker/           # Dockerfiles, docker-compose.yml, nginx.conf
│   └── k8s/              # Kubernetes manifests
├── e2e/                  # Playwright E2E tests
└── .agents/              # Agent orchestration scripts
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5, Vite 5, Tailwind 3, shadcn/ui, Recharts |
| Server State | TanStack Query 5 (all API data) |
| Client State | Zustand 4 (UI-only: modals, layout, preferences) |
| Backend | Node.js 20, Fastify 4, Drizzle ORM 0.35+ |
| Database | PostgreSQL 16 |
| Auth | JWT (httpOnly cookies, 30-day expiry, bcrypt) |
| Testing | Vitest (unit+integration), Playwright (E2E), supertest |
| Monorepo | Nx 19 |
| Containers | Docker multi-stage, docker-compose (dev), k8s (prod) |

## Coding Standards (MANDATORY)

- **TypeScript strict** — no `any`, no `@ts-ignore`. All types from `@finplan/shared`.
- **Business logic in services/** — route handlers are thin wrappers that call service functions.
- **Server data via TanStack Query** — never `useEffect(() => fetch(...))`.
- **UI state via Zustand** — never `useState` for data that comes from the API.
- **Monetary values** — `numeric(14,2)` in DB, decimal strings in API, `Intl.NumberFormat('en-CA')` in UI. NEVER JavaScript floats.
- **JWT in httpOnly cookies** — never localStorage.
- **Fastify JSON schemas** on every route for request/response validation.
- **Drizzle migrations** for all DB changes — never modify DB directly.
- **Conventional commits** — `feat(FIN-XX): description`, one logical change per commit.

## Testing Requirements (MANDATORY)

Every PR must include tests for the code it changes.

- **Unit tests (Vitest):** Every service function, every utility. Happy path + one error case minimum.
- **Integration tests (supertest):** Every API endpoint. Real PostgreSQL test database, not mocks.
- **E2E tests (Playwright):** Critical user flows — login, add transaction, view dashboard, set budget.

## API Conventions

- Base URL: `/api/v1/`
- Auth: JWT in httpOnly cookie (name: `token`)
- Errors: `{ error: { code, message, details? } }` — codes: VALIDATION_ERROR (422), AUTHENTICATION_ERROR (401), NOT_FOUND (404), CONFLICT (409), INTERNAL_ERROR (500)
- Lists: `{ data, total, page, pageSize }`
- All monetary values as decimal strings ("12345.67")

## Jira

- Atlassian Domain: https://lan-and-ken.atlassian.net/
- Project: FIN (FinPlan)
- Epics: FIN-1 through FIN-9
- Agent-ready Stories: FIN-35 through FIN-55
- Labels: `agent-ready` = ready to implement, `wave-1` through `wave-5` = implementation order

## Confluence (Reference Docs)

- PRD: https://lan-and-ken.atlassian.net/wiki/spaces/PM/pages/720898
- Design Specs: https://lan-and-ken.atlassian.net/wiki/spaces/PM/pages/1179649
- Architecture: https://lan-and-ken.atlassian.net/wiki/spaces/PM/pages/1245187
- Interface Contracts: https://lan-and-ken.atlassian.net/wiki/spaces/PM/pages/1343489
- Technical Design: https://lan-and-ken.atlassian.net/wiki/spaces/PM/pages/1343518

## TanStack Query Invalidation Rules

Creating/updating/deleting transactions → invalidate: `transactions`, `budgets`, `dashboard`
Creating balance snapshots → invalidate: `snapshots`, `dashboard`
Updating budgets → invalidate: `budgets`, `dashboard`