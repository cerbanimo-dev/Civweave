"""Original, offline companion loop. Time away never harms the companion."""

COMPANIONS = ("Mossling", "Emberbit", "Tidefin")
TREASURES = ("Moon seed", "Harbor shell", "Violet ribbon")
ACTIONS = ("care", "train", "explore", "rest")


def _bounded_int(value, low, high):
    return type(value) is int and low <= value <= high


class Game:
    def __init__(self, companion="Mossling"):
        if companion not in COMPANIONS:
            raise ValueError("Choose Mossling, Emberbit or Tidefin")
        self.companion = companion
        self.bond = 50
        self.energy = 80
        self.xp = 0
        self.steps = 0
        self.discoveries = []

    @property
    def level(self):
        return min(50, 1 + self.xp // 80)

    def act(self, action):
        if action not in ACTIONS:
            raise ValueError("Unknown companion action")
        previous_level = self.level
        ok = True
        if action == "care":
            self.bond = min(100, self.bond + 6)
            self.energy = min(100, self.energy + 8)
            self.xp = min(9999, self.xp + 2)
            text = self.companion + " shares a happy little chirp."
        elif action == "rest":
            self.energy = min(100, self.energy + 25)
            text = self.companion + " rests beside you."
        elif action == "train":
            if self.energy < 12:
                ok, text = False, "A little rest first. Your friend is safe."
            else:
                self.energy -= 12
                self.xp = min(9999, self.xp + 15)
                self.bond = min(100, self.bond + 1)
                text = "You practiced a friendly team move."
        else:
            if self.energy < 10:
                ok, text = False, "Rest, then explore together."
            else:
                self.energy -= 10
                self.xp = min(9999, self.xp + 10)
                self.bond = min(100, self.bond + 3)
                self.steps = min(65535, self.steps + 1)
                text = ("You follow the harbor lights.", "A path opens through violet grass.",
                        "A fruit fly helps fix a tiny sign.")[(self.steps - 1) % 3]
                if self.steps % 3 == 0 and len(self.discoveries) < len(TREASURES):
                    item = TREASURES[len(self.discoveries)]
                    self.discoveries.append(item)
                    text = "Together you found a " + item.lower() + "."
        if self.level > previous_level:
            text += " Level " + str(self.level) + "!"
        return {"action": action, "ok": ok, "text": text, "level": self.level}

    def export_state(self):
        return {"v": 1, "companion": self.companion, "bond": self.bond,
                "energy": self.energy, "xp": self.xp, "steps": self.steps,
                "discoveries": self.discoveries[:]}

    @classmethod
    def from_state(cls, state):
        if not isinstance(state, dict) or type(state.get("v")) is not int or state["v"] != 1:
            raise ValueError("Unsupported companion save")
        game = cls(state.get("companion"))
        for name, maximum in (("bond", 100), ("energy", 100), ("xp", 9999), ("steps", 65535)):
            value = state.get(name)
            if not _bounded_int(value, 0, maximum):
                raise ValueError("Invalid companion " + name)
            setattr(game, name, value)
        found = state.get("discoveries")
        if not isinstance(found, list) or len(found) > len(TREASURES):
            raise ValueError("Invalid discoveries")
        if any(item not in TREASURES for item in found) or len(set(found)) != len(found):
            raise ValueError("Invalid or duplicate treasure")
        game.discoveries = found[:]
        return game
