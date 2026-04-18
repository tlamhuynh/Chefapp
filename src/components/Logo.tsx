import React from 'react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  size?: number;
  variant?: 'default' | 'white' | 'stone';
}

export function Logo({ className, size = 32, variant = 'default' }: LogoProps) {
  const colors = {
    default: {
      hat: 'fill-neutral-900',
      spark: 'fill-neutral-900',
      accent: 'fill-neutral-200'
    },
    white: {
      hat: 'fill-white',
      spark: 'fill-white/80',
      accent: 'fill-white/20'
    },
    stone: {
      hat: 'fill-neutral-800',
      spark: 'fill-neutral-900',
      accent: 'fill-neutral-100'
    }
  };

  const selected = colors[variant];

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn("transition-all duration-300", className)}
    >
      {/* Minimalist Chef Hat Base */}
      <rect x="25" y="65" width="50" height="15" rx="4" className={selected.hat} />
      
      {/* Minimalist Chef Hat Top (Three circles simplified into a single pill/cloud shape) */}
      <circle cx="35" cy="45" r="18" className={selected.hat} />
      <circle cx="50" cy="35" r="20" className={selected.hat} />
      <circle cx="65" cy="45" r="18" className={selected.hat} />
      <rect x="30" y="45" width="40" height="25" className={selected.hat} />

      {/* AI Sparkle / Dot */}
      <circle cx="75" cy="25" r="6" className={selected.spark} />
      <circle cx="82" cy="35" r="3" className={selected.spark} opacity="0.6" />
      
      {/* Subtle detail on the hat base */}
      <rect x="30" y="70" width="40" height="2" rx="1" className={selected.accent} opacity="0.3" />
    </svg>
  );
}

export function LogoText({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo size={24} />
      <span className="font-display font-semibold text-xl tracking-tight text-neutral-900">
        SousChef<span className="font-normal italic ml-0.5 opacity-60">AI</span>
      </span>
    </div>
  );
}
