import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Mode = 'signin' | 'signup';

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmationSent, setConfirmationSent] = useState(false);

  // Redirect if already signed in
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setGlobalError('');
    setFieldErrors({});
    setConfirmationSent(false);
  };

  // ─── Validation ──────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (mode === 'signup' && displayName.trim().length < 2) {
      errors.displayName = 'Name must be at least 2 characters.';
    }

    if (!email.includes('@') || !email.includes('.')) {
      errors.email = 'Enter a valid email address.';
    }

    if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError('');

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setGlobalError(friendlyError(error.message));
        }
        // On success, onAuthStateChange in AuthContext fires → user is set →
        // the useEffect above redirects to /
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName.trim() },
          },
        });

        if (error) {
          setGlobalError(friendlyError(error.message));
        } else if (data.session) {
          // Email confirmation disabled — signed in immediately
          navigate('/', { replace: true });
        } else {
          // Email confirmation required
          setConfirmationSent(true);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (confirmationSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-background px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-5xl">📬</div>
          <h2 className="text-xl font-semibold text-foreground">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <span className="text-foreground">{email}</span>.
            Click it to activate your account, then come back to sign in.
          </p>
          <button
            onClick={() => switchMode('signin')}
            className="text-sm text-primary underline underline-offset-4"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-background px-6">
      <div className="w-full max-w-sm space-y-8">

        {/* Brand */}
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-black tracking-tight text-primary">STRIDE</h1>
          <p className="text-sm text-muted-foreground">Level up your lifts.</p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-xl p-6 space-y-5">

          {/* Heading */}
          <h2 className="text-lg font-semibold text-foreground">
            {mode === 'signin' ? 'Welcome back' : 'Create an account'}
          </h2>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {mode === 'signup' && (
              <Field label="Display name" error={fieldErrors.displayName}>
                <Input
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  disabled={isSubmitting}
                  className={cn(fieldErrors.displayName && 'border-destructive')}
                />
              </Field>
            )}

            <Field label="Email" error={fieldErrors.email}>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete={mode === 'signup' ? 'email' : 'username'}
                disabled={isSubmitting}
                className={cn(fieldErrors.email && 'border-destructive')}
              />
            </Field>

            <Field label="Password" error={fieldErrors.password}>
              <Input
                type="password"
                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                disabled={isSubmitting}
                className={cn(fieldErrors.password && 'border-destructive')}
              />
            </Field>

            {/* Global error */}
            {globalError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {globalError}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Please wait…'
                : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
            </Button>
          </form>
        </div>

        {/* Mode toggle */}
        <p className="text-center text-sm text-muted-foreground">
          {mode === 'signin' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-primary underline underline-offset-4 font-medium"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-primary underline underline-offset-4 font-medium"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts Supabase auth error messages to user-friendly strings.
 * The raw Supabase messages are technical and sometimes expose internals.
 */
function friendlyError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials') || m.includes('invalid email or password')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (m.includes('user already registered') || m.includes('email already')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (m.includes('password should be')) {
    return 'Password must be at least 6 characters.';
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (m.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Network error. Check your connection and try again.';
  }

  return 'Something went wrong. Please try again.';
}
