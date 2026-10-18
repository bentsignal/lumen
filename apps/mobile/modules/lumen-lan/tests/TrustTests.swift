import XCTest
@testable import LANPolicy

final class TrustTests: XCTestCase {
  let fingerprint = String(repeating: "a", count: 64)
  func testOnlyPrivateOrLocalAddresses() throws {
    for address in ["10.0.0.2", "172.16.0.2", "192.168.0.2", "hue.local"] {
      XCTAssertEqual(try DeviceTrust.localHost(address), address)
    }
    for address in ["https://hue.local", "example.com", "127.0.0.1", "192.0.2.20", "hue.local@evil.com", "10.0.0.999", "10.00.0.1", "hue..local"] {
      XCTAssertThrowsError(try DeviceTrust.localHost(address))
    }
  }
  func testTrustIsBoundToHostPortIdentityAndPin() throws {
    let trust = DeviceTrust(host: "hue.local", port: 443, identity: "001122fffe334455", fingerprint: fingerprint)
    XCTAssertTrue(trust.accepts(host: "hue.local", port: 443, identity: trust.identity, fingerprint: fingerprint, probing: false))
    XCTAssertFalse(trust.accepts(host: "other.local", port: 443, identity: trust.identity, fingerprint: fingerprint, probing: false))
    XCTAssertFalse(trust.accepts(host: "hue.local", port: 80, identity: trust.identity, fingerprint: fingerprint, probing: false))
    XCTAssertFalse(trust.accepts(host: "hue.local", port: 443, identity: "different", fingerprint: fingerprint, probing: false))
    XCTAssertFalse(trust.accepts(host: "hue.local", port: 443, identity: trust.identity, fingerprint: String(repeating: "b", count: 64), probing: false))
  }
  func testProbeCannotTrustTVOrArbitraryIdentity() {
    let trust = DeviceTrust(host: "tv.local", port: 8766, identity: "lumen-tv", fingerprint: "")
    XCTAssertFalse(trust.accepts(host: trust.host, port: trust.port, identity: trust.identity, fingerprint: fingerprint, probing: true))
  }
  func testCredentialDestinationsAreRestricted() throws {
    let trust = DeviceTrust(host: "hue.local", port: 443, identity: "001122fffe334455", fingerprint: fingerprint)
    XCTAssertEqual(try trust.url(path: "/api").scheme, "https")
    for path in ["//evil.local/api", "/api?redirect=evil", "/v1/policy", "/other"] { XCTAssertThrowsError(try trust.url(path: path)) }
  }
  func testEventBoundariesMultilineKeepaliveAndSplitUnicode() throws {
    var parser = SSEParser()
    let bytes = Array("data: {\"name\":\"Café\"}\r\n\r\n:keepalive\n\ndata: one\ndata: two\n\n".utf8)
    var events: [String] = []
    for byte in bytes { events += try parser.append(Data([byte])) }
    XCTAssertEqual(events, ["{\"name\":\"Café\"}", "one\ntwo"])
    XCTAssertThrowsError(try parser.append(Data(repeating: 1, count: 1_048_577)))
  }
}
