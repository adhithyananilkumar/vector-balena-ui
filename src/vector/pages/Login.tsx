import React, { useCallback, useState } from 'react';
import { useLogin } from 'react-admin';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Eye, EyeOff, Loader2, ShieldCheck, TerminalSquare, Waypoints } from 'lucide-react';
import { brand } from '../brand';
import { Button } from '../components/button';
import { TopologyDoodle } from '../components/doodles';
import { Input } from '../components/input';
import { Label } from '../components/label';
import Intro from './Intro';

const INTRO_SEEN_KEY = 'vector:intro-seen';

const readIntroSeen = (): boolean => {
  try {
    return window.sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const features = [
  { icon: Waypoints, title: 'One fleet, every device', text: 'Provision, group and update devices over the air.' },
  { icon: TerminalSquare, title: 'Secure remote access', text: 'Terminals and file transfer, right in your browser.' },
  { icon: ShieldCheck, title: 'Role-based control', text: 'Organization-scoped admins and audited access.' },
];

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
  const [showIntro, setShowIntro] = useState<boolean>(() => !readIntroSeen() && !prefersReducedMotion());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishIntro = useCallback(() => {
    try {
      window.sessionStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {
      // storage can be unavailable (private mode); the intro simply replays next load
    }
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
    <div className='vx dark relative min-h-screen bg-background text-foreground'>
      <AnimatePresence>{showIntro && <Intro key='intro' onDone={finishIntro} />}</AnimatePresence>

      <div className='grid min-h-screen lg:h-screen lg:grid-cols-[1.1fr_1fr]'>
        {/* brand panel */}
        <aside className='relative hidden overflow-hidden border-r border-border bg-card lg:flex lg:h-screen lg:flex-col lg:p-12'>
          <div
            aria-hidden
            className='absolute inset-0'
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />

          <img src={brand.logoDark} alt='Protoform Vector' className='relative h-12 w-auto shrink-0 self-start' />

          <div className='relative flex min-h-0 flex-1 items-center justify-center py-6'>
            <TopologyDoodle className='block h-full max-h-[420px] w-full max-w-[560px] text-foreground/60' />
          </div>

          <div className='relative shrink-0'>
            <h2 className='max-w-lg text-balance text-[1.75rem] leading-[1.2] font-semibold tracking-tight'>
              Run every device in your fleet from one place.
            </h2>
            <ul className='mt-7 grid gap-4 border-t border-border pt-6'>
              {features.map(({ icon: Icon, title, text }) => (
                <li key={title} className='flex items-start gap-3.5'>
                  <span className='mt-0.5 grid size-8 shrink-0 place-items-center border border-border'>
                    <Icon className='size-4 text-accent' aria-hidden />
                  </span>
                  <span>
                    <span className='block text-[13px] font-medium'>{title}</span>
                    <span className='block text-xs text-muted-foreground'>{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* form panel */}
        <main className='relative flex items-center justify-center px-6 py-12 lg:h-screen lg:overflow-y-auto'>
          <motion.div
            className='relative w-full max-w-[380px]'
            initial={{ opacity: 0, y: 10 }}
            animate={showIntro ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: showIntro ? 0 : 0.1, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <img src={brand.logoDark} alt='Protoform Vector' className='mb-10 h-11 w-auto lg:hidden' />

            <p className='font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase'>Sign in</p>
            <h1 className='mt-2 text-[1.6rem] font-semibold tracking-tight'>Welcome back</h1>
            <p className='mt-2 text-sm text-muted-foreground'>Sign in to your Vector account to manage your fleet.</p>

            <form onSubmit={onSubmit} className='mt-8 grid gap-5' noValidate>
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
                {error && (
                  <div role='alert' className='flex items-start gap-2.5 border border-destructive/40 px-3.5 py-3 text-[13px] text-destructive'>
                    <AlertCircle className='mt-px size-4 shrink-0' aria-hidden />
                    <span>{error}</span>
                  </div>
                )}
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

            <p className='mt-10 border-t border-border pt-5 text-center font-mono text-[10.5px] tracking-wider text-muted-foreground/80 uppercase'>
              {brand.company} {brand.name} · Role-based access
            </p>
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Login;
