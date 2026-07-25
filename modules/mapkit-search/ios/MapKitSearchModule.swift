import ExpoModulesCore
import MapKit
import CoreLocation

public class MapKitSearchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MapKitSearch")

    AsyncFunction("searchAsync") { (query: String, latitude: Double?, longitude: Double?, promise: Promise) in
      let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !trimmed.isEmpty else {
        promise.resolve([])
        return
      }

      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = trimmed
      request.resultTypes = [.pointOfInterest]
      request.pointOfInterestFilter = MKPointOfInterestFilter(including: [.fitnessCenter])

      if let lat = latitude, let lon = longitude {
        request.region = MKCoordinateRegion(
          center: CLLocationCoordinate2D(latitude: lat, longitude: lon),
          latitudinalMeters: 25_000,
          longitudinalMeters: 25_000
        )
      }

      MKLocalSearch(request: request).start { response, error in
        if let error = error {
          promise.reject("E_SEARCH_FAILED", error.localizedDescription)
          return
        }

        let items: [[String: Any?]] = (response?.mapItems ?? []).map { item in
          let placemark = item.placemark
          let addressParts = [placemark.thoroughfare, placemark.locality, placemark.administrativeArea]
            .compactMap { $0 }
          let identifier: String = {
            if let title = placemark.title, !title.isEmpty { return title }
            return "\(placemark.coordinate.latitude),\(placemark.coordinate.longitude)"
          }()
          return [
            "identifier": identifier,
            "name": item.name ?? "Unknown",
            "address": addressParts.isEmpty ? nil : addressParts.joined(separator: ", "),
            "latitude": placemark.coordinate.latitude,
            "longitude": placemark.coordinate.longitude,
          ]
        }

        promise.resolve(items)
      }
    }
  }
}
