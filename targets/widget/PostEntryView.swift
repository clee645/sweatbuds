import ImageIO
import SwiftUI
import WidgetKit

private let ACCENT = Color(red: 1.0, green: 90.0/255.0, blue: 95.0/255.0)
// Small widgets have a ~30MB memory budget. Decoding a 1080x1620 JPEG into a
// full UIImage allocates ~7MB, and we render two images per widget (selfie +
// environment inset), which silently OOMs WidgetKit and renders blank. We use
// ImageIO to decode a downsampled thumbnail sized for the widget's pixel
// footprint (small widget ≈ 158pt × 3x = ~474px).
private let WIDGET_IMAGE_MAX_PIXELS: CGFloat = 600

struct PostEntryView: View {
  let entry: PostEntry

  var body: some View {
    ZStack {
      switch entry.state {
      case .ready:
        readyBody
      case .noPartner:
        emptyBody(
          glyph: "♥",
          title: "Sweatbuds",
          subtitle: "Pair up to see your\npartner's workouts"
        )
      case .noLogs:
        emptyBody(
          glyph: "🏃",
          title: entry.partnerName ?? "Your partner",
          subtitle: "hasn't logged yet"
        )
      case .empty:
        emptyBody(
          glyph: "♥",
          title: "Sweatbuds",
          subtitle: "Open the app to get started"
        )
      }
    }
    .widgetURL(URL(string: "sweatbuds://"))
  }

  @ViewBuilder
  private var readyBody: some View {
    GeometryReader { geo in
      let w = geo.size.width
      let insetW = w * 0.27
      let insetH = insetW
      let isStale = stalenessDays() > 7

      ZStack(alignment: .topLeading) {
        Color.black

        if let selfie = loadImage(entry.selfiePath) {
          Image(uiImage: selfie)
            .resizable()
            .scaledToFill()
            .frame(width: geo.size.width, height: geo.size.height)
            .clipped()
            .opacity(isStale ? 0.7 : 1.0)
            .privacySensitive(true)
        } else {
          LinearGradient(
            colors: [Color(white: 0.12), Color(white: 0.03)],
            startPoint: .top, endPoint: .bottom
          )
        }

        if let env = loadImage(entry.environmentPath) {
          Image(uiImage: env)
            .resizable()
            .scaledToFill()
            .frame(width: insetW, height: insetH)
            .clipShape(RoundedRectangle(cornerRadius: 7))
            .overlay(
              RoundedRectangle(cornerRadius: 7)
                .stroke(.black, lineWidth: 0.5)
            )
            .shadow(color: .black.opacity(0.4), radius: 4, x: 0, y: 2)
            .padding(12)
            .privacySensitive(true)
        }

        // top-right chip: streak (or "Nd ago" when stale)
        if isStale, let days = stalenessDaysOptional() {
          chip(text: "\(days)d ago")
            .frame(maxWidth: .infinity, alignment: .topTrailing)
            .padding(.top, 14)
            .padding(.trailing, 14)
        } else if entry.streak >= 1 {
          chip(text: "🔥 \(entry.streak)")
            .frame(maxWidth: .infinity, alignment: .topTrailing)
            .padding(.top, 14)
            .padding(.trailing, 14)
        }

        if let caption = entry.caption, !caption.isEmpty {
          VStack {
            Spacer()
            Text(caption)
              .font(.system(size: 11, weight: .medium))
              .foregroundColor(.white)
              .lineLimit(2)
              .multilineTextAlignment(.center)
              .padding(.horizontal, 8)
              .padding(.vertical, 4)
              .background(Color.black.opacity(0.85))
              .clipShape(Capsule())
              .padding(.bottom, 8)
              .padding(.horizontal, 6)
              .privacySensitive(true)
          }
          .frame(maxWidth: .infinity)
        }
      }
    }
  }

  private func chip(text: String) -> some View {
    Text(text)
      .font(.system(size: 10, weight: .semibold))
      .foregroundColor(.white)
      .padding(.horizontal, 6)
      .padding(.vertical, 3)
      .background(Color.black.opacity(0.7))
      .clipShape(Capsule())
  }

  private func emptyBody(glyph: String, title: String, subtitle: String) -> some View {
    VStack(spacing: 6) {
      Text(glyph)
        .font(.system(size: 28))
        .foregroundColor(ACCENT)
      Text(title)
        .font(.system(size: 13, weight: .semibold))
        .foregroundColor(.white)
      Text(subtitle)
        .font(.system(size: 11, weight: .medium))
        .foregroundColor(Color(white: 0.7))
        .multilineTextAlignment(.center)
        .lineLimit(3)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .padding(8)
    .background(Color.black)
  }

  private func loadImage(_ path: String?) -> UIImage? {
    guard let path = path, !path.isEmpty else { return nil }
    let url = URL(fileURLWithPath: path)
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceThumbnailMaxPixelSize: WIDGET_IMAGE_MAX_PIXELS,
      kCGImageSourceShouldCacheImmediately: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
    ]
    guard
      let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    else { return nil }
    return UIImage(cgImage: cgImage)
  }

  private func stalenessDaysOptional() -> Int? {
    guard let logged = entry.loggedAt else { return nil }
    let secs = Date().timeIntervalSince(logged)
    if secs < 0 { return 0 }
    return Int(secs / 86_400)
  }

  private func stalenessDays() -> Int {
    stalenessDaysOptional() ?? 0
  }
}
