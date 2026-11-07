import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { brand } from '../brand';

const INTRO_MS = 3000;

/** Full-screen brand intro. Click or press any key to skip. */
const Intro: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  useEffect(() => {
    const timer = window.setTimeout(onDone, INTRO_MS);
    const skip = () => onDone();
    window.addEventListener('keydown', skip);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', skip);
    };
  }, [onDone]);

  return (
    <motion.div
      className='vx dark fixed inset-0 z-[2000] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-background'
      onClick={onDone}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      role='presentation'
    >
      {/* grid */}
      <motion.div
        aria-hidden
        className='absolute inset-0'
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 55% 50% at 50% 50%, #000 15%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 55% 50% at 50% 50%, #000 15%, transparent 75%)',
        }}
      />

      {/* expanding diamond outlines, echoing the mark */}
      <div aria-hidden className='absolute size-40 rotate-45 border border-accent/50 animate-pulse-ring' />
      <div aria-hidden className='absolute size-40 rotate-45 border border-white/10' />

      {/* lockup, revealed with a left-to-right wipe */}
      <motion.img
        src={brand.logoDark}
        alt='Protoform Vector'
        className='relative w-[min(540px,80vw)] select-none'
        draggable={false}
        initial={{ clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: 'inset(0 0% 0 0)' }}
        transition={{ duration: 1, delay: 0.3, ease: [0.65, 0, 0.35, 1] }}
      />

      <motion.p
        className='relative mt-8 font-mono text-[11px] tracking-[0.34em] text-muted-foreground uppercase'
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.3 }}
      >
        Command your fleet
      </motion.p>

      {/* progress + skip */}
      <div className='absolute bottom-14 flex flex-col items-center gap-3'>
        <div className='h-px w-52 overflow-hidden bg-white/10'>
          <motion.div
            className='h-full origin-left bg-accent'
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: INTRO_MS / 1000 - 0.3, ease: 'linear' }}
          />
        </div>
        <span className='font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase'>Click or press any key to skip</span>
      </div>
    </motion.div>
  );
};

export default Intro;
