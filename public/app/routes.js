const freezeList = values => Object.freeze([...values]);

export const SYSTEMS = Object.freeze({
  civweave: { id: 'civweave', label: 'Civweave', guide: 'weaveling' },
  'living-school': { id: 'living-school', label: 'Living School', guide: 'moss' },
  cerbanimo: { id: 'cerbanimo', label: 'Cerbanimo', guide: 'kamiya' },
  fellowfare: { id: 'fellowfare', label: 'FellowFare', guide: 'rook' },
  anarchadia: { id: 'anarchadia', label: 'Anarchadia', guide: 'merlin' }
});

export const GUIDES = Object.freeze({
  weaveling: { system: 'civweave', name: 'Weaveling', avatar: '/app/assets/ai/weaveling.png', role: 'Central mirror and planner' },
  moss: { system: 'living-school', name: 'Moss', avatar: '/app/assets/ai/moss.png', role: 'Learning guide' },
  kamiya: { system: 'cerbanimo', name: 'Kamiya', avatar: '/app/assets/ai/kamiya.png', role: 'Work and quest guide' },
  rook: { system: 'fellowfare', name: 'Rook', avatar: '/app/assets/ai/rook.png', role: 'Exchange guide' },
  merlin: { system: 'anarchadia', name: 'Merlin', avatar: '/app/assets/ai/merlin.png', role: 'Civic and customization guide' }
});

export const SCREENS = Object.freeze({
  home: {
    id: 'home', label: 'Civweave', href: '/app/campus.html#home', kind: 'campus-view',
    system: 'civweave', guide: 'weaveling', parent: null, owner: 'campus', offline: true
  },
  weave: {
    id: 'weave', label: 'Weave', href: '/app/campus.html#weave', kind: 'campus-view',
    system: 'civweave', guide: 'weaveling', parent: 'home', owner: 'campus', offline: true
  },
  progress: {
    id: 'progress', label: 'Progress', href: '/app/campus.html#progress', kind: 'campus-view',
    system: 'civweave', guide: 'weaveling', parent: 'home', owner: 'campus', offline: true
  },
  library: {
    id: 'library', label: 'Library', href: '/app/campus.html#library', kind: 'campus-view',
    system: 'civweave', guide: 'weaveling', parent: 'home', owner: 'campus', offline: true
  },
  livingSchool: {
    id: 'living-school', label: 'Living School', href: '/app/living-school.html', kind: 'realm',
    system: 'living-school', guide: 'moss', parent: 'home', owner: 'realm', offline: true
  },
  cerbanimo: {
    id: 'cerbanimo', label: 'Cerbanimo', href: '/app/cerbanimo.html', kind: 'realm',
    system: 'cerbanimo', guide: 'kamiya', parent: 'home', owner: 'realm', offline: true
  },
  fellowfare: {
    id: 'fellowfare', label: 'FellowFare', href: '/app/fellowfare.html', kind: 'realm',
    system: 'fellowfare', guide: 'rook', parent: 'home', owner: 'realm', offline: true
  },
  anarchadia: {
    id: 'anarchadia', label: 'Anarchadia', href: '/app/anarchadia.html', kind: 'realm',
    system: 'anarchadia', guide: 'merlin', parent: 'home', owner: 'realm', offline: true
  },
  settings: {
    id: 'settings', label: 'AI settings', href: '/app/settings.html', kind: 'utility',
    system: 'civweave', guide: 'weaveling', parent: 'home', owner: 'settings', offline: true
  },
  downloads: {
    id: 'downloads', label: 'Install & downloads', href: '/app/downloads.html', kind: 'utility',
    system: 'civweave', guide: 'weaveling', parent: 'home', owner: 'downloads', offline: true
  },
  weaveling: {
    id: 'chat-weaveling', label: 'Weaveling', href: '/app/chat.html?guide=weaveling', kind: 'guide-chat',
    system: 'civweave', guide: 'weaveling', parent: 'home', owner: 'chat', offline: true
  },
  moss: {
    id: 'chat-moss', label: 'Moss', href: '/app/chat.html?guide=moss', kind: 'guide-chat',
    system: 'living-school', guide: 'moss', parent: 'living-school', owner: 'chat', offline: true
  },
  kamiya: {
    id: 'chat-kamiya', label: 'Kamiya', href: '/app/chat.html?guide=kamiya', kind: 'guide-chat',
    system: 'cerbanimo', guide: 'kamiya', parent: 'cerbanimo', owner: 'chat', offline: true
  },
  rook: {
    id: 'chat-rook', label: 'Rook', href: '/app/chat.html?guide=rook', kind: 'guide-chat',
    system: 'fellowfare', guide: 'rook', parent: 'fellowfare', owner: 'chat', offline: true
  },
  merlin: {
    id: 'chat-merlin', label: 'Merlin', href: '/app/chat.html?guide=merlin', kind: 'guide-chat',
    system: 'anarchadia', guide: 'merlin', parent: 'anarchadia', owner: 'chat', offline: true
  },
  recovery: {
    id: 'recovery', label: 'Merlin recovery', href: '/app/recovery/', kind: 'recovery',
    system: 'anarchadia', guide: 'merlin', parent: 'anarchadia', owner: 'recovery', offline: true,
    isolated: true
  }
});

export const SCREEN_ORDER = freezeList([
  'home', 'weave', 'progress', 'library',
  'living-school', 'cerbanimo', 'fellowfare', 'anarchadia',
  'settings', 'downloads',
  'chat-weaveling', 'chat-moss', 'chat-kamiya', 'chat-rook', 'chat-merlin',
  'recovery'
]);

export const SCREEN_GROUPS = Object.freeze({
  campus: freezeList(['home', 'weave', 'progress', 'library']),
  realms: freezeList(['living-school', 'cerbanimo', 'fellowfare', 'anarchadia']),
  utilities: freezeList(['settings', 'downloads']),
  guides: freezeList(['chat-weaveling', 'chat-moss', 'chat-kamiya', 'chat-rook', 'chat-merlin']),
  recovery: freezeList(['recovery'])
});

const campusNeighbors = freezeList([
  'home', 'weave', 'progress', 'library',
  'living-school', 'cerbanimo', 'fellowfare', 'anarchadia',
  'settings', 'downloads', 'chat-weaveling'
]);
const guideNeighbors = parent => freezeList([
  parent, 'settings', 'chat-weaveling', 'chat-moss', 'chat-kamiya', 'chat-rook', 'chat-merlin'
]);

export const NAVIGATION = Object.freeze({
  home: campusNeighbors,
  weave: campusNeighbors,
  progress: campusNeighbors,
  library: campusNeighbors,
  'living-school': freezeList(['home', 'chat-moss', 'settings']),
  cerbanimo: freezeList(['home', 'chat-kamiya', 'settings']),
  fellowfare: freezeList(['home', 'chat-rook', 'settings']),
  anarchadia: freezeList(['home', 'chat-merlin', 'recovery']),
  settings: freezeList(['home', 'downloads', 'chat-weaveling']),
  downloads: freezeList(['home', 'settings', 'chat-weaveling']),
  'chat-weaveling': guideNeighbors('home'),
  'chat-moss': guideNeighbors('living-school'),
  'chat-kamiya': guideNeighbors('cerbanimo'),
  'chat-rook': guideNeighbors('fellowfare'),
  'chat-merlin': guideNeighbors('anarchadia'),
  recovery: freezeList(['home'])
});

export const SITEMAP = Object.freeze({
  root: 'home',
  screenOrder: SCREEN_ORDER,
  groups: SCREEN_GROUPS,
  navigation: NAVIGATION,
  recovery: 'recovery'
});

export function screen(id) {
  return Object.values(SCREENS).find(candidate => candidate.id === id) || SCREENS[id] || null;
}

export function guide(id) {
  return GUIDES[id] || GUIDES.weaveling;
}

export function screenUrl(id) {
  return screen(id)?.href || SCREENS.home.href;
}

export function neighbors(id) {
  return (NAVIGATION[id] || []).map(screen).filter(Boolean);
}

export function parentScreen(id) {
  const parent = screen(id)?.parent;
  return parent ? screen(parent) : null;
}

export function pathToRoot(id) {
  const path = [];
  const seen = new Set();
  let current = screen(id);
  while (current && !seen.has(current.id)) {
    path.unshift(current);
    seen.add(current.id);
    current = current.parent ? screen(current.parent) : null;
  }
  return path;
}

export const CANONICAL_SCREEN_COUNT = Object.keys(SCREENS).length;
