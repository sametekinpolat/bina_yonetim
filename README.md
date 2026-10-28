This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database migrations

For a new empty database, run `npm run db:migrate` to apply the full migration history.

For an existing database created before Drizzle migration tracking was enabled, run `npm run db:baseline` once, then `npm run db:migrate`. The baseline command verifies that the database contains the schema from migration `0006` before recording that baseline; it does not alter application tables. Do not run the baseline command for a new empty database.

Migration `0008` makes invoice paid totals follow income transactions, including direct database deletions. Migration `0009` separates monthly aidat from extra assessments. Migration `0010` supports splitting one imported bank payment between a monthly invoice and an extra assessment while retaining both transaction rows under the same bank import source. Migration `0011` recalculates published invoice balances from linked income transactions, carries monthly payments forward chronologically, and isolates each extra assessment in its own payment pool.

For future schema changes, update `src/lib/db/schema.ts`, generate a migration with `npx drizzle-kit generate --name=your_change`, and apply it with `npm run db:migrate`.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
