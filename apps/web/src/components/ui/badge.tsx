import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-blue-600 text-white shadow hover:bg-blue-600/80',
        secondary:
          'border-transparent bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-200',
        destructive:
          'border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
        outline:
          'border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300',
        glass:
          'glass-panel border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200',
        success:
          'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        primary:
          'border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
