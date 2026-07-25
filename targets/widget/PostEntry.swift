import Foundation
import WidgetKit

enum WidgetState: String {
  case empty
  case noPartner
  case noLogs
  case ready
}

struct PostEntry: TimelineEntry {
  let date: Date
  let state: WidgetState
  let selfiePath: String?
  let environmentPath: String?
  let caption: String?
  let partnerName: String?
  let loggedAt: Date?
  let streak: Int

  static let placeholder = PostEntry(
    date: Date(),
    state: .empty,
    selfiePath: nil,
    environmentPath: nil,
    caption: nil,
    partnerName: nil,
    loggedAt: nil,
    streak: 0
  )

  static let sample = PostEntry(
    date: Date(),
    state: .ready,
    selfiePath: nil,
    environmentPath: nil,
    caption: "tough class so sore lol",
    partnerName: "Riley",
    loggedAt: Date(),
    streak: 2
  )
}
