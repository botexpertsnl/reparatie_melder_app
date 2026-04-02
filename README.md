# StatusFlow - Status-based WhatsApp customer communication SaaS

Production-oriented multi-tenant MVP for businesses that run ongoing work (garages, repair shops, installers, contractors, plumbers, electricians).

## Stack
- Next.js App Router + TypeScript
- Tailwind (dark-first UI)
- Prisma + PostgreSQL
- NextAuth credentials (ready for expansion)
- Zod validation
- Server-only Spotler integration layer

## Implemented foundations
- Strict tenant-scoped domain schema (Tenant, Customer, Asset, WorkItem, WorkflowStage, Thread, Message, Template, Channel, WebhookEvent, AuditLog)
- Role model: system admin, tenant owner/admin, employee
- Tenant channel resolution to prevent cross-tenant outbound/inbound mixups
- Stage transition service with transition rule checks and optional approval request creation
- Spotler outbound API wrapper in server-only modules
- Spotler webhook intake with raw payload storage and processing status updates
- Tenant advanced settings page skeleton (all required sections)
- Dashboard + operational sections scaffolded with responsive dark SaaS layout
- Seed script with 1 system admin + 3 tenants in different industries and different terminology/workflow setups

## Local setup
1. Copy envs:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create database and run:
   ```bash
   npx prisma migrate dev
   npm run db:seed
   npm run dev
   ```

## Tenant isolation model
- All tenant-owned tables include `tenantId`.
- Tenant context is resolved server-side from auth session (`requireTenantContext`).
- Service/repository layer expects tenantId from server context, never client payload.
- Spotler outbound: resolve `tenant -> active channel` before sending.
- Spotler inbound webhook: resolve `externalChannelId -> tenant` before writes.

## Workflow stage system
- Stages are tenant-specific and configurable (`WorkflowStage`).
- Ordered/customized metadata: displayName, sortOrder, icon, color, requiresApproval, terminal, start stage.
- Transition rules are tenant-specific (`StageTransitionRule`).
- Stage transitions validated in `transitionWorkItemStage` with audit logging and optional approval creation.

## Spotler integration notes
- Provider logic is isolated in server-only files:
  - `lib/spotler/client.ts`
  - `server/services/tenant-channel-service.ts`
  - `server/services/messaging-service.ts`
  - `app/api/webhooks/spotler/route.ts`
- API key comes from env; no secret in client code.
- Where Spotler endpoints or payload shapes may differ by account version, assumptions are isolated in one layer for easy adjustment.

## What is currently placeholder vs complete
### Implemented now
- Domain schema, tenant-safe service boundaries, seed data, webhook and outbound messaging architecture, UI navigation/pages.

### Next iterations
- Complete CRUD UIs and server actions for all entities
- Enhanced auth (password reset, SSO providers)
- Full Spotler endpoint/payload alignment once account docs/keys are connected
- Queueing, retries, rate limiting, and observability dashboards
