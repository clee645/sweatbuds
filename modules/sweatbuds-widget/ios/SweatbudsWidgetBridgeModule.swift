import ExpoModulesCore
import WidgetKit
import os.log

private let APP_GROUP_ID = "group.com.sweatbuds.app"
private let DEFAULTS_KEY = "latestPost"
private let WIDGET_KIND = "SweatbudsWidget"
private let bridgeLog = OSLog(subsystem: "com.sweatbuds.app", category: "widget-bridge")

public class SweatbudsWidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SweatbudsWidgetBridge")

    AsyncFunction("setLatestPost") { (input: [String: Any], promise: Promise) in
      guard let containerURL = sharedContainerURL() else {
        promise.reject("E_NO_CONTAINER", "App Group container unavailable. Check entitlements for \(APP_GROUP_ID).")
        return
      }

      do {
        let widgetDir = containerURL.appendingPathComponent("widget", isDirectory: true)
        try FileManager.default.createDirectory(at: widgetDir, withIntermediateDirectories: true)

        guard
          let selfieUri = input["selfieUri"] as? String,
          let envUri = input["environmentUri"] as? String,
          let source = input["source"] as? String,
          let partnerName = input["partnerName"] as? String,
          let loggedAt = input["loggedAt"] as? String
        else {
          promise.reject("E_BAD_ARGS", "setLatestPost requires selfieUri, environmentUri, source, partnerName, loggedAt")
          return
        }

        let selfieDest = widgetDir.appendingPathComponent("\(source)-selfie.jpg")
        let envDest = widgetDir.appendingPathComponent("\(source)-environment.jpg")
        try copyLocalFile(from: selfieUri, to: selfieDest)
        try copyLocalFile(from: envUri, to: envDest)

        let payload: [String: Any?] = [
          "state": "ready",
          "source": source,
          "selfiePath": selfieDest.path,
          "environmentPath": envDest.path,
          "caption": input["caption"] as? String,
          "partnerName": partnerName,
          "loggedAt": loggedAt,
          "streak": (input["streak"] as? Int) ?? 0,
        ]

        try writeDefaults(payload.compactMapValues { $0 })

        WidgetCenter.shared.reloadTimelines(ofKind: WIDGET_KIND)
        os_log("reloadTimelines kind=%{public}@ source=%{public}@", log: bridgeLog, type: .info, WIDGET_KIND, source)
        promise.resolve(nil)
      } catch {
        promise.reject("E_WIDGET_WRITE_FAILED", error.localizedDescription)
      }
    }

    AsyncFunction("setEmptyState") { (state: String, partnerName: String?, promise: Promise) in
      do {
        var payload: [String: Any] = ["state": state]
        if let name = partnerName { payload["partnerName"] = name }
        try writeDefaults(payload)
        WidgetCenter.shared.reloadTimelines(ofKind: WIDGET_KIND)
        os_log("reloadTimelines kind=%{public}@ emptyState=%{public}@", log: bridgeLog, type: .info, WIDGET_KIND, state)
        promise.resolve(nil)
      } catch {
        promise.reject("E_WIDGET_WRITE_FAILED", error.localizedDescription)
      }
    }

    AsyncFunction("clear") { (promise: Promise) in
      if let defaults = UserDefaults(suiteName: APP_GROUP_ID) {
        defaults.removeObject(forKey: DEFAULTS_KEY)
      }
      if let containerURL = sharedContainerURL() {
        let widgetDir = containerURL.appendingPathComponent("widget", isDirectory: true)
        try? FileManager.default.removeItem(at: widgetDir)
      }
      WidgetCenter.shared.reloadTimelines(ofKind: WIDGET_KIND)
      os_log("reloadTimelines kind=%{public}@ cleared", log: bridgeLog, type: .info, WIDGET_KIND)
      promise.resolve(nil)
    }
  }
}

private func sharedContainerURL() -> URL? {
  return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: APP_GROUP_ID)
}

private func copyLocalFile(from sourceUri: String, to dest: URL) throws {
  let sourceURL: URL
  if sourceUri.hasPrefix("file://") {
    sourceURL = URL(string: sourceUri)!
  } else {
    sourceURL = URL(fileURLWithPath: sourceUri)
  }
  if FileManager.default.fileExists(atPath: dest.path) {
    try FileManager.default.removeItem(at: dest)
  }
  try FileManager.default.copyItem(at: sourceURL, to: dest)
}

private func writeDefaults(_ payload: [String: Any]) throws {
  guard let defaults = UserDefaults(suiteName: APP_GROUP_ID) else {
    throw NSError(domain: "SweatbudsWidget", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not open shared UserDefaults"])
  }
  let data = try JSONSerialization.data(withJSONObject: payload, options: [])
  defaults.set(data, forKey: DEFAULTS_KEY)
  defaults.synchronize()
  let stateForLog = (payload["state"] as? String) ?? "<unknown>"
  os_log("writeDefaults state=%{public}@ bytes=%{public}d", log: bridgeLog, type: .info, stateForLog, data.count)
}
