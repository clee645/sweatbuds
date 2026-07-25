import UserNotifications
import WidgetKit
import os.log

private let APP_GROUP_ID = "group.com.sweatbuds.app"
private let DEFAULTS_KEY = "latestPost"
private let WIDGET_KIND = "SweatbudsWidget"
private let nseLog = OSLog(subsystem: "com.sweatbuds.app", category: "nse")

class NotificationService: UNNotificationServiceExtension {
  var contentHandler: ((UNNotificationContent) -> Void)?
  var bestAttemptContent: UNMutableNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    self.bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

    let userInfo = request.content.userInfo
    os_log(
      "NSE userInfo keys: %{public}@",
      log: nseLog,
      type: .info,
      userInfo.keys.map { String(describing: $0) }.joined(separator: ",")
    )

    // Expo Push Service nests the `data` field under `userInfo["body"]` on iOS.
    // Older / direct APNs payloads use `userInfo["data"]`. Accept either.
    let data: [String: Any]? = {
      if let body = userInfo["body"] as? [String: Any] { return body }
      if let direct = userInfo["data"] as? [String: Any] { return direct }
      return nil
    }()

    guard
      let bestAttempt = bestAttemptContent,
      let data = data,
      let type = data["type"] as? String,
      type == "partner_logged",
      let selfieUrlStr = data["selfie_url"] as? String,
      let envUrlStr = data["environment_url"] as? String,
      let selfieURL = URL(string: selfieUrlStr),
      let envURL = URL(string: envUrlStr),
      let partnerName = data["partner_name"] as? String,
      let loggedAt = data["logged_at"] as? String
    else {
      os_log(
        "NSE early-return: couldn't extract required fields from userInfo",
        log: nseLog,
        type: .info
      )
      contentHandler(request.content)
      return
    }

    let caption = data["caption"] as? String
    let streak: Int = {
      if let n = data["streak"] as? Int { return n }
      if let n = data["streak"] as? Double { return Int(n) }
      if let n = data["streak"] as? NSNumber { return n.intValue }
      return 0
    }()

    Task {
      do {
        try await updateWidget(
          selfieURL: selfieURL,
          envURL: envURL,
          partnerName: partnerName,
          loggedAt: loggedAt,
          caption: caption,
          streak: streak
        )
      } catch {
        os_log(
          "NSE updateWidget failed: %{public}@",
          log: nseLog,
          type: .error,
          error.localizedDescription
        )
      }
      contentHandler(bestAttempt)
    }
  }

  override func serviceExtensionTimeWillExpire() {
    if let contentHandler = contentHandler, let bestAttempt = bestAttemptContent {
      contentHandler(bestAttempt)
    }
  }

  private func updateWidget(
    selfieURL: URL,
    envURL: URL,
    partnerName: String,
    loggedAt: String,
    caption: String?,
    streak: Int
  ) async throws {
    guard let containerURL = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: APP_GROUP_ID
    ) else {
      throw NSError(
        domain: "NSE",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "App Group container unavailable"]
      )
    }

    let widgetDir = containerURL.appendingPathComponent("widget", isDirectory: true)
    try FileManager.default.createDirectory(at: widgetDir, withIntermediateDirectories: true)

    let selfieDest = widgetDir.appendingPathComponent("partner-selfie.jpg")
    let envDest = widgetDir.appendingPathComponent("partner-environment.jpg")

    async let selfieFetch = URLSession.shared.data(from: selfieURL)
    async let envFetch = URLSession.shared.data(from: envURL)
    let (selfieData, _) = try await selfieFetch
    let (envData, _) = try await envFetch

    if FileManager.default.fileExists(atPath: selfieDest.path) {
      try FileManager.default.removeItem(at: selfieDest)
    }
    if FileManager.default.fileExists(atPath: envDest.path) {
      try FileManager.default.removeItem(at: envDest)
    }
    try selfieData.write(to: selfieDest)
    try envData.write(to: envDest)

    var payload: [String: Any] = [
      "state": "ready",
      "source": "partner",
      "selfiePath": selfieDest.path,
      "environmentPath": envDest.path,
      "partnerName": partnerName,
      "loggedAt": loggedAt,
      "streak": streak,
    ]
    if let c = caption { payload["caption"] = c }

    guard let defaults = UserDefaults(suiteName: APP_GROUP_ID) else {
      throw NSError(
        domain: "NSE",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Shared UserDefaults unavailable"]
      )
    }
    let json = try JSONSerialization.data(withJSONObject: payload, options: [])
    defaults.set(json, forKey: DEFAULTS_KEY)
    defaults.synchronize()

    WidgetCenter.shared.reloadTimelines(ofKind: WIDGET_KIND)
    os_log("NSE wrote widget + reloaded timeline", log: nseLog, type: .info)
  }
}
