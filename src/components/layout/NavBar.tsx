import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Collection', end: true },
  { to: '/shelf', label: 'Shelf' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/stats', label: 'Stats' },
  { to: '/admin', label: 'Admin' },
]

export function NavBar() {
  return (
    <nav className="flex justify-center gap-1 border-b border-void-700 bg-void-900/60 px-6 py-3">
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
    </nav>
  )
}
