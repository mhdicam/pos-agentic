# Architecture Stack & Repository Boundaries
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Default recommended stack (proposal, not final approval)
| Layer | Recommendation | Boundary |
|---|---|---|
| Monorepo | pnpm workspaces; Turborepo optional | shared contracts/tooling |
| Web/Storefront/POS/Courier | Next.js + TypeScript + Tailwind/shadcn | separate route groups, mobile-first |
| API | Fastify + TypeScript + JSON Schema/TypeBox | domain-owned controllers/services |
| Auth | vetted Better Auth session integration | RBAC/ABAC in app service layer |
| Database | PostgreSQL + reviewed Drizzle/SQL migrations | ACID, composite FK, RLS |
| Cache/jobs | Redis + BullMQ | outbox, webhook, retries, AI jobs |
| Real-time | SSE/polling fallback | scoped status |
| Storage | S3-compatible private buckets | photos/POD/attachments signed reads |
| POS offline | Service Worker + IndexedDB | installed PWA, authorized cash ops |
| Deployment | Docker, Nginx, Ubuntu VM pilot | secrets and backup externally managed |

## Proposed monorepo layout (not runtime code here)
```
apps/
  web/              # landing + tenant + POS PWA + storefront + courier
  api/              # Fastify modular monolith
  worker/           # outbox/webhook/sync/AI tasks
packages/
  contracts/        # JSON schemas, typed DTOs, errors
  ui/               # shared accessible visual components
  config/           # lint/test/typescript configs
infra/
  docker/
  nginx/
internal/docs/       # canonical document source of truth
```

## Module boundaries
Identity/Tenancy, Catalog/Inventory, POS/OfflineSync, Orders/Pricing/Payments, Delivery/COD, Finance, Loyalty/Promos, Storefront, CRM/AI/Channels, PlatformBilling/Governance, Reporting.

One modular monolith first; no Kafka/K8s or independent microservice by default. Provider adapters, jobs, data ownership and internal domain events define extraction boundaries.
