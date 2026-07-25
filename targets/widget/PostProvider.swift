import Foundation
import WidgetKit
import os.log

private let APP_GROUP_ID = "group.com.sweatbuds.app"
private let DEFAULTS_KEY = "latestPost"
private let providerLog = OSLog(subsystem: "com.sweatbuds.app", category: "widget-provider")

struct PostProvider: TimelineProvider {
  func placeholder(in context: Context) -> PostEntry {
    PostEntry.sample
  }

  func getSnapshot(in context: Context, completion: @escaping (PostEntry) -> Void) {
    completion(loadEntry() ?? PostEntry.sample)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<PostEntry>) -> Void) {
    os_log("getTimeline called", log: providerLog, type: .info)
    let entry = loadEntry() ?? PostEntry(
      date: Date(),
      state: .empty,
      selfiePath: nil,
      environmentPath: nil,
      caption: nil,
      partnerName: nil,
      loggedAt: nil,
      streak: 0
    )
    os_log(
      "emitting entry state=%{public}@ selfie=%{public}@ env=%{public}@",
      log: providerLog,
      type: .info,
      entry.state.rawValue,
      entry.selfiePath ?? "<nil>",
      entry.environmentPath ?? "<nil>"
    )
    // The host app drives refreshes via WidgetCenter.reloadTimelines on every
    // partner-log push and on app foreground. We still set a fallback refresh
    // a few hours out so a stale tile eventually retries on its own.
    let next = Date().addingTimeInterval(60 * 60 * 6)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func loadEntry() -> PostEntry? {
    guard let defaults = UserDefaults(suiteName: APP_GROUP_ID) else {
      os_log("loadEntry: UserDefaults(suiteName:) returned nil", log: providerLog, type: .error)
      return nil
    }
    guard let data = defaults.data(forKey: DEFAULTS_KEY) else {
      os_log("loadEntry: defaults has no data for key %{public}@", log: providerLog, type: .info, DEFAULTS_KEY)
      return nil
    }
    guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      os_log("loadEntry: JSON parse failed (%{public}d bytes)", log: providerLog, type: .error, data.count)
      return nil
    }

    let stateRaw = json["state"] as? String ?? "empty"
    let state = WidgetState(rawValue: stateRaw) ?? .empty

    let selfiePath = json["selfiePath"] as? String
    let environmentPath = json["environmentPath"] as? String
    let selfieExists = selfiePath.map { FileManager.default.fileExists(atPath: $0) } ?? false
    let envExists = environmentPath.map { FileManager.default.fileExists(atPath: $0) } ?? false
    os_log(
      "loadEntry: state=%{public}@ selfieExists=%{public}@ envExists=%{public}@",
      log: providerLog,
      type: .info,
      state.rawValue,
      selfieExists ? "true" : "false",
      envExists ? "true" : "false"
    )

    let loggedAt: Date? = {
      guard let s = json["loggedAt"] as? String else { return nil }
      let formatter = ISO8601DateFormatter()
      formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      if let d = formatter.date(from: s) { return d }
      formatter.formatOptions = [.withInternetDateTime]
      return formatter.date(from: s)
    }()

    return PostEntry(
      date: Date(),
      state: state,
      selfiePath: selfiePath,
      environmentPath: environmentPath,
      caption: json["caption"] as? String,
      partnerName: json["partnerName"] as? String,
      loggedAt: loggedAt,
      streak: (json["streak"] as? Int) ?? 0
    )
  }
}
