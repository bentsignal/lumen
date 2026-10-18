import Cocoa
import AVFoundation

final class CameraTest: NSObject, AVCaptureFileOutputRecordingDelegate {
    let session = AVCaptureSession()
    let movie = AVCaptureMovieFileOutput()
    let output = URL(fileURLWithPath: "/path/to/private/lg-hue-setup/logs/c920-timing.mov")
    func begin() {
        AVCaptureDevice.requestAccess(for: .video) { granted in
            guard granted else { self.finish("Camera access denied"); return }
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    let devices = AVCaptureDevice.devices(for: .video)
                    guard let camera = devices.first(where: { $0.localizedName.contains("C920") || $0.localizedName.contains("C922") }) else { self.finish("C920 not found"); return }
                    self.session.beginConfiguration()
                    self.session.sessionPreset = .hd1280x720
                    let input = try AVCaptureDeviceInput(device: camera)
                    guard self.session.canAddInput(input), self.session.canAddOutput(self.movie) else { self.finish("Cannot configure camera"); return }
                    self.session.addInput(input)
                    self.session.addOutput(self.movie)
                    self.movie.maxRecordedDuration = CMTime(seconds: 12, preferredTimescale: 600)
                    self.session.commitConfiguration()
                    try? FileManager.default.removeItem(at: self.output)
                    self.session.startRunning()
                    self.movie.startRecording(to: self.output, recordingDelegate: self)
                    print("Recording camera only: \(camera.localizedName)")
                } catch { self.finish("Camera error: \(error)") }
            }
        }
    }
    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo fileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        session.stopRunning()
        finish("Saved camera-only recording: \(fileURL.path); \(String(describing: error))")
    }
    func finish(_ text: String) {
        try? text.write(toFile: "/path/to/private/lg-hue-setup/logs/camera-test-status.txt", atomically: true, encoding: .utf8)
        DispatchQueue.main.async { NSApplication.shared.terminate(nil) }
    }
}
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let recorder = CameraTest()
recorder.begin()
DispatchQueue.main.asyncAfter(deadline: .now() + 45) { recorder.finish("Camera capture timed out") }
app.run()
