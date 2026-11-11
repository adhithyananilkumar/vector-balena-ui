import React, { useCallback, useState } from 'react';
import { useLogin } from 'react-admin';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { brand } from '../brand';
import { Button } from '../components/button';
import { Input } from '../components/input';
import { Label } from '../components/label';
import Intro from './Intro';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return 'Sign in failed. Check your credentials and try again.';
};

const Login: React.FC = () => {
  const login = useLogin();
  const [showIntro, setShowIntro] = useState<boolean>(() => !prefersReducedMotion());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishIntro = useCallback(() => {
    setShowIntro(false);
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await login({ username: username.trim(), password });
    } catch (loginError) {
      setError(errorMessage(loginError));
      setPending(false);
    }
  };

  return (
    <div className='vx dark relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-12 text-foreground'>
      <AnimatePresence>{showIntro && <Intro key='intro' onDone={finishIntro} />}</AnimatePresence>

      {/* the sign-in modal */}
      <motion.div
        className='relative flex w-full max-w-[400px] flex-col items-center'
        initial={{ opacity: 0, y: 10 }}
        animate={showIntro ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: showIntro ? 0 : 0.1, ease: [0.2, 0.7, 0.2, 1] }}
      >
        {/* the brand sits above the card, large */}
        <motion.img
          src={brand.logoDark}
          alt='Protoform Vector'
          className='mb-10 h-[72px] w-auto select-none'
          draggable={false}
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={showIntro ? { opacity: 0, y: -12, scale: 0.96 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: showIntro ? 0 : 0.1, ease: [0.2, 0.7, 0.2, 1] }}
        />

        <motion.main
          role='dialog'
          aria-label='Sign in'
          className='relative w-full border border-border bg-card p-8 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95)]'
          initial={{ opacity: 0, y: 24, clipPath: 'inset(0 0 100% 0)' }}
          animate={showIntro ? { opacity: 0, y: 24, clipPath: 'inset(0 0 100% 0)' } : { opacity: 1, y: 0, clipPath: 'inset(-8px -8px -8px -8px)' }}
          transition={{ duration: 0.6, delay: showIntro ? 0 : 0.2, ease: [0.2, 0.7, 0.2, 1] }}
        >
        {/* corner ticks */}
        {['-top-1.5 -left-1.5 border-t border-l', '-top-1.5 -right-1.5 border-t border-r', '-bottom-1.5 -left-1.5 border-b border-l', '-right-1.5 -bottom-1.5 border-r border-b'].map(
          (position) => (
            <span key={position} aria-hidden className={`pointer-events-none absolute size-3 border-accent ${position}`} />
          ),
        )}

        <h1 className='text-xl font-semibold tracking-tight'>Sign in</h1>
        <p className='mt-1.5 text-sm text-muted-foreground'>Use your Vector account to manage your fleet.</p>

        <form onSubmit={onSubmit} className='mt-7 grid gap-5' noValidate>
          <div className='grid gap-2'>
            <Label htmlFor='vx-username'>Username or email</Label>
            <Input
              id='vx-username'
              name='username'
              autoComplete='username'
              autoFocus
              placeholder='admin@example.com'
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-invalid={Boolean(error) || undefined}
              disabled={pending}
            />
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='vx-password'>Password</Label>
            <div className='relative'>
              <Input
                id='vx-password'
                name='password'
                type={reveal ? 'text' : 'password'}
                autoComplete='current-password'
                placeholder='Enter your password'
                className='pr-11'
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))}
                onBlur={() => setCapsLock(false)}
                aria-invalid={Boolean(error) || undefined}
                disabled={pending}
              />
              <button
                type='button'
                onClick={() => setReveal((value) => !value)}
                className='absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground'
                aria-label={reveal ? 'Hide password' : 'Show password'}
              >
                {reveal ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
              </button>
            </div>
            {capsLock && <p className='text-xs text-warning'>Caps Lock is on.</p>}
          </div>

          <div aria-live='polite'>
            <AnimatePresence initial={false}>
              {error && (
                <motion.div
                  key={error}
                  role='alert'
                  className='flex items-start gap-2.5 border border-destructive/40 px-3.5 py-3 text-[13px] text-destructive'
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto', x: [0, -8, 8, -5, 5, 0] }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35, x: { duration: 0.4, delay: 0.1 } }}
                >
                  <AlertCircle className='mt-px size-4 shrink-0' aria-hidden />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button type='submit' variant='accent' size='lg' disabled={pending} className='w-full'>
            {pending ? (
              <>
                <Loader2 className='animate-spin' aria-hidden /> Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <p className='mt-7 border-t border-border pt-5 text-center font-mono text-[10.5px] tracking-wider text-muted-foreground/80 uppercase'>
          {brand.company} {brand.name}
        </p>
        </motion.main>
      </motion.div>
    </div>
  );
};

export default Login;
