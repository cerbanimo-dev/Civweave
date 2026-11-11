#include <cassert>
#include <cstdint>
#include <cstring>
#include <iostream>
#include "protocol.hpp"
#include "pet.hpp"

using namespace civweave::pocket;

static void testFrameRoundTrip() {
  Frame original{};
  original.flags = Beacon;
  original.messageId = 0x89abcdef;
  original.payloadLength = 5;
  std::memcpy(original.payload.data(), "HELLO", 5);
  uint8_t raw[kMaxFrameBytes]{};
  size_t written = 0;
  assert(encodeFrame(original, raw, sizeof raw, written));
  assert(written == kHeaderBytes + 5);
  Frame recovered{};
  assert(decodeFrame(raw, written, recovered));
  assert(recovered.flags == Beacon);
  assert(recovered.messageId == original.messageId);
  assert(recovered.partIndex == 0 && recovered.partCount == 1);
  assert(recovered.payloadLength == 5);
  assert(std::memcmp(recovered.payload.data(), "HELLO", 5) == 0);
  raw[13] ^= 0x40;
  assert(!decodeFrame(raw, written, recovered)); // CRC catches corruption
  raw[13] ^= 0x40;
  assert(!decodeFrame(raw, written - 1, recovered)); // exact length
}

static void testFrameBounds() {
  static_assert(kMaxFrameBytes <= 250, "ESP-NOW v1 payload must fit");
  Frame frame{};
  uint8_t raw[kMaxFrameBytes]{};
  size_t written = 123;
  frame.partCount = 0;
  assert(!encodeFrame(frame, raw, sizeof raw, written) && written == 0);
  frame.partCount = 1; frame.partIndex = 1;
  assert(!encodeFrame(frame, raw, sizeof raw, written));
  frame.partIndex = 0; frame.payloadLength = kMaxPayload + 1;
  assert(!encodeFrame(frame, raw, sizeof raw, written));
  frame.payloadLength = kMaxPayload;
  assert(!encodeFrame(frame, raw, kMaxFrameBytes - 1, written));
  assert(encodeFrame(frame, raw, sizeof raw, written));
  assert(written == kMaxFrameBytes);
  raw[0] = 0;
  assert(!decodeFrame(raw, written, frame));
}

static void testFamiliarState() {
  PetState pet{};
  assert(pet.energy == 82 && pet.xp == 0);
  applyPetEvent(pet, PetEvent::Encounter);
  assert(pet.xp == 4 && pet.encounters == 1 && pet.curiosity == 62);
  applyPetEvent(pet, PetEvent::Carry);
  assert(pet.carried == 1 && pet.energy == 80);
  applyPetEvent(pet, PetEvent::Deliver);
  assert(pet.carried == 0 && pet.delivered == 1 && pet.trust == 16);
  applyPetEvent(pet, PetEvent::Receive);
  assert(pet.xp == 16 && pet.curiosity == 70);
  for (int i = 0; i < 100; ++i) applyPetEvent(pet, PetEvent::Tick);
  assert(pet.energy == 0 && pet.mood == PetMood::Sleepy);
  applyPetEvent(pet, PetEvent::Rest);
  assert(pet.energy == 24);
  assert(pet.mood != PetMood::Sleepy);
}

int main() {
  testFrameRoundTrip();
  testFrameBounds();
  testFamiliarState();
  std::cout << "StickS3 protocol and familiar contracts passed\n";
}
