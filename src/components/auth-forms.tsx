'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition, type FormEvent } from 'react';

import { requestPasswordReset, signIn, signUp, updatePassword } from '@/app/actions/auth';
import type { FieldErrors } from '@/lib/validations';
import { Button, Field, FormError } from './ui';

function useForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [pending, start] = useTransition();
  return { errors, setErrors, formError, setFormError, pending, start };
}

const value = (e: FormEvent<HTMLFormElement>, name: string) => String(new FormData(e.currentTarget).get(name) ?? '');

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const f = useForm();
  const router = useRouter();
  const id = useId();
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const input = { email: value(e, 'email'), password: value(e, 'password'), next };
        f.start(async () => {
          const r = await signIn(input);
          if (!r.ok) {
            f.setErrors(r.fields ?? {});
            f.setFormError(r.fields ? undefined : r.error);
            return;
          }
          router.replace(r.data.next);
          router.refresh();
        });
      }}
    >
      {notice ? <p className="rounded-[16px] bg-success-soft px-4 py-3 t-body text-text">{notice}</p> : null}
      <FormError message={f.formError} />
      <Field id={`${id}-email`} name="email" type="email" label="Email" autoComplete="email" required error={f.errors.email} />
      <Field id={`${id}-password`} name="password" type="password" label="Password" autoComplete="current-password" required error={f.errors.password} />
      <Link href="/forgot-password" className="self-end t-body text-text-secondary underline-offset-4 hover:underline">
        Forgot password?
      </Link>
      <Button type="submit" full loading={f.pending} className="mt-4">
        Sign in
      </Button>
      <p className="text-center t-body text-text-secondary">
        New to PulseFit?{' '}
        <Link href="/signup" className="t-body-m text-text underline-offset-4 hover:underline">
          Create account
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const f = useForm();
  const router = useRouter();
  const id = useId();
  const [sentTo, setSentTo] = useState<string | null>(null);
  if (sentTo)
    return (
      <div className="flex flex-col items-center gap-3 rounded-[24px] bg-surface p-7 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-brand-soft text-brand">
          <MailCheck size={28} aria-hidden />
        </span>
        <h2 className="t-title">Check your email</h2>
        <p className="t-body text-text-secondary">We sent a confirmation link to {sentTo}. Open it on this device to finish setting up your account.</p>
        <Link href="/login" className="mt-2 t-body-m underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const input = { displayName: value(e, 'name'), email: value(e, 'email'), password: value(e, 'password') };
        f.start(async () => {
          const r = await signUp(input);
          if (!r.ok) {
            f.setErrors(r.fields ?? {});
            f.setFormError(r.fields ? undefined : r.error);
            return;
          }
          if (r.data.needsConfirmation) setSentTo(input.email);
          else {
            router.replace('/onboarding');
            router.refresh();
          }
        });
      }}
    >
      <FormError message={f.formError} />
      <Field id={`${id}-name`} name="name" label="Your name" autoComplete="name" required error={f.errors.displayName} />
      <Field id={`${id}-email`} name="email" type="email" label="Email" autoComplete="email" required error={f.errors.email} />
      <Field id={`${id}-password`} name="password" type="password" label="Password" autoComplete="new-password" required hint="At least 8 characters" error={f.errors.password} />
      <Button type="submit" full loading={f.pending} className="mt-4">
        Create account
      </Button>
      <p className="text-center t-body text-text-secondary">
        Already have an account?{' '}
        <Link href="/login" className="t-body-m text-text underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const f = useForm();
  const id = useId();
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <p className="rounded-[24px] bg-surface p-6 t-body text-text-secondary">
        If an account exists for that email, a reset link is on its way. The link opens a page where you can choose a new password.
      </p>
    );
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const input = { email: value(e, 'email') };
        f.start(async () => {
          const r = await requestPasswordReset(input);
          if (!r.ok) {
            f.setErrors(r.fields ?? {});
            f.setFormError(r.fields ? undefined : r.error);
          } else setSent(true);
        });
      }}
    >
      <FormError message={f.formError} />
      <Field id={`${id}-email`} name="email" type="email" label="Email" autoComplete="email" required error={f.errors.email} />
      <Button type="submit" full loading={f.pending} className="mt-2">
        Send reset link
      </Button>
    </form>
  );
}

export function UpdatePasswordForm() {
  const f = useForm();
  const router = useRouter();
  const id = useId();
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const input = { password: value(e, 'password'), confirm: value(e, 'confirm') };
        f.start(async () => {
          const r = await updatePassword(input);
          if (!r.ok) {
            f.setErrors(r.fields ?? {});
            f.setFormError(r.fields ? undefined : r.error);
          } else router.replace('/home');
        });
      }}
    >
      <FormError message={f.formError} />
      <Field id={`${id}-password`} name="password" type="password" label="New password" autoComplete="new-password" required hint="At least 8 characters" error={f.errors.password} />
      <Field id={`${id}-confirm`} name="confirm" type="password" label="Confirm password" autoComplete="new-password" required error={f.errors.confirm} />
      <Button type="submit" full loading={f.pending} className="mt-2">
        Save password
      </Button>
    </form>
  );
}
