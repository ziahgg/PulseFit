/**
 * In-process Postgres (PGlite) with the parts of Supabase the migrations rely on:
 * an `auth` schema with `auth.users` and `auth.uid()`, plus the `anon` / `authenticated`
 * roles and Supabase's default grants. The real migration files are applied unchanged,
 * so constraints, functions and RLS policies are exercised exactly as written.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PGlite, type Transaction } from '@electric-sql/pglite';

const MIGRATIONS = join(__dirname, '../../supabase/migrations');

const SUPABASE_STUB = `
create schema auth;
create table auth.users (
  id uuid primary key,
  email text unique,
  raw_user_meta_data jsonb not null default '{}'
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }
  return db;
}

export async function createUser(db: PGlite, id: string, name = 'Test User'): Promise<void> {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${id.slice(0, 8)}@example.test`, { display_name: name }]);
}

/** Runs `fn` as an authenticated Supabase user (RLS applies), inside a transaction that is rolled back on error. */
export async function asUser<T>(db: PGlite, userId: string | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? '']);
    await tx.exec(userId ? 'set local role authenticated' : 'set local role anon');
    return fn(tx);
  });
}

export const sid = async (db: PGlite, kind: string, slug: string): Promise<string> =>
  (await db.query<{ id: string }>(`select md5($1 || ':' || $2)::uuid::text as id`, [kind, slug])).rows[0].id;
