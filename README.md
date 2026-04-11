# StatusFlow - Status-based WhatsApp customer communication SaaS

Production-oriented multi-tenant MVP for businesses that run ongoing work (garages, repair shops, installers, contractors, plumbers, electricians).

## Stack
- Next.js App Router + TypeScript
- Tailwind (dark-first UI)
- Prisma + PostgreSQL
- NextAuth credentials (ready for expansion)
- Zod validation
- Server-only ZERNIO integration layer

## Implemented foundations
- Strict tenant-scoped domain schema (Tenant, Customer, Asset, WorkItem, WorkflowStage, Thread, Message, Template, Channel, WebhookEvent, AuditLog)
- Role model: system admin, tenant owner/admin, employee
- Tenant channel resolution to prevent cross-tenant outbound/inbound mixups
- Stage transition service with transition rule checks and optional approval request creation
- ZERNIO outbound API wrapper in server-only modules
- ZERNIO webhook intake with normalized payload storage and processing status updates
- Tenant advanced settings page with tenant-level WhatsApp (ZERNIO) connect/reconnect/disconnect controls
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
- ZERNIO outbound: resolve `tenant -> active WhatsApp account` before sending.
- ZERNIO inbound webhook: resolve `whatsappAccountId -> tenant` before writes.

## Workflow stage system
- Stages are tenant-specific and configurable (`WorkflowStage`).
- Ordered/customized metadata: displayName, sortOrder, icon, color, requiresApproval, terminal, start stage.
- Transition rules are tenant-specific (`StageTransitionRule`).
- Stage transitions validated in `transitionWorkItemStage` with audit logging and optional approval creation.

## ZERNIO integration notes
- Provider logic is isolated in server-only files:
  - `lib/integrations/zernio/client.ts`
  - `lib/integrations/zernio/whatsapp.ts`
  - `lib/integrations/zernio/templates.ts`
  - `lib/integrations/zernio/inbox.ts`
  - `lib/integrations/zernio/phone-numbers.ts`
  - `lib/integrations/zernio/connect.ts`
  - `lib/integrations/zernio/webhooks.ts`
  - `server/services/tenant-channel-service.ts`
  - `server/services/messaging-service.ts`
  - `app/api/webhooks/zernio/route.ts`
  - `app/api/whatsapp/zernio/connect/route.ts`
  - `app/api/whatsapp/zernio/callback/route.ts`
- API key is read only from `process.env.ZERNIO_API_KEY` server-side.
- Webhook supports retry-safe idempotency by checking external message IDs before write.

## What is currently placeholder vs complete
### Implemented now
- Domain schema, tenant-safe service boundaries, webhook and outbound messaging architecture, UI navigation/pages.

### Next iterations
- Complete CRUD UIs and server actions for all entities
- Enhanced auth (password reset, SSO providers)
- Full ZERNIO endpoint/payload alignment once account docs/keys are connected
- Queueing, retries, rate limiting, and observability dashboards
