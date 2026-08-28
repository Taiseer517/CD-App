import { NavLink } from 'react-router-dom'
import { SoundToggle } from './SoundToggle'

const links = [
  { to: '/', label: 'Collection', end: true },
  { to: '/shelf', label: 'The Wall' },
  { to: '/add', label: 'Add' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/shuffle', label: 'Shuffle' },
  { to: '/stats', label: 'Stats' },
  { to: '/admin', label: 'Admin' },
]

export function NavBar() {
  return (
    <nav className="relative flex items-center justify-center gap-1 border-b border-void-700 bg-void-900/60 px-6 py-3">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            `rounded-md px-4 py-1.5 text-sm uppercase tracking-wide transition-colors ${
              isActive
                ? 'bg-blood-900/60 text-bone-100'
                : 'text-bone-400 hover:bg-void-800 hover:text-bone-200'
            }`
          }
        >
          {link.label}
        </NavLink>
      ))}
      <span className="absolute right-6">
        <SoundToggle />
      </span>
    </nav>
  )
}
