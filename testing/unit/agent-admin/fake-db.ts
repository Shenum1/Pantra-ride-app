import { randomUUID } from "node:crypto";

type Row = Record<string, any>;

// Minimal in-memory stand-in for the slice of the supabase-js query builder
// the agent-admin HITL code uses: insert/select/update with .eq filters,
// terminated by .single()/.maybeSingle(). Unknown tables are just empty.
export function createFakeDb(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = { ...seed };

  function from(table: string) {
    tables[table] ??= [];
    let op: "select" | "insert" | "update" = "select";
    let values: Row = {};
    const filters: [string, unknown][] = [];

    const matching = () => tables[table].filter((row) => filters.every(([col, val]) => row[col] === val));

    const execute = (): Row[] => {
      if (op === "insert") {
        const now = new Date().toISOString();
        const row = { id: randomUUID(), createdAt: now, updatedAt: now, ...values };
        tables[table].push(row);
        return [row];
      }
      if (op === "update") {
        const rows = matching();
        for (const row of rows) Object.assign(row, values);
        return rows;
      }
      return matching();
    };

    const builder: any = {
      insert(v: Row) {
        op = "insert";
        values = v;
        return builder;
      },
      update(v: Row) {
        op = "update";
        values = v;
        return builder;
      },
      select() {
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return builder;
      },
      order() {
        return builder;
      },
      range() {
        return builder;
      },
      single() {
        const rows = execute();
        return Promise.resolve(
          rows.length === 1 ? { data: { ...rows[0] }, error: null } : { data: null, error: { message: `expected 1 row, got ${rows.length}` } }
        );
      },
      maybeSingle() {
        const rows = execute();
        return Promise.resolve({ data: rows[0] ? { ...rows[0] } : null, error: null });
      },
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
        const rows = execute();
        return Promise.resolve({ data: rows.map((r) => ({ ...r })), count: rows.length, error: null }).then(resolve, reject);
      },
    };
    return builder;
  }

  return { db: { from } as any, tables };
}
