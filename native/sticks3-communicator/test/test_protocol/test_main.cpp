#include <unity.h>
#include "protocol.hpp"
#include "pet.hpp"

using namespace civweave::pocket;

void test_frame_round_trip() {
  Frame source;
  source.flags = Beacon;
  source.messageId = 0x10203040;
  source.partIndex = 0;
  source.partCount = 1;
  const char* text = "hello pocket commons";
  source.payloadLength = strlen(text);
  memcpy(source.payload.data(), text, source.payloadLength);

  uint8_t bytes[kMaxFrameBytes]{};
  size_t written = 0;
  TEST_ASSERT_TRUE(encodeFrame(source, bytes, sizeof(bytes), written));

  Frame decoded;
  TEST_ASSERT_TRUE(decodeFrame(bytes, written, decoded));
  TEST_ASSERT_EQUAL_UINT32(source.messageId, decoded.messageId);
  TEST_ASSERT_EQUAL_UINT8(source.flags, decoded.flags);
  TEST_ASSERT_EQUAL_UINT8(source.payloadLength, decoded.payloadLength);
  TEST_ASSERT_EQUAL_MEMORY(source.payload.data(), decoded.payload.data(), source.payloadLength);
}

void test_crc_rejects_corruption() {
  Frame source;
  source.flags = Beacon;
  source.messageId = 9;
  source.payloadLength = 4;
  memcpy(source.payload.data(), "test", 4);

  uint8_t bytes[kMaxFrameBytes]{};
  size_t written = 0;
  TEST_ASSERT_TRUE(encodeFrame(source, bytes, sizeof(bytes), written));
  bytes[written - 1] ^= 0xff;

  Frame decoded;
  TEST_ASSERT_FALSE(decodeFrame(bytes, written, decoded));
}

void test_pet_state_is_bounded() {
  PetState pet;
  applyPetEvent(pet, PetEvent::Encounter);
  TEST_ASSERT_EQUAL_UINT16(1, pet.encounters);
  TEST_ASSERT_GREATER_THAN_UINT8(50, pet.curiosity);

  applyPetEvent(pet, PetEvent::Carry);
  TEST_ASSERT_EQUAL_UINT8(1, pet.carried);
  applyPetEvent(pet, PetEvent::Deliver);
  TEST_ASSERT_EQUAL_UINT8(0, pet.carried);
  TEST_ASSERT_EQUAL_UINT16(1, pet.delivered);

  for (int i = 0; i < 200; ++i) applyPetEvent(pet, PetEvent::Tick);
  TEST_ASSERT_LESS_OR_EQUAL_UINT8(100, pet.energy);
  TEST_ASSERT_LESS_OR_EQUAL_UINT8(100, pet.curiosity);
}

int runPocketCommonsTests() {
  UNITY_BEGIN();
  RUN_TEST(test_frame_round_trip);
  RUN_TEST(test_crc_rejects_corruption);
  RUN_TEST(test_pet_state_is_bounded);
  return UNITY_END();
}

#ifdef ARDUINO
void setup() { runPocketCommonsTests(); }
void loop() {}
#else
int main(int, char**) { return runPocketCommonsTests(); }
#endif
