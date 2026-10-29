import ExpoModulesCore
import UIKit
import Vision

/// On-device "where is the car": Apple's attention-based saliency gives the box of the most eye-catching object
/// in the photo in a few milliseconds, with no network. The scan frame locks onto it while the AI is still thinking,
/// and the AI gets a crop of it instead of the whole frame.
public final class CarFinderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CarFinder")

    /// Bounding box of the main subject as fractions of the image (x, y from the top-left, w, h), plus Vision's
    /// confidence. Resolves with nil when the picture cannot be read or nothing stands out.
    AsyncFunction("salientBox") { (path: String) throws -> [String: Double]? in
      return try CarFinder.salientBox(path)
    }
  }
}

enum CarFinder {
  static func salientBox(_ path: String) throws -> [String: Double]? {
    let filePath: String
    if let url = URL(string: path), url.isFileURL {
      filePath = url.path
    } else {
      filePath = path.replacingOccurrences(of: "file://", with: "")
    }
    guard let img = UIImage(contentsOfFile: filePath), let cg = img.cgImage else { return nil }
    let request = VNGenerateAttentionBasedSaliencyImageRequest()
    let handler = VNImageRequestHandler(cgImage: cg, orientation: orientation(img.imageOrientation), options: [:])
    try handler.perform([request])
    guard let observation = request.results?.first,
          let objects = observation.salientObjects,
          let best = objects.max(by: { $0.confidence < $1.confidence }) else { return nil }
    // Vision boxes are normalised with the origin at the BOTTOM-left; the app wants the top-left
    let b = best.boundingBox
    return [
      "x": Double(b.minX),
      "y": Double(1 - b.maxY),
      "w": Double(b.width),
      "h": Double(b.height),
      "confidence": Double(best.confidence),
    ]
  }

  private static func orientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch o {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
