#pragma once

// Opt-in, local-only ESP-NOW carrier for pre-LoRa StickS3 demos.
// Never pass a plaintext private message to this transport.
// The only accepted frames are four fixed, public game beacons.

#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_arduino_version.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <cstring>
#include "protocol.hpp"
#include "transport.hpp"

namespace civweave::pocket {

class EspNowTransport final : public Transport {
 public:
  bool begin() override {
    if (active() != nullptr) return false;
    inbox_ = xQueueCreate(6, sizeof(Packet));
    if (!inbox_) return false;
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    if (esp_wifi_set_channel(1, WIFI_SECOND_CHAN_NONE) != ESP_OK ||
        esp_now_init() != ESP_OK) {
      state_ = TransportState::Error;
      return false;
    }
    active() = this;
    if (esp_now_register_recv_cb(onReceive) != ESP_OK) {
      active() = nullptr;
      esp_now_deinit();
      state_ = TransportState::Error;
      return false;
    }
    esp_now_peer_info_t peer{};
    std::memset(peer.peer_addr, 0xff, 6);
    peer.channel = 1;
    peer.ifidx = WIFI_IF_STA;
    peer.encrypt = false; // Public beacons ONLY; never private messages.
    if (esp_now_add_peer(&peer) != ESP_OK) {
      active() = nullptr;
      esp_now_deinit();
      state_ = TransportState::Error;
      return false;
    }
    state_ = TransportState::Ready;
    return true;
  }

  void poll() override {}

  bool send(const uint8_t* bytes, size_t length) override {
    Frame frame{};
    if (state_ != TransportState::Ready || !decodeFrame(bytes, length, frame) ||
        !publicBeacon(frame)) return false;
    static const uint8_t broadcast[6] = {0xff,0xff,0xff,0xff,0xff,0xff};
    // ESP_OK means queued to the radio, not delivered or acknowledged.
    return esp_now_send(broadcast, bytes, length) == ESP_OK;
  }

  bool receive(Frame& result) {
    if (!inbox_) return false;
    Packet packet{};
    while (xQueueReceive(inbox_, &packet, 0) == pdTRUE) {
      Frame frame{};
      if (decodeFrame(packet.data, packet.length, frame) && publicBeacon(frame)) {
        result = frame;
        return true;
      }
    }
    return false;
  }

  TransportState state() const override { return state_; }
  const char* label() const override { return state_ == TransportState::Ready ? "NOW" : "ERR"; }

  static bool publicBeacon(const Frame& frame) {
    if (frame.flags != Beacon || frame.partIndex != 0 || frame.partCount != 1) return false;
    static const char* const allowed[] = {"HELLO", "PLAY?", "READY", "GG!"};
    for (const char* phrase : allowed) {
      size_t len = std::strlen(phrase);
      if (frame.payloadLength == len &&
          std::memcmp(frame.payload.data(), phrase, len) == 0) return true;
    }
    return false;
  }

 private:
  struct Packet {
    uint16_t length;
    uint8_t data[kMaxFrameBytes];
  };

  static EspNowTransport*& active() {
    static EspNowTransport* current = nullptr;
    return current;
  }

#if ESP_ARDUINO_VERSION_MAJOR >= 3
  static void onReceive(const esp_now_recv_info_t*, const uint8_t* data, int length) {
#else
  static void onReceive(const uint8_t*, const uint8_t* data, int length) {
#endif
    EspNowTransport* self = active();
    if (!self || !self->inbox_ || !data ||
        length < static_cast<int>(kHeaderBytes) ||
        length > static_cast<int>(kMaxFrameBytes)) return;
    Packet packet{};
    packet.length = static_cast<uint16_t>(length);
    std::memcpy(packet.data, data, length);
    // Wi-Fi callback is not the UI/game thread. Bounded non-blocking handoff.
    xQueueSend(self->inbox_, &packet, 0);
  }

  QueueHandle_t inbox_ = nullptr;
  TransportState state_ = TransportState::Offline;
};

} // namespace civweave::pocket
