#pragma once

#include <cstring>
#include <array>
#include <cstddef>
#include <cstdint>

namespace civweave::pocket {

static constexpr uint8_t kMagic0 = 0x43; // C
static constexpr uint8_t kMagic1 = 0x57; // W
static constexpr uint8_t kFrameVersion = 1;
static constexpr size_t kHeaderBytes = 13;
static constexpr size_t kMaxPayload = 180;
static constexpr size_t kMaxFrameBytes = kHeaderBytes + kMaxPayload;

enum FrameFlags : uint8_t {
  EncryptedEnvelope = 0x01,
  Beacon = 0x02,
  Ack = 0x04,
};

struct Frame {
  uint8_t flags = 0;
  uint32_t messageId = 0;
  uint8_t partIndex = 0;
  uint8_t partCount = 1;
  uint8_t payloadLength = 0;
  std::array<uint8_t, kMaxPayload> payload{};
};

inline uint16_t crc16Ccitt(const uint8_t* data, size_t length, uint16_t crc = 0xffff) {
  for (size_t i = 0; i < length; ++i) {
    crc ^= static_cast<uint16_t>(data[i]) << 8;
    for (uint8_t bit = 0; bit < 8; ++bit) {
      crc = (crc & 0x8000) ? static_cast<uint16_t>((crc << 1) ^ 0x1021)
                           : static_cast<uint16_t>(crc << 1);
    }
  }
  return crc;
}

inline void putU32Le(uint8_t* out, uint32_t value) {
  out[0] = value & 0xff;
  out[1] = (value >> 8) & 0xff;
  out[2] = (value >> 16) & 0xff;
  out[3] = (value >> 24) & 0xff;
}

inline uint32_t getU32Le(const uint8_t* in) {
  return static_cast<uint32_t>(in[0]) |
         (static_cast<uint32_t>(in[1]) << 8) |
         (static_cast<uint32_t>(in[2]) << 16) |
         (static_cast<uint32_t>(in[3]) << 24);
}

inline bool encodeFrame(const Frame& frame, uint8_t* out, size_t capacity, size_t& written) {
  written = 0;
  if (!out || frame.payloadLength > kMaxPayload || frame.partCount == 0 ||
      frame.partIndex >= frame.partCount) return false;
  const size_t total = kHeaderBytes + frame.payloadLength;
  if (capacity < total) return false;

  out[0] = kMagic0;
  out[1] = kMagic1;
  out[2] = kFrameVersion;
  out[3] = frame.flags;
  putU32Le(out + 4, frame.messageId);
  out[8] = frame.partIndex;
  out[9] = frame.partCount;
  out[10] = frame.payloadLength;
  out[11] = 0;
  out[12] = 0;
  memcpy(out + kHeaderBytes, frame.payload.data(), frame.payloadLength);

  uint16_t crc = crc16Ccitt(out, 11);
  crc = crc16Ccitt(out + kHeaderBytes, frame.payloadLength, crc);
  out[11] = crc & 0xff;
  out[12] = (crc >> 8) & 0xff;
  written = total;
  return true;
}

inline bool decodeFrame(const uint8_t* bytes, size_t length, Frame& frame) {
  if (!bytes || length < kHeaderBytes) return false;
  if (bytes[0] != kMagic0 || bytes[1] != kMagic1 || bytes[2] != kFrameVersion) return false;
  const uint8_t payloadLength = bytes[10];
  if (payloadLength > kMaxPayload || length != kHeaderBytes + payloadLength) return false;
  const uint8_t partIndex = bytes[8], partCount = bytes[9];
  if (partCount == 0 || partIndex >= partCount) return false;

  const uint16_t expected = static_cast<uint16_t>(bytes[11]) |
                            (static_cast<uint16_t>(bytes[12]) << 8);
  uint16_t actual = crc16Ccitt(bytes, 11);
  actual = crc16Ccitt(bytes + kHeaderBytes, payloadLength, actual);
  if (actual != expected) return false;

  frame.flags = bytes[3];
  frame.messageId = getU32Le(bytes + 4);
  frame.partIndex = partIndex;
  frame.partCount = partCount;
  frame.payloadLength = payloadLength;
  memcpy(frame.payload.data(), bytes + kHeaderBytes, payloadLength);
  return true;
}

} // namespace civweave::pocket
