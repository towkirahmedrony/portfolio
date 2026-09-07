import fs from "node:fs";

function assertNoDestructiveSql() {
  const sql = fs.readFileSync(
    "/workspace/supabase/migrations/20260907200000_quote_never_creates_project.sql",
    "utf8",
  );
  if (/delete from public\.projects/i.test(sql) || /drop table/i.test(sql)) {
    throw new Error("Inspection SQL must not delete projects.");
  }
}

assertNoDestructiveSql();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key || url.includes("your-project-id")) {
  console.log(
    "No live database configured. Duplicate inspection is the SELECT in supabase/migrations/20260907200000_quote_never_creates_project.sql. Do not delete projects referenced by quotes, invoices, or messages.",
  );
  process.exit(0);
}

console.log(
  "Live database credentials are present. Run the inspection SELECT in supabase/migrations/20260907200000_quote_never_creates_project.sql against the database. Preserve any project referenced by quotes, invoices, or messages.",
);
