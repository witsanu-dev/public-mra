import React, { InputHTMLAttributes, forwardRef } from 'react';
import { Search } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  isSearchable?: boolean;
}

/**
 * Responsive Input component.
 * — h-10 on desktop, h-11 on mobile to meet WCAG 2.5.5 (44px touch target)
 * — Full-width by default
 * — Accessible: inherits label association via id/htmlFor on the wrapping div
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', icon, isSearchable, ...props }, ref) => {
    const hasIcon = !!(icon || isSearchable);
    return (
      <div className="relative flex items-center w-full">
        {hasIcon && (
          <div className="absolute left-3 text-slate-400 pointer-events-none" aria-hidden="true">
            {isSearchable ? <Search size={16} /> : icon}
          </div>
        )}
        <input
          ref={ref}
          className={[
            'flex w-full rounded-sm border border-slate-300 bg-white',
            // Touch-friendly height: h-11 (44px) on mobile, h-10 on sm+
            'h-11 sm:h-10',
            'px-3 py-2 text-sm text-slate-900',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500',
            'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-75',
            'transition-colors',
            hasIcon ? 'pl-9' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
