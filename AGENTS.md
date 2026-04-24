<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BookMeNow Project Memory (Persistent Context)
## Project summary
- Product: Hebrew RTL hotel booking and management platform (Booking-style UX).
- UI direction: Hebrew labels + full RTL layout.
- Roles: `GUEST`, `OWNER`, `ADMIN`.

## Stack
- Next.js `16.2.4` (App Router, TypeScript, Tailwind CSS v4).
- Prisma ORM + SQLite.
- Server actions + custom cookie session auth (no NextAuth).
- Firebase App Hosting deployment + Firebase Hosting redirect.

## Key files to know first
- App shell and RTL setup: `src/app/layout.tsx`, `src/app/globals.css`
- Main server actions/auth flows: `src/app/actions.ts`, `src/lib/auth.ts`
- DB and runtime datasource handling: `src/lib/db.ts`, `prisma/schema.prisma`
- Seed data: `prisma/seed.ts`
- Search experience (hero + filters/cards): `src/app/search/page.tsx`, `src/components/search/*`
- Deployment config: `firebase.json`, `apphosting.yaml`

## Implemented MVP features
- Guest: search, view hotel, date/guests selection, booking, reservation list + cancel.
- Owner: create hotel, add rooms, block dates, view hotel bookings summary.
- Admin: approve/reject hotels, block/unblock users, system counters.

## Local development commands
- Install: `npm install`
- DB sync: `npm run db:push`
- Seed demo data: `npm run db:seed`
- Run app: `npm run dev`
- Quality checks: `npm run lint` and `npm run build`

## Demo accounts (seed)
- Guest: `guest@bookmenow.co.il`
- Owner: `owner@bookmenow.co.il`
- Admin: `admin@bookmenow.co.il`
- Password: `Pass1234!`

## Deployment notes
- Deploy command: `firebase deploy`
- Firebase Hosting URL: `https://bookmenow-7f4f2.web.app`
- App Hosting backend URL: `https://my-web-app--bookmenow-7f4f2.us-east4.hosted.app`
- `firebase.json` redirects Hosting traffic to App Hosting backend.

## Runtime DB notes
- Local `.env`: `DATABASE_URL="file:./dev.db"` (Prisma creates/uses SQLite DB).
- App Hosting `apphosting.yaml`: `DATABASE_URL=file:/tmp/bookmenow.db`.
- `src/lib/db.ts` prepares configured SQLite path and copies `prisma/dev.db` when needed.

## Collaboration note
- Keep this section updated whenever architecture, routes, deployment, or key workflows change.
