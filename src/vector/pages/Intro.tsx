import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { brand } from '../brand';

const INTRO_MS = 2200;

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
      initial={{ opacity: 1, clipPath: 'polygon(50% -60%, 160% 50%, 50% 160%, -60% 50%)' }}
      exit={{ clipPath: 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)' }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
      role='presentation'
    >
      {/* expanding diamond outlines, echoing the mark */}
      <motion.div
        aria-hidden
        className='absolute size-40 rotate-45 border border-white/10'
        initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
        animate={{ opacity: 1, scale: 1, rotate: 45 }}
        transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }}
      />
      <motion.div
        aria-hidden
        className='absolute size-64 rotate-45 border border-white/5'
        initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
        animate={{ opacity: 1, scale: 1, rotate: 45 }}
        transition={{ duration: 1.3, delay: 0.1, ease: [0.2, 0.7, 0.2, 1] }}
      />
      <div aria-hidden className='absolute size-40 rotate-45 animate-pulse-ring border border-accent/50 [animation-delay:0.6s]' />

      {/* soft accent glow behind the lockup */}
      <motion.div
        aria-hidden
        className='absolute h-48 w-[min(540px,80vw)] rounded-full bg-accent/20 blur-[90px]'
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0.5] }}
        transition={{ duration: 2, delay: 0.2, times: [0, 0.4, 1] }}
      />

      {/* lockup: wipe reveal with a rising blur-to-sharp settle, then a light sweep */}
      <motion.div
        className='relative w-[min(540px,80vw)] overflow-hidden'
        initial={{ clipPath: 'inset(0 100% 0 0)', y: 8, filter: 'blur(8px)' }}
        animate={{ clipPath: 'inset(0 0% 0 0)', y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.9, delay: 0.25, ease: [0.65, 0, 0.35, 1] }}
      >
        <img src={brand.logoDark} alt='Protoform Vector' className='block w-full select-none' draggable={false} />
        <motion.div
          aria-hidden
          className='pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent'
          initial={{ left: '-40%' }}
          animate={{ left: '120%' }}
          transition={{ duration: 0.8, delay: 1.1, ease: 'easeInOut' }}
        />
      </motion.div>

      <motion.p
        className='relative mt-8 font-mono text-[11px] text-muted-foreground uppercase'
        initial={{ opacity: 0, letterSpacing: '0.6em', y: 6 }}
        animate={{ opacity: 1, letterSpacing: '0.34em', y: 0 }}
        transition={{ duration: 0.9, delay: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
      >
        Command your fleet
      </motion.p>
    </motion.div>
  );
};

export default Intro;
