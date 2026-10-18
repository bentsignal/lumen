import Foundation

enum LANFailure: Error, LocalizedError {
  case invalidAddress, identity, certificate, redirect, response, tooLarge
  var errorDescription: String? {
    switch self {
    case .invalidAddress: return "Enter a private IPv4 address or a .local hostname."
    case .identity: return "Bridge identity does not match. Check the Bridge ID in the Hue app."
    case .certificate: return "Device certificate changed or was not trusted. Verify the device before pairing again."
    case .redirect: return "The device redirected the request. No credentials were forwarded."
    case .response: return "The device returned an unexpected response."
    case .tooLarge: return "Device response exceeded the safety limit."
    }
  }
}

struct DeviceTrust {
  let host: String
  let port: Int
  let identity: String
  let fingerprint: String
  var isHue: Bool { identity.range(of: "^[0-9a-fA-F]{16}$", options: .regularExpression) != nil }

  static func localHost(_ raw: String) throws -> String {
    let host = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let parts = host.split(separator: ".", omittingEmptySubsequences: false)
    if parts.count == 4, let a = Int(parts[0]), let b = Int(parts[1]),
       parts.allSatisfy({ part in Int(part).map { (0...255).contains($0) && part == String($0) } ?? false }),
       a == 10 || (a == 172 && (16...31).contains(b)) || (a == 192 && b == 168) {
      return host
    }
    if host.hasSuffix(".local"), host.count <= 253,
       parts.allSatisfy({ !$0.isEmpty && $0.count <= 63 && $0.first != "-" && $0.last != "-" && $0.allSatisfy { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") } }) {
      return host
    }
    throw LANFailure.invalidAddress
  }

  static func normalizedFingerprint(_ value: String) -> String {
    value.replacingOccurrences(of: ":", with: "").lowercased()
  }

  func accepts(host: String, port: Int, identity: String, fingerprint: String, probing: Bool) -> Bool {
    guard host.lowercased() == self.host, port == self.port,
      identity.lowercased() == self.identity.lowercased() else { return false }
    if probing { return isHue && (1...65535).contains(self.port) }
    let expected = Self.normalizedFingerprint(self.fingerprint)
    return expected.count == 64 && expected.allSatisfy { $0.isHexDigit } && expected == fingerprint
  }

  func url(path: String) throws -> URL {
    guard path.hasPrefix("/"), !path.hasPrefix("//"), !path.contains("?"), !path.contains("#"),
      let url = URL(string: "https://\(host):\(port)\(path)"), url.host == host,
      (isHue && (1...65535).contains(port) && (path == "/api" || path == "/api/config" || path == "/eventstream/clip/v2" || path.hasPrefix("/clip/v2/resource"))) ||
      (identity == "lumen-tv" && port == 8766 && ["/v1/status", "/v1/policy", "/v1/handoff", "/v1/tuning"].contains(path)) else { throw LANFailure.invalidAddress }
    return url
  }
}

struct SSEParser {
  private var buffer = Data()
  mutating func append(_ data: Data) throws -> [String] {
    buffer.append(data)
    guard buffer.count <= 1_048_576 else { throw LANFailure.tooLarge }
    var events: [String] = []
    while true {
      let ranges = [Data("\n\n".utf8), Data("\r\n\r\n".utf8)].compactMap { buffer.range(of: $0) }
      guard let range = ranges.min(by: { $0.lowerBound < $1.lowerBound }) else { break }
      // Decode complete events, preserving UTF-8 scalars split across packets.
      let block = String(decoding: buffer[..<range.lowerBound], as: UTF8.self).replacingOccurrences(of: "\r\n", with: "\n")
      buffer.removeSubrange(..<range.upperBound)
      let text = block.components(separatedBy: "\n").filter { $0.hasPrefix("data:") }
        .map { line -> String in
          let value = String(line.dropFirst(5))
          return value.hasPrefix(" ") ? String(value.dropFirst()) : value
        }.joined(separator: "\n")
      if !text.isEmpty { events.append(text) }
    }
    return events
  }
}
