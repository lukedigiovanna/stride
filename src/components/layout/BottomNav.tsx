import { NavLink } from 'react-router-dom';
import { Home, Dumbbell, History, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/',           label: 'Home',      Icon: Home     },
  { to: '/exercises',  label: 'Exercises', Icon: Dumbbell },
  { to: '/history',    label: 'History',   Icon: History  },
  { to: '/profile',    label: 'Profile',   Icon: User     },
] as const;

/**
 * Fixed bottom navigation bar. Always visible on protected routes.
 *
 * - Active tab: amber accent (text-primary)
 * - Inactive tabs: muted text
 * - `pb-[env(safe-area-inset-bottom)]` clears the iPhone home indicator
 */
export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t-2 border-foreground/20"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-16">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className="h-5 w-5"
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                <span className={cn('text-[10px] tracking-wide', isActive ? 'font-bold' : 'font-normal')}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
