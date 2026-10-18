import ExpoModulesCore
import Foundation
import Security
import CryptoKit

struct LANConnection: Record {
  @Field var host: String = ""
  @Field var port: Int = 443
  @Field var identity: String = ""
  @Field var fingerprint: String = ""
  @Field var key: String = ""

  func trust() throws -> DeviceTrust {
    DeviceTrust(host: try DeviceTrust.localHost(host), port: port, identity: identity, fingerprint: fingerprint)
  }
}

final class PinnedSession: NSObject, URLSessionDataDelegate {
  let trust: DeviceTrust
  let probing: Bool
  var observedFingerprint: String?
  var trustFailed = false
  var redirected = false
  var parser = SSEParser()
  var emit: (([String: String]) -> Void)?

  init(trust: DeviceTrust, probing: Bool = false) {
    self.trust = trust
    self.probing = probing
  }

  func session() -> URLSession {
    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForRequest = 8
    config.timeoutIntervalForResource = emit == nil ? 12 : 3600
    config.urlCache = nil
    config.httpCookieStorage = nil
    return URLSession(configuration: config, delegate: self, delegateQueue: nil)
  }

  func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
                  completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
      let serverTrust = challenge.protectionSpace.serverTrust,
      let chain = SecTrustCopyCertificateChain(serverTrust) as? [SecCertificate], let cert = chain.first else {
      completionHandler(.cancelAuthenticationChallenge, nil)
      return
    }
    var commonName: CFString?
    SecCertificateCopyCommonName(cert, &commonName)
    let fingerprint = SHA256.hash(data: SecCertificateCopyData(cert) as Data).map { String(format: "%02x", $0) }.joined()
    guard trust.accepts(host: challenge.protectionSpace.host, port: challenge.protectionSpace.port,
      identity: (commonName as String?) ?? "", fingerprint: fingerprint, probing: probing) else {
      trustFailed = true
      completionHandler(.cancelAuthenticationChallenge, nil)
      return
    }
    // The exception is this session's exact device identity and leaf, never a global TLS override.
    // Probe contains no credentials and its fingerprint must be explicitly approved before pairing.
    observedFingerprint = fingerprint
    completionHandler(.useCredential, URLCredential(trust: serverTrust))
  }

  func urlSession(_ session: URLSession, task: URLSessionTask,
                  willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                  completionHandler: @escaping (URLRequest?) -> Void) {
    redirected = true
    completionHandler(nil)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                  completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    if emit == nil { completionHandler(.allow); return }
    guard let response = response as? HTTPURLResponse, response.statusCode == 200,
      response.mimeType == "text/event-stream" else {
      emit?(["state": "disconnected"])
      completionHandler(.cancel)
      return
    }
    emit?(["state": "connected"])
    completionHandler(.allow)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    do { for event in try parser.append(data) { emit?(["state": "data", "data": event]) } }
    catch { dataTask.cancel() }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    emit?(["state": trustFailed ? "trust-error" : "disconnected"])
  }
}

public class LumenLANModule: Module {
  private var streamSession: URLSession?

  public func definition() -> ModuleDefinition {
    Name("LumenLAN")
    Events("hueEvent")

    AsyncFunction("probe") { (connection: LANConnection) -> [String: String] in
      let trust = try connection.trust()
      guard connection.key.isEmpty, trust.isHue else { throw LANFailure.identity }
      let delegate = PinnedSession(trust: trust, probing: true)
      let result = try await self.perform(delegate: delegate, path: "/api/config", method: "GET", body: "", key: "")
      guard let data = result.data(using: .utf8),
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
        (object["bridgeid"] as? String)?.lowercased() == trust.identity.lowercased(),
        let fingerprint = delegate.observedFingerprint else { throw LANFailure.identity }
      return ["fingerprint": fingerprint]
    }

    AsyncFunction("request") { (connection: LANConnection, path: String, method: String, body: String) -> String in
      guard ["GET", "POST", "PUT"].contains(method), !connection.fingerprint.isEmpty else { throw LANFailure.certificate }
      let delegate = PinnedSession(trust: try connection.trust())
      return try await self.perform(delegate: delegate, path: path, method: method, body: body, key: connection.key)
    }

    Function("startEvents") { (connection: LANConnection, generation: String) in
      self.streamSession?.invalidateAndCancel()
      let delegate = PinnedSession(trust: try connection.trust())
      delegate.emit = { [weak self] event in self?.sendEvent("hueEvent", event.merging(["generation": generation]) { _, new in new }) }
      var request = URLRequest(url: try delegate.trust.url(path: "/eventstream/clip/v2"))
      request.setValue(connection.key, forHTTPHeaderField: "hue-application-key")
      request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
      let session = delegate.session()
      self.streamSession = session
      session.dataTask(with: request).resume()
    }
    Function("stopEvents") { self.streamSession?.invalidateAndCancel(); self.streamSession = nil }
    OnDestroy { self.streamSession?.invalidateAndCancel() }
  }

  private func perform(delegate: PinnedSession, path: String, method: String, body: String, key: String) async throws -> String {
    var request = URLRequest(url: try delegate.trust.url(path: path))
    request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if !key.isEmpty {
      request.setValue(delegate.trust.isHue ? key : "Bearer \(key)",
        forHTTPHeaderField: delegate.trust.isHue ? "hue-application-key" : "Authorization")
    }
    if !body.isEmpty { request.httpBody = body.data(using: .utf8) }
    let session = delegate.session()
    defer { session.invalidateAndCancel() }
    do {
      let (data, response) = try await session.data(for: request)
      if delegate.redirected { throw LANFailure.redirect }
      guard data.count <= 4_194_304, let response = response as? HTTPURLResponse else { throw LANFailure.tooLarge }
      if response.statusCode == 401 || response.statusCode == 403 {
        throw NSError(domain: "LumenLAN", code: 401, userInfo: [NSLocalizedDescriptionKey: "Pairing expired or the device token was rejected. Reconnect in Connections."])
      }
      guard (200...299).contains(response.statusCode) else { throw LANFailure.response }
      return String(decoding: data, as: UTF8.self)
    } catch {
      if delegate.trustFailed { throw LANFailure.certificate }
      if let failure = error as? LANFailure { throw failure }
      if (error as NSError).domain == "LumenLAN" { throw error }
      throw NSError(domain: "LumenLAN", code: (error as NSError).code, userInfo: [NSLocalizedDescriptionKey:
        "Cannot reach this device. Check Wi-Fi, its address, and Settings → Privacy & Security → Local Network → Lumen."])
    }
  }
}
