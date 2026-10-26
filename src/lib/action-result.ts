import type { z } from 'zod';

import { fieldErrors, type FieldErrors } from '@/lib/validations';

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fields?: FieldErrors };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string, fields?: FieldErrors): ActionResult<never> => ({ ok: false, error, fields });
export const invalid = (e: z.ZodError): ActionResult<never> => ({ ok: false, error: 'Please fix the highlighted fields.', fields: fieldErrors(e) });

/** Maps a database error to a safe message; details go to the server log only (no row data). */
export function dbFail(where: string, error: { code?: string; message: string }): ActionResult<never> {
  console.error(`[pulsefit] ${where}: ${error.code ?? ''} ${error.message}`);
  if (error.code === '23505') return fail('That already exists.');
  if (error.code === '23514' || error.code === '22023') return fail('Some values are out of range. Check the form and try again.');
  if (error.code === '42501') return fail('You don’t have access to that.');
  if (error.code === 'P0002' || error.code === 'PGRST116') return fail('That item no longer exists.');
  return fail('Something went wrong. Please try again.');
}
