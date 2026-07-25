import SwiftUI
import WidgetKit

struct SweatbudsWidget: Widget {
  let kind: String = "SweatbudsWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: PostProvider()) { entry in
      PostEntryView(entry: entry)
        .widgetContainerBackground(Color.black)
    }
    .configurationDisplayName("Sweatbuds")
    .description("Your partner's last workout.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

extension View {
  // iOS 17 requires every widget view to declare its container background via
  // .containerBackground(for: .widget). On iOS 16 the same modifier doesn't
  // exist; falling back to a plain .background keeps the same visual result.
  @ViewBuilder
  func widgetContainerBackground<Background: View>(_ background: Background) -> some View {
    if #available(iOS 17.0, *) {
      self.containerBackground(for: .widget) { background }
    } else {
      self.background(background)
    }
  }
}
