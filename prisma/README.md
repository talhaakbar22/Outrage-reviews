# Database schema

This project uses **Prisma 8** with a data contract at `contract.prisma` (not `schema.prisma`).

- Source of truth: `prisma/contract.prisma`
- Generated artifacts: `contract.json`, `contract.d.ts`
- Migrations: `migrations/app/`

Commands:
```bash
npm run db:emit
npm run db:plan -- --name <slug>
npm run db:migrate
```
