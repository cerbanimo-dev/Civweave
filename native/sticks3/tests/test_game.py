"""Observable contracts for the offline, two-button pocket creature game."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from pocket_game import Game, MAX_BERRIES, MAX_BOND, MAX_ENERGY, MAX_STEPS


def choose(game, label):
    """Use the same next/select actions as the device, never mutate menus."""
    for _ in range(len(game.snapshot()["options"])):
        snap = game.snapshot()
        if snap["options"][snap["selection"]] == label:
            return game.input("select")
        game.input("next")
    raise AssertionError("Option %r is not available in %r" % (label, game.snapshot()))


class GameTests(unittest.TestCase):
    def test_start_menu_and_two_button_navigation(self):
        game = Game()
        snap = game.snapshot()
        self.assertEqual(set(snap), {
            "screen", "selection", "title", "options", "notice", "active",
            "energy", "berries", "bond", "collection", "encounter", "steps",
        })
        self.assertEqual(snap["screen"], "home")
        self.assertEqual(snap["options"], ["Explore", "Care", "Collection", "Link"])
        self.assertEqual(snap["active"], {"id": "mothbit", "name": "Mothbit"})
        self.assertEqual(snap["collection"], ["mothbit"])
        for _ in range(4):
            self.assertEqual(game.input("next"), [])
        self.assertEqual(game.snapshot()["selection"], 0)
        choose(game, "Care")
        self.assertEqual(game.snapshot()["screen"], "care")
        self.assertEqual(game.input("back"), [])
        self.assertEqual(game.snapshot()["screen"], "home")
        self.assertEqual(game.snapshot()["selection"], 0)

    def test_offline_loop_finds_every_original_creature(self):
        game = Game()
        choose(game, "Explore")
        encountered = []
        for _ in range(18):
            if not game.snapshot()["energy"]:
                choose(game, "Rest")
            self.assertEqual(choose(game, "Walk"), [])
            if game.snapshot()["screen"] == "encounter":
                encountered.append(game.snapshot()["encounter"])
                self.assertEqual(choose(game, "Befriend"), [])
        self.assertEqual(encountered[:3], ["glowfin", "pebblehop", "breezelet"])
        self.assertEqual(game.snapshot()["steps"], 18)
        self.assertEqual(game.snapshot()["collection"], [
            "mothbit", "glowfin", "pebblehop", "breezelet",
        ])
        self.assertEqual(len(game.snapshot()["collection"]), 4)

    def test_zero_energy_and_berries_can_always_recover(self):
        saved = Game().export()
        saved.update(energy=0, berries=0)
        game = Game(saved)
        choose(game, "Explore")
        before = game.export()
        choose(game, "Walk")
        self.assertEqual(game.export(), before)
        self.assertIn("rest", game.snapshot()["notice"].lower())
        choose(game, "Rest")
        self.assertEqual(game.snapshot()["energy"], MAX_ENERGY)
        choose(game, "Walk")
        self.assertGreater(game.snapshot()["berries"], 0)
        game.input("back")
        choose(game, "Care")
        choose(game, "Rest")
        self.assertEqual(game.snapshot()["energy"], MAX_ENERGY)

    def test_care_has_observable_effects_without_resource_underflow(self):
        game = Game()
        choose(game, "Care")
        before = game.snapshot()
        choose(game, "Play")
        after = game.snapshot()
        self.assertLess(after["energy"], before["energy"])
        self.assertGreater(after["bond"], before["bond"])
        choose(game, "Feed")
        self.assertEqual(game.snapshot()["berries"], before["berries"] - 1)
        for _ in range(150):
            choose(game, "Feed")
            choose(game, "Play")
        self.assertGreaterEqual(game.snapshot()["berries"], 0)
        self.assertGreaterEqual(game.snapshot()["energy"], 0)
        choose(game, "Rest")
        self.assertEqual(game.snapshot()["energy"], MAX_ENERGY)

    def test_cancel_encounter_and_return_home_have_no_friend_side_effect(self):
        game = Game()
        choose(game, "Explore")
        choose(game, "Walk")
        choose(game, "Walk")
        self.assertEqual(game.snapshot()["screen"], "encounter")
        before = game.export()
        game.input("back")
        self.assertEqual(game.snapshot()["screen"], "home")
        self.assertIsNone(game.snapshot()["encounter"])
        self.assertEqual(game.export(), before)

    def test_collection_selection_is_reversible(self):
        game = Game()
        choose(game, "Explore")
        choose(game, "Walk")
        choose(game, "Walk")
        choose(game, "Befriend")
        game.input("back")
        choose(game, "Collection")
        choose(game, "Glowfin")
        self.assertEqual(game.snapshot()["active"]["id"], "glowfin")
        choose(game, "Mothbit")
        self.assertEqual(game.snapshot()["active"]["id"], "mothbit")
        self.assertEqual(game.snapshot()["collection"], ["mothbit", "glowfin"])

    def test_link_only_returns_explicit_intents_and_never_saves_notes(self):
        game = Game()
        before = game.export()
        choose(game, "Link")
        self.assertEqual(game.snapshot()["options"], ["Query status", "Draft note", "Dismiss"])
        self.assertEqual(choose(game, "Query status"), [{"type": "query"}])
        drafts = choose(game, "Draft note")
        self.assertEqual(len(drafts), 1)
        self.assertEqual(drafts[0]["type"], "note_draft")
        self.assertTrue(0 < len(drafts[0]["text"]) <= 120)
        self.assertIn("local", game.snapshot()["notice"].lower())
        self.assertIn("unsent", game.snapshot()["notice"].lower())
        self.assertEqual(game.export(), before)
        self.assertEqual(choose(game, "Dismiss"), [{"type": "dismiss"}])
        self.assertEqual(game.input("back"), [])
        self.assertEqual(game.export(), before)

    def test_roundtrip_keeps_progress_and_resets_transient_menu(self):
        game = Game()
        choose(game, "Care")
        choose(game, "Play")
        saved = game.export()
        restored = Game(saved)
        self.assertEqual(restored.export(), saved)
        self.assertEqual(restored.snapshot()["screen"], "home")
        self.assertEqual(restored.snapshot()["selection"], 0)
        self.assertIsNone(restored.snapshot()["encounter"])

    def test_invalid_saves_are_rejected_as_a_whole(self):
        valid = Game().export()
        malformed = [None, [], "game", {}, True]
        for key, value in [
            ("version", 2), ("version", True), ("energy", -1),
            ("energy", MAX_ENERGY + 1), ("energy", True), ("energy", 1.5),
            ("berries", MAX_BERRIES + 1), ("bond", MAX_BOND + 1),
            ("steps", 10 ** 100), ("cursor", 6), ("cursor", -1),
            ("active", "unknown"), ("active", "glowfin"),
            ("collection", ["mothbit", "mothbit"]),
            ("collection", ["glowfin"]), ("collection", ["mothbit"] * 1000),
            ("collection", "mothbit"), ("collection", ["mothbit", {}]),
        ]:
            broken = dict(valid)
            broken[key] = value
            malformed.append(broken)
        broken = dict(valid)
        broken["remote_rewards"] = 1000
        malformed.append(broken)
        for broken in malformed:
            with self.subTest(saved=repr(broken)[:120]):
                self.assertEqual(Game(broken).export(), valid)

    def test_saturated_counts_stay_bounded_and_exploration_continues(self):
        saved = Game().export()
        saved.update(energy=MAX_ENERGY, berries=MAX_BERRIES, bond=MAX_BOND, steps=MAX_STEPS)
        game = Game(saved)
        choose(game, "Explore")
        encounters = []
        for _ in range(24):
            if not game.snapshot()["energy"]:
                choose(game, "Rest")
            choose(game, "Walk")
            if game.snapshot()["encounter"]:
                encounters.append(game.snapshot()["encounter"])
                choose(game, "Befriend")
            snap = game.snapshot()
            self.assertLessEqual(snap["energy"], MAX_ENERGY)
            self.assertLessEqual(snap["berries"], MAX_BERRIES)
            self.assertLessEqual(snap["bond"], MAX_BOND)
            self.assertEqual(snap["steps"], MAX_STEPS)
        self.assertEqual(set(encounters), {"glowfin", "pebblehop", "breezelet"})

    def test_snapshots_and_exports_cannot_mutate_the_game(self):
        game = Game()
        before = game.export()
        snap = game.snapshot()
        snap["active"]["id"] = "unknown"
        snap["collection"].append("unknown")
        snap["options"].clear()
        saved = game.export()
        saved["collection"].append("unknown")
        self.assertEqual(game.export(), before)
        self.assertEqual(game.snapshot()["options"][0], "Explore")

    def test_actions_are_deterministic_and_unknown_actions_rejected(self):
        first, second = Game(), Game()
        actions = ["next", "select", "next", "select", "back", "select", "select", "select", "select"]
        for action in actions:
            self.assertEqual(first.input(action), second.input(action))
            self.assertEqual(first.snapshot(), second.snapshot())
        before = first.snapshot()
        with self.assertRaises(ValueError):
            first.input("send_money")
        self.assertEqual(first.snapshot(), before)


if __name__ == "__main__":
    unittest.main()
