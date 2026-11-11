#pragma once

#include <cstddef>
#include <cstdint>

namespace civweave::pocket {

enum class TransportState : uint8_t { Offline, Ready, Busy, Error };

class Transport {
 public:
  virtual ~Transport() = default;
  virtual bool begin() = 0;
  virtual void poll() = 0;
  virtual bool send(const uint8_t* bytes, size_t length) = 0;
  virtual TransportState state() const = 0;
  virtual const char* label() const = 0;
};

class StubTransport final : public Transport {
 public:
  bool begin() override {
    state_ = TransportState::Offline;
    return true;
  }

  void poll() override {}

  bool send(const uint8_t*, size_t) override {
    // Thread 9 deliberately ships radio-silent until exact LoRa hardware,
    // pinout, region and RF limits are selected.
    return false;
  }

  TransportState state() const override { return state_; }
  const char* label() const override { return "NO RF"; }

 private:
  TransportState state_ = TransportState::Offline;
};

} // namespace civweave::pocket
