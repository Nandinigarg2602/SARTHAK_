import { NavLink } from 'react-router-dom';
import { Home, Pill, LayoutDashboard, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export function NavigationBar() {
  const { t } = useTranslation();
  const { isCaregiver } = useAuth();

  const navItems = isCaregiver
    ? [
        { to: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard', 'Dashboard') },
        { to: '/settings', icon: Settings, label: t('nav.settings', 'Settings') },
      ]
    : [
        { to: '/companion', icon: Home, label: t('nav.companion', 'Companion') },
        { to: '/medications', icon: Pill, label: t('nav.medications', 'Medications') },
        { to: '/settings', icon: Settings, label: t('nav.settings', 'Settings') },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-surface-200 shadow-lg safe-bottom">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-2xl min-w-[70px] min-h-[50px] transition-all duration-200 ${
                isActive
                  ? 'text-sarthak-800 bg-sarthak-100 font-bold shadow-2xs'
                  : 'text-surface-700 hover:text-surface-900 hover:bg-surface-100 font-semibold'
              }`
            }
          >
            <Icon size={22} className="stroke-[2.2]" />
            <span className="text-xs font-semibold tracking-tight">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
