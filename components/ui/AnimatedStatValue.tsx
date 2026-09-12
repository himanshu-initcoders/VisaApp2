'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedStatValueProps {
  value: string;
  className?: string;
}

export function AnimatedStatValue({ value, className }: AnimatedStatValueProps) {
  const reduceMotion = useReducedMotion();

  return (
    <span className={cn('relative inline-grid', className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={value}
          initial={reduceMotion ? false : { opacity: 0, y: 8, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8, filter: 'blur(4px)' }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="col-start-1 row-start-1 inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
