import React, { HTMLAttributes, forwardRef } from 'react';

/* ── Card ─────────────────────────────────────────────────────── */
const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`rounded-sm border border-slate-200 bg-white text-slate-800 shadow-xs ${className}`}
      {...props}
    />
  )
);
Card.displayName = 'Card';

/* ── CardHeader ───────────────────────────────────────────────── */
const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`flex flex-col space-y-1 p-4 md:p-5 border-b border-slate-100 rounded-t-sm ${className}`}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

/* ── CardTitle ────────────────────────────────────────────────── */
const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', ...props }, ref) => (
    <h3
      ref={ref}
      className={`text-base font-semibold leading-snug text-slate-800 ${className}`}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

/* ── CardContent ──────────────────────────────────────────────── */
const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`p-4 md:p-5 ${className}`}
      {...props}
    />
  )
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardContent };
