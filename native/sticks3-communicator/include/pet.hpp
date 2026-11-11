#pragma once

#include <algorithm>
#include <cstdint>

namespace civweave::pocket {

enum class PetMood : uint8_t { Bright, Spark, Cozy, Busy, Sleepy };

struct PetState {
  uint8_t energy = 82;
  uint8_t curiosity = 50;
  uint8_t trust = 10;
  uint16_t xp = 0;
  uint16_t encounters = 0;
  uint8_t carried = 0;
  uint16_t delivered = 0;
  PetMood mood = PetMood::Bright;
};

enum class PetEvent : uint8_t { Tick, Encounter, Carry, Deliver, Receive, Rest };

inline uint8_t clamp100(int value) {
  return static_cast<uint8_t>(std::max(0, std::min(100, value)));
}

inline PetMood moodFor(const PetState& state) {
  if (state.energy < 18) return PetMood::Sleepy;
  if (state.carried > 2) return PetMood::Busy;
  if (state.curiosity > 76) return PetMood::Spark;
  if (state.trust > 70) return PetMood::Cozy;
  return PetMood::Bright;
}

inline void applyPetEvent(PetState& state, PetEvent event) {
  switch (event) {
    case PetEvent::Tick:
      state.energy = clamp100(static_cast<int>(state.energy) - 1);
      state.curiosity = clamp100(static_cast<int>(state.curiosity) + 1);
      break;
    case PetEvent::Encounter:
      ++state.encounters;
      state.curiosity = clamp100(static_cast<int>(state.curiosity) + 12);
      state.xp += 4;
      break;
    case PetEvent::Carry:
      if (state.carried < 255) ++state.carried;
      state.energy = clamp100(static_cast<int>(state.energy) - 2);
      state.xp += 1;
      break;
    case PetEvent::Deliver:
      if (state.carried) {
        --state.carried;
        ++state.delivered;
        state.trust = clamp100(static_cast<int>(state.trust) + 6);
        state.xp += 8;
      }
      break;
    case PetEvent::Receive:
      state.curiosity = clamp100(static_cast<int>(state.curiosity) + 8);
      state.trust = clamp100(static_cast<int>(state.trust) + 2);
      state.xp += 3;
      break;
    case PetEvent::Rest:
      state.energy = clamp100(static_cast<int>(state.energy) + 24);
      state.curiosity = clamp100(static_cast<int>(state.curiosity) - 4);
      break;
  }
  state.mood = moodFor(state);
}

inline const char* moodLabel(PetMood mood) {
  switch (mood) {
    case PetMood::Bright: return "BRIGHT";
    case PetMood::Spark: return "SPARK";
    case PetMood::Cozy: return "COZY";
    case PetMood::Busy: return "BUSY";
    case PetMood::Sleepy: return "SLEEPY";
  }
  return "BRIGHT";
}

} // namespace civweave::pocket
