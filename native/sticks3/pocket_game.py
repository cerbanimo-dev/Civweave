"""Small deterministic creature game; no clock, network, model, or Quest authority.

The device owns button timing and rendering. This module owns game state and
returns explicit communicator intents for the existing link adapter to handle.
All resources are local play values with no real-world reward or currency value.
"""

SAVE_VERSION = 1
MAX_ENERGY = 10
MAX_BERRIES = 99
MAX_BOND = 100
MAX_STEPS = 999999

CREATURES = {
    "mothbit": "Mothbit",
    "glowfin": "Glowfin",
    "pebblehop": "Pebblehop",
    "breezelet": "Breezelet",
}
_TRAIL_FRIENDS = ("glowfin", "pebblehop", "breezelet")
_SAVE_KEYS = ("version", "active", "collection", "energy", "berries", "bond", "steps", "cursor")
_MENUS = {
    "home": ("Explore", "Care", "Collection", "Link"),
    "trail": ("Walk", "Rest", "Home"),
    "encounter": ("Befriend", "Leave"),
    "care": ("Feed", "Play", "Rest", "Home"),
    "link": ("Query status", "Draft note", "Dismiss"),
}
_TITLES = {
    "home": "Pocket Companions",
    "trail": "Little Trail",
    "care": "Companion Care",
    "collection": "Companions",
    "link": "Communicator",
}
_NOTE_PRESET = "Hello from my pocket companion."


def _integer(value, maximum):
    # bool is an int subclass on Python; accepting it would blur the save schema.
    return type(value) is int and 0 <= value <= maximum


def validate_saved(saved):
    """Return an independent, bounded v1 game dict, or None for invalid data.

    Reject the entire record rather than partially accepting unknown versions or
    silently clamping corrupt progress. SaveStore can then recover the other slot.
    """
    if type(saved) is not dict or len(saved) != len(_SAVE_KEYS):
        return None
    for key in _SAVE_KEYS:
        if key not in saved:
            return None
    if type(saved["version"]) is not int or saved["version"] != SAVE_VERSION:
        return None
    for key, maximum in (("energy", MAX_ENERGY), ("berries", MAX_BERRIES),
                         ("bond", MAX_BOND), ("steps", MAX_STEPS), ("cursor", 5)):
        if not _integer(saved[key], maximum):
            return None
    collection = saved["collection"]
    if type(collection) is not list or not 1 <= len(collection) <= len(CREATURES):
        return None
    seen = []
    for creature in collection:
        if type(creature) is not str or creature not in CREATURES or creature in seen:
            return None
        seen.append(creature)
    if "mothbit" not in seen:
        return None
    active = saved["active"]
    if type(active) is not str or active not in seen:
        return None
    return {
        "version": SAVE_VERSION,
        "active": active,
        "collection": seen,
        "energy": saved["energy"],
        "berries": saved["berries"],
        "bond": saved["bond"],
        "steps": saved["steps"],
        "cursor": saved["cursor"],
    }


class Game:
    """One authoritative local game state driven by next, select, and back."""

    def __init__(self, saved=None):
        self._data = validate_saved(saved)
        if self._data is None:
            self._data = {
                "version": SAVE_VERSION,
                "active": "mothbit",
                "collection": ["mothbit"],
                "energy": 8,
                "berries": 3,
                "bond": 0,
                "steps": 0,
                "cursor": 0,
            }
        self._screen = "home"
        self._selection = 0
        self._encounter = None
        self._notice = "Ready for a little adventure."

    def _options(self):
        if self._screen == "collection":
            return [CREATURES[creature] for creature in self._data["collection"]] + ["Home"]
        return list(_MENUS[self._screen])

    def _show(self, screen, notice="", encounter=None):
        self._screen = screen
        self._selection = 0
        self._notice = notice
        self._encounter = encounter

    def snapshot(self):
        """Return a small rendering value with no references into mutable state."""
        data = self._data
        title = CREATURES[self._encounter] if self._encounter else _TITLES[self._screen]
        return {
            "screen": self._screen,
            "selection": self._selection,
            "title": title,
            "options": self._options(),
            "notice": self._notice,
            "active": {"id": data["active"], "name": CREATURES[data["active"]]},
            "energy": data["energy"],
            "berries": data["berries"],
            "bond": data["bond"],
            "collection": list(data["collection"]),
            "encounter": self._encounter,
            "steps": data["steps"],
        }

    def export(self):
        """Persist progress only; scenes, drafts, peers and link state are transient."""
        return validate_saved(self._data)

    def _rest(self):
        self._data["energy"] = MAX_ENERGY
        self._notice = "Rested and ready."

    def _walk(self):
        data = self._data
        if not data["energy"]:
            self._notice = "Time to rest. Rest is always free."
            return
        data["energy"] -= 1
        data["steps"] = min(MAX_STEPS, data["steps"] + 1)
        # A separate small cursor keeps exploration working after steps saturates.
        data["cursor"] = (data["cursor"] + 1) % 6
        if data["cursor"] % 2:
            if data["berries"] < MAX_BERRIES:
                data["berries"] += 1
                self._notice = "Found a berry for your companions."
            else:
                self._notice = "The berry pouch is full."
            return
        friend = _TRAIL_FRIENDS[(data["cursor"] // 2 - 1) % len(_TRAIL_FRIENDS)]
        self._show("encounter", "A little companion says hello.", friend)

    def _befriend(self):
        data = self._data
        friend = self._encounter
        if friend not in data["collection"]:
            data["collection"].append(friend)
            data["bond"] = min(MAX_BOND, data["bond"] + 3)
            notice = CREATURES[friend] + " joined your companions."
        else:
            data["bond"] = min(MAX_BOND, data["bond"] + 1)
            notice = CREATURES[friend] + " enjoyed the visit."
        self._show("trail", notice)

    def _care(self, option):
        data = self._data
        if option == "Rest":
            self._rest()
        elif option == "Feed":
            if not data["berries"]:
                self._notice = "No berries. Explore to find some."
            else:
                data["berries"] -= 1
                data["energy"] = min(MAX_ENERGY, data["energy"] + 2)
                data["bond"] = min(MAX_BOND, data["bond"] + 2)
                self._notice = "A berry shared. A happy companion."
        elif option == "Play":
            if not data["energy"]:
                self._notice = "Rest first, then play again."
            else:
                data["energy"] -= 1
                data["bond"] = min(MAX_BOND, data["bond"] + 3)
                self._notice = "A little game of chase."

    def input(self, action):
        """Apply one semantic action and return only explicit communicator intents.

        Physical button repeat/hold handling belongs to the device adapter. There
        are no timers or absence penalties, and back never issues a link command.
        """
        if action not in ("next", "select", "back"):
            raise ValueError("Expected next, select, or back")
        if action == "back":
            self._show("home")
            return []
        options = self._options()
        if action == "next":
            self._selection = (self._selection + 1) % len(options)
            return []
        option = options[self._selection]
        if option == "Home":
            self._show("home")
        elif self._screen == "home":
            screen = ("trail", "care", "collection", "link")[self._selection]
            notice = "Local actions; drafts stay unsent." if screen == "link" else ""
            self._show(screen, notice)
        elif self._screen == "trail":
            if option == "Walk":
                self._walk()
            else:
                self._rest()
        elif self._screen == "encounter":
            if option == "Befriend":
                self._befriend()
            else:
                self._show("trail", "Wave goodbye. You can meet again.")
        elif self._screen == "care":
            self._care(option)
        elif self._screen == "collection":
            self._data["active"] = self._data["collection"][self._selection]
            self._notice = option + " is your walking companion."
        elif self._screen == "link":
            if option == "Query status":
                self._notice = "Status query requested."
                return [{"type": "query"}]
            if option == "Draft note":
                self._notice = "Local draft - unsent."
                return [{"type": "note_draft", "text": _NOTE_PRESET}]
            self._show("home", "Communicator card dismissed.")
            return [{"type": "dismiss"}]
        return []
