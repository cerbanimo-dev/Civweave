#include <Arduino.h>
#include <M5Unified.h>
#include <Preferences.h>

#include "pet.hpp"
#include "protocol.hpp"
#include "transport.hpp"
#ifndef CW_ENABLE_ESPNOW
#define CW_ENABLE_ESPNOW 0
#endif
#if CW_ENABLE_ESPNOW
#include <cstring>
#include "espnow_transport.hpp"
#endif

using namespace civweave::pocket;

namespace {

PetState pet;
#if CW_ENABLE_ESPNOW
EspNowTransport transport;
static const char* kBeacons[] = {"HELLO", "PLAY?", "READY", "GG!"};
uint8_t nextBeacon = 0;
uint32_t receivedIds[16]{};
uint8_t nextSeen = 0;
char linkStatus[25] = "PUBLIC BEACONS ONLY";
#else
StubTransport transport;
#endif
Preferences prefs;
uint32_t lastTickAt = 0;
uint32_t lastInputAt = 0;
uint32_t lastAutoRestAt = 0;
bool dirty = true;

uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) {
  return M5.Display.color565(r, g, b);
}

void savePet() {
  prefs.putUChar("energy", pet.energy);
  prefs.putUChar("curious", pet.curiosity);
  prefs.putUChar("trust", pet.trust);
  prefs.putUShort("xp", pet.xp);
  prefs.putUShort("encounters", pet.encounters);
  prefs.putUChar("carried", pet.carried);
  prefs.putUShort("delivered", pet.delivered);
}

void loadPet() {
  pet.energy = prefs.getUChar("energy", 82);
  pet.curiosity = prefs.getUChar("curious", 50);
  pet.trust = prefs.getUChar("trust", 10);
  pet.xp = prefs.getUShort("xp", 0);
  pet.encounters = prefs.getUShort("encounters", 0);
  pet.carried = prefs.getUChar("carried", 0);
  pet.delivered = prefs.getUShort("delivered", 0);
  pet.mood = moodFor(pet);
}

void chirp(uint16_t frequency, uint32_t duration = 45) {
  M5.Speaker.tone(frequency, duration);
}

void apply(PetEvent event, uint16_t tone = 0) {
  applyPetEvent(pet, event);
  savePet();
  lastInputAt = millis();
  dirty = true;
  if (tone) chirp(tone);
}

void block(int x, int y, int w, int h, uint16_t color) {
  M5.Display.fillRect(x, y, w, h, color);
}

void label(const char* value, int x, int y, uint8_t size, uint16_t color) {
  M5.Display.setTextSize(size);
  M5.Display.setTextColor(color);
  M5.Display.setCursor(x, y);
  M5.Display.print(value);
}

void drawBar(const char* name, uint8_t value, int y, uint16_t color) {
  label(name, 7, y, 1, rgb(170, 195, 216));
  block(46, y + 2, 80, 5, rgb(31, 54, 68));
  block(46, y + 2, (80 * value) / 100, 5, color);
}

void drawThreadling() {
  const int x = 67;
  const int y = 98;
  const uint16_t body = rgb(111, 215, 208);
  const uint16_t dark = rgb(10, 23, 33);
  const uint16_t violet = rgb(182, 161, 255);
  const uint16_t cyan = rgb(143, 231, 255);
  const uint16_t pink = rgb(255, 156, 207);
  const uint16_t gold = rgb(255, 210, 143);

  block(x - 24, y + 35, 48, 5, rgb(11, 26, 36));
  block(x - 21, y - 25, 8, 15, violet);
  block(x + 13, y - 25, 8, 15, cyan);
  block(x - 15, y - 31, 8, 15, pink);
  block(x + 7, y - 31, 8, 15, gold);
  block(x - 22, y - 13, 44, 48, body);
  block(x - 18, y - 18, 36, 10, cyan);
  block(x - 15, y + 30, 10, 10, body);
  block(x + 5, y + 30, 10, 10, body);
  block(x - 25, y + 10, 50, 5, rgb(126, 92, 255));

  if (pet.mood == PetMood::Sleepy) {
    block(x - 12, y, 7, 2, dark);
    block(x + 5, y, 7, 2, dark);
  } else {
    block(x - 12, y - 2, 6, 6, dark);
    block(x + 6, y - 2, 6, 6, dark);
  }
  block(x - 7, y + 10, 14, 3, rgb(25, 49, 62));

  if (pet.carried) {
    block(x + 20, y + 13, 18, 13, rgb(243, 215, 130));
    block(x + 23, y + 16, 12, 2, rgb(114, 80, 31));
  }
  if (pet.mood == PetMood::Spark) {
    block(x - 33, y - 8, 4, 4, rgb(255, 241, 168));
    block(x + 29, y - 18, 4, 4, rgb(255, 241, 168));
  }
}

void render() {
  dirty = false;
  M5.Display.startWrite();
  M5.Display.fillScreen(rgb(17, 42, 56));
  block(0, 0, 135, 22, rgb(9, 20, 29));
  label("POCKET COMMONS", 6, 6, 1, rgb(189, 246, 255));
  M5.Display.setTextColor(rgb(243, 215, 130));
  M5.Display.setCursor(99, 6);
  M5.Display.print(transport.label());

#if CW_ENABLE_ESPNOW
  label(linkStatus, 7, 28, 1, rgb(243, 215, 130));
#endif
  drawThreadling();

  label("THREADLING", 40, 145, 1, rgb(248, 242, 255));
  label(moodLabel(pet.mood), 50, 156, 1, rgb(143, 231, 255));
  drawBar("ENERGY", pet.energy, 175, rgb(127, 243, 176));
  drawBar("CURIOUS", pet.curiosity, 186, rgb(243, 215, 130));
  drawBar("TRUST", pet.trust, 197, rgb(182, 161, 255));

  M5.Display.setTextColor(rgb(215, 230, 242));
  M5.Display.setCursor(7, 211);
  M5.Display.printf("XP %u", pet.xp);
  M5.Display.setCursor(87, 211);
  M5.Display.printf("MAIL %u", pet.carried);

  block(0, 225, 135, 15, rgb(9, 20, 29));
  label("A MEET", 6, 229, 1, rgb(189, 246, 255));
  label(pet.carried ? "B SEND" : "B PACK", 84, 229, 1, rgb(189, 246, 255));
  M5.Display.endWrite();
}

} // namespace

void setup() {
  auto config = M5.config();
  M5.begin(config);
  M5.Display.setRotation(0);
  M5.Display.setTextWrap(false);

  prefs.begin("pocket-common", false);
  loadPet();
  transport.begin();

  lastTickAt = lastInputAt = lastAutoRestAt = millis();
  chirp(880, 55);
  render();
}

void loop() {
  M5.update();
  transport.poll();
#if CW_ENABLE_ESPNOW
  Frame incoming{};
  while (transport.receive(incoming)) {
    bool duplicate = false;
    for (uint32_t id : receivedIds) if (id == incoming.messageId) duplicate = true;
    if (!incoming.messageId || duplicate) continue;
    receivedIds[nextSeen] = incoming.messageId;
    nextSeen = (nextSeen + 1) % 16;
    apply(PetEvent::Receive, 1175);
    snprintf(linkStatus, sizeof(linkStatus), "RECEIVED PUBLIC SIGNAL");
    dirty = true;
  }
#endif
  const uint32_t now = millis();

  if (M5.BtnA.wasPressed()) {
    apply(PetEvent::Encounter, 1046);
  }

  if (M5.BtnB.wasPressed()) {
#if CW_ENABLE_ESPNOW
    if (!pet.carried) {
      apply(PetEvent::Carry, 784);
      snprintf(linkStatus, sizeof(linkStatus), "PACKED PUBLIC BEACON");
    } else {
      Frame outgoing{};
      outgoing.flags = Beacon;
      outgoing.messageId = esp_random();
      if (!outgoing.messageId) outgoing.messageId = 1;
      const char* phrase = kBeacons[nextBeacon];
      outgoing.payloadLength = static_cast<uint8_t>(strlen(phrase));
      memcpy(outgoing.payload.data(), phrase, outgoing.payloadLength);
      uint8_t bytes[kMaxFrameBytes]{};
      size_t written = 0;
      if (encodeFrame(outgoing, bytes, sizeof bytes, written) &&
          transport.send(bytes, written)) {
        // Queued to ESP-NOW, NOT confirmed delivered: do not claim Deliver XP.
        --pet.carried;
        savePet();
        nextBeacon = (nextBeacon + 1) % 4;
        snprintf(linkStatus, sizeof(linkStatus), "QUEUED: NOT ACKED");
        chirp(1318);
      } else {
        snprintf(linkStatus, sizeof(linkStatus), "SEND FAILED / RETRY");
        chirp(350);
      }
      dirty = true;
    }
#else
    apply(pet.carried ? PetEvent::Deliver : PetEvent::Carry, pet.carried ? 1318 : 784);
#endif
  }

  if (now - lastTickAt >= 10000) {
    lastTickAt = now;
    applyPetEvent(pet, PetEvent::Tick);
    savePet();
    dirty = true;
  }

  // Quietly recover after a minute without input. This is game state only;
  // it never starts a network or radio action.
  if (now - lastInputAt >= 60000 && now - lastAutoRestAt >= 30000 && pet.energy < 65) {
    lastAutoRestAt = now;
    applyPetEvent(pet, PetEvent::Rest);
    savePet();
    dirty = true;
  }

  if (dirty) render();
  delay(12);
}
