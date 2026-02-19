# Sequelize migration templates (M1)

These SQL templates implement Milestone M1 foundation tables and constraints:

- `202602190001-m1-foundation-data-model.up.sql`
- `202602190001-m1-foundation-data-model.down.sql`

## Integration

1. Copy both SQL files into your application's migration directory.
2. Register a Sequelize migration that executes these scripts through `queryInterface.sequelize.query`.
3. Run your normal migration command for your app environment.

Example migration wrapper:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

const templatesDir = join(process.cwd(), "packages/sequelize/migrations/templates");

export async function up(queryInterface: { sequelize: { query: (sql: string) => Promise<unknown> } }) {
  const sql = readFileSync(join(templatesDir, "202602190001-m1-foundation-data-model.up.sql"), "utf8");
  await queryInterface.sequelize.query(sql);
}

export async function down(queryInterface: { sequelize: { query: (sql: string) => Promise<unknown> } }) {
  const sql = readFileSync(join(templatesDir, "202602190001-m1-foundation-data-model.down.sql"), "utf8");
  await queryInterface.sequelize.query(sql);
}
```

## Notes

- The templates are PostgreSQL-first and use partial unique indexes.
- Idempotency and default semantics are enforced at the database layer.
