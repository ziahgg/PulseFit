'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { fail, invalid, ok, type ActionResult } from '@/lib/action-result';
import { createClient } from '@/lib/supabase/server';
import { forgotSchema, newPasswordSchema, signInSchema, signUpSchema } from '@/lib/validations';

/** Absolute site origin for auth email links: NEXT_PUBLIC_SITE_URL in production, request host locally. */
async function origin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** Only allow same-site relative redirects after sign-in. */
function safeNext(next: unknown): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/home';
}

export async function signUp(input: { displayName: string; email: string; password: string }): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName }, emailRedirectTo: `${await origin()}/auth/confirm?next=/onboarding` },
  });
  if (error) {
    console.error(`[pulsefit] signUp: ${error.code ?? ''} ${error.message}`);
    if (error.code === 'weak_password') return fail('Choose a stronger password.', { password: error.message });
    if (error.code === 'user_already_exists' || error.code === 'email_exists') return fail('An account with this email already exists. Try signing in.');
    if (error.status === 429) return fail('Too many attempts. Wait a minute and try again.');
    return fail('We couldn’t create your account. Please try again.');
  }
  // With email confirmation on, no session is returned until the link is clicked.
  return ok({ needsConfirmation: !data.session });
}

export async function signIn(input: { email: string; password: string; next?: string }): Promise<ActionResult<{ next: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === 'email_not_confirmed') return fail('Confirm your email first — check your inbox for the link.');
    if (error.status === 429) return fail('Too many attempts. Wait a minute and try again.');
    return fail('Email or password is incorrect.');
  }
  return ok({ next: safeNext(input.next) });
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${await origin()}/auth/confirm?next=/auth/update-password` });
  if (error && error.status === 429) return fail('Too many attempts. Wait a minute and try again.');
  if (error) console.error(`[pulsefit] resetPassword: ${error.code ?? ''} ${error.message}`);
  // Same response whether or not the email exists, so accounts can't be discovered.
  return ok(undefined);
}

export async function updatePassword(input: { password: string; confirm: string }): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return fail('Your reset link has expired. Request a new one.');
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error(`[pulsefit] updatePassword: ${error.code ?? ''} ${error.message}`);
    if (error.code === 'same_password') return fail('Choose a password you haven’t used here before.');
    if (error.code === 'weak_password') return fail('Choose a stronger password.');
    return fail('We couldn’t update your password. Please try again.');
  }
  return ok(undefined);
}
