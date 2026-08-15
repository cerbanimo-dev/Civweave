export const SCREENS = Object.freeze({
  home: { id: 'home', label: 'Civweave', href: '/app/campus.html#home' },
  weave: { id: 'weave', label: 'Weave', href: '/app/campus.html#weave' },
  progress: { id: 'progress', label: 'Progress', href: '/app/campus.html#progress' },
  library: { id: 'library', label: 'Library', href: '/app/campus.html#library' },
  livingSchool: { id: 'living-school', label: 'Living School', href: '/app/living-school.html' },
  cerbanimo: { id: 'cerbanimo', label: 'Cerbanimo', href: '/app/cerbanimo.html' },
  fellowfare: { id: 'fellowfare', label: 'FellowFare', href: '/app/fellowfare.html' },
  anarchadia: { id: 'anarchadia', label: 'Anarchadia', href: '/app/anarchadia.html' },
  settings: { id: 'settings', label: 'AI settings', href: '/app/settings.html' },
  downloads: { id: 'downloads', label: 'Install & downloads', href: '/app/downloads.html' },
  weaveling: { id: 'chat-weaveling', label: 'Weaveling', href: '/app/chat.html?guide=weaveling' },
  moss: { id: 'chat-moss', label: 'Moss', href: '/app/chat.html?guide=moss' },
  kamiya: { id: 'chat-kamiya', label: 'Kamiya', href: '/app/chat.html?guide=kamiya' },
  rook: { id: 'chat-rook', label: 'Rook', href: '/app/chat.html?guide=rook' },
  merlin: { id: 'chat-merlin', label: 'Merlin', href: '/app/chat.html?guide=merlin' },
  recovery: { id: 'recovery', label: 'Merlin recovery', href: '/app/recovery/' }
});

export const GUIDES = Object.freeze({
  weaveling: { system: 'civweave', name: 'Weaveling', avatar: '/app/assets/ai/weaveling.png', role: 'Central mirror and planner' },
  moss: { system: 'living-school', name: 'Moss', avatar: '/app/assets/ai/moss.png', role: 'Learning guide' },
  kamiya: { system: 'cerbanimo', name: 'Kamiya', avatar: '/app/assets/ai/kamiya.png', role: 'Work and quest guide' },
  rook: { system: 'fellowfare', name: 'Rook', avatar: '/app/assets/ai/rook.png', role: 'Exchange guide' },
  merlin: { system: 'anarchadia', name: 'Merlin', avatar: '/app/assets/ai/merlin.png', role: 'Civic and customization guide' }
});

export function screen(id) { return SCREENS[id] || null; }
export function guide(id) { return GUIDES[id] || GUIDES.weaveling; }
export function screenUrl(id) { return screen(id)?.href || SCREENS.home.href; }
export const CANONICAL_SCREEN_COUNT = Object.keys(SCREENS).length;
