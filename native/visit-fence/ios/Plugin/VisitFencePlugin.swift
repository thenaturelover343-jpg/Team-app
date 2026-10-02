import Capacitor
import CoreLocation
import Foundation
import Security
import UIKit
import UserNotifications

@objc(VisitFenceBootstrap)
public class VisitFenceBootstrap: NSObject {
    @objc public static func start() {
        VisitFenceEngine.shared.start()
    }
}

@objc(VisitFencePlugin)
public class VisitFencePlugin: CAPPlugin {
    @objc func arm(_ call: CAPPluginCall) {
        VisitFenceEngine.shared.onMain { VisitFenceEngine.shared.arm(call) }
    }

    @objc func disarm(_ call: CAPPluginCall) {
        VisitFenceEngine.shared.onMain {
            VisitFenceEngine.shared.disarm()
            call.resolve()
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        VisitFenceEngine.shared.onMain {
            VisitFenceEngine.shared.setPaused(true)
            call.resolve()
        }
    }

    @objc func resume(_ call: CAPPluginCall) {
        VisitFenceEngine.shared.onMain {
            VisitFenceEngine.shared.setPaused(false)
            call.resolve()
        }
    }
}

final class VisitFenceEngine: NSObject, CLLocationManagerDelegate {
    static let shared = VisitFenceEngine()
    private let defaults = UserDefaults.standard
    private var manager: CLLocationManager?
    private var pending: CAPPluginCall?
    private var askedAlways = false
    private var armedSites = ""
    private var dwellTimers: [String: DispatchWorkItem] = [:]

    func onMain(_ work: @escaping () -> Void) {
        if Thread.isMainThread { work() } else { DispatchQueue.main.async(execute: work) }
    }

    func start() {
        onMain {
            self.prepare()
            guard self.defaults.double(forKey: "vf.until") > Date().timeIntervalSince1970 else { return }
            self.defaults.set(true, forKey: "vf.checkExit")
            self.enableBackgroundUpdates()
            self.restoreRegions()
            self.manager?.requestLocation()
        }
    }

    func arm(_ call: CAPPluginCall) {
        prepare()
        let sites = siteMaps(call)
        guard !sites.isEmpty else {
            store(call, sites: [])
            stopRegions()
            call.resolve()
            return
        }
        guard !(call.getString("refreshToken") ?? "").isEmpty else {
            call.reject("Meld opnieuw aan in de geïnstalleerde app zodat de klanttijd ook dicht mag lopen.")
            return
        }
        pending = call
        store(call, sites: sites)
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        let status = manager?.authorizationStatus ?? .notDetermined
        if status == .authorizedAlways {
            finishArm(call)
        } else if status == .notDetermined || (status == .authorizedWhenInUse && !askedAlways) {
            askedAlways = true
            manager?.requestAlwaysAuthorization()
        } else {
            pending = nil
            call.reject("Zet locatie op Altijd, anders stopt de klanttijd als de app dicht is.")
        }
    }

    func disarm() {
        prepare()
        dwellTimers.values.forEach { $0.cancel() }
        dwellTimers.removeAll()
        defaults.removeObject(forKey: "vf.dwell")
        stopRegions()
        manager?.stopUpdatingLocation()
        armedSites = ""
        for key in ["vf.api", "vf.origin", "vf.key", "vf.sites", "vf.until", "vf.paused", "vf.checkExit"] {
            defaults.removeObject(forKey: key)
        }
        deleteSecret()
    }

    func setPaused(_ paused: Bool) {
        defaults.set(paused, forKey: "vf.paused")
        if paused {
            defaults.set(true, forKey: "vf.checkExit")
            dwellTimers.values.forEach { $0.cancel() }
            dwellTimers.removeAll()
            manager?.stopUpdatingLocation()
        }
    }

    private func prepare() {
        if manager != nil { return }
        let location = CLLocationManager()
        location.delegate = self
        location.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        location.distanceFilter = 25
        location.activityType = .other
        manager = location
    }

    private func store(_ call: CAPPluginCall, sites: [[String: Any]]) {
        defaults.set(call.getString("apiUrl") ?? "", forKey: "vf.api")
        defaults.set(call.getString("origin") ?? "", forKey: "vf.origin")
        defaults.set(call.getString("apiKey") ?? "", forKey: "vf.key")
        defaults.set(call.getDouble("armedUntil") ?? (Date().timeIntervalSince1970 + 16 * 3600), forKey: "vf.until")
        defaults.set(false, forKey: "vf.paused")
        if let token = call.getString("refreshToken"), !token.isEmpty { saveSecret(token) }
        if let data = try? JSONSerialization.data(withJSONObject: sites) {
            defaults.set(data, forKey: "vf.sites")
        }
    }

    private func finishArm(_ call: CAPPluginCall) {
        enableBackgroundUpdates()
        let signature = defaults.data(forKey: "vf.sites")?.base64EncodedString() ?? ""
        if signature != armedSites {
            armedSites = signature
            stopRegions()
            restoreRegions()
        }
        manager?.requestLocation()
        call.resolve()
        pending = nil
    }

    private func enableBackgroundUpdates() {
        guard manager?.authorizationStatus == .authorizedAlways else { return }
        manager?.allowsBackgroundLocationUpdates = true
        manager?.pausesLocationUpdatesAutomatically = false
        manager?.showsBackgroundLocationIndicator = true
    }

    private func stopRegions() {
        guard let manager else { return }
        for region in manager.monitoredRegions { manager.stopMonitoring(for: region) }
    }

    private func restoreRegions() {
        guard let manager, let data = defaults.data(forKey: "vf.sites"),
              let sites = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return }
        for site in sites.prefix(20) {
            guard let id = site["id"] as? String, let lat = number(site["lat"]), let lng = number(site["lng"]) else { continue }
            let radius = max(200, number(site["radius"]) ?? 200)
            let region = CLCircularRegion(center: CLLocationCoordinate2D(latitude: lat, longitude: lng), radius: radius, identifier: id)
            region.notifyOnEntry = true
            region.notifyOnExit = true
            manager.startMonitoring(for: region)
        }
    }

    private func active() -> Bool {
        !defaults.bool(forKey: "vf.paused") && defaults.double(forKey: "vf.until") > Date().timeIntervalSince1970
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard let call = pending else { return }
        let status = manager.authorizationStatus
        if status == .authorizedAlways {
            finishArm(call)
        } else if status == .denied || status == .restricted || (status == .authorizedWhenInUse && askedAlways) {
            pending = nil
            call.reject("Zet locatie op Altijd, anders stopt de klanttijd als de app dicht is.")
        }
    }

    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        beginDwell(region.identifier)
    }

    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        let started = dwellStart(region.identifier)
        clearDwell(region.identifier)
        guard active() else { return }
        let location = manager.location ?? center(of: region)
        if started > 0 && Date().timeIntervalSince1970 - started >= 120 {
            post(location: location, dwell: true, exit: false) { [weak self] in
                self?.post(location: location, dwell: false, exit: true, done: nil)
            }
        } else {
            post(location: location, dwell: false, exit: true, done: nil)
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard active(), let location = locations.last, location.horizontalAccuracy > 0 else { return }
        var inside = false
        for region in manager.monitoredRegions {
            guard let circle = region as? CLCircularRegion, circle.contains(location.coordinate) else { continue }
            inside = true
            beginDwell(circle.identifier)
        }
        confirmAgedDwells(at: location)
        if defaults.bool(forKey: "vf.checkExit"), location.horizontalAccuracy <= 100 {
            defaults.set(false, forKey: "vf.checkExit")
            if !inside { post(location: location, dwell: false, exit: true, done: nil) }
        }
        if !inside {
            dwellTimers.values.forEach { $0.cancel() }
            dwellTimers.removeAll()
            if dwellMap().isEmpty { manager.stopUpdatingLocation() }
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}

    private func beginDwell(_ id: String) {
        guard active() else { return }
        if dwellStart(id) == 0 { setDwell(id, Date().timeIntervalSince1970) }
        manager?.startUpdatingLocation()
        guard dwellTimers[id] == nil else { return }
        let work = DispatchWorkItem { [weak self] in self?.confirmDwell(id) }
        dwellTimers[id] = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 120, execute: work)
    }

    private func confirmDwell(_ id: String) {
        dwellTimers[id] = nil
        guard active(), let manager, let location = manager.location, location.horizontalAccuracy > 0 else { return }
        guard let region = manager.monitoredRegions.first(where: { $0.identifier == id }) as? CLCircularRegion,
              region.contains(location.coordinate) else { return }
        clearDwell(id)
        post(location: location, dwell: true, exit: false, done: nil)
        if dwellMap().isEmpty && dwellTimers.isEmpty { manager.stopUpdatingLocation() }
    }

    private func confirmAgedDwells(at location: CLLocation) {
        guard let manager else { return }
        let now = Date().timeIntervalSince1970
        for (id, started) in dwellMap() {
            guard now - started >= 120 else { continue }
            guard let region = manager.monitoredRegions.first(where: { $0.identifier == id }) as? CLCircularRegion,
                  region.contains(location.coordinate) else { continue }
            clearDwell(id)
            dwellTimers[id]?.cancel()
            dwellTimers[id] = nil
            post(location: location, dwell: true, exit: false, done: nil)
        }
        if dwellMap().isEmpty && dwellTimers.isEmpty { manager.stopUpdatingLocation() }
    }

    private func post(location: CLLocation, dwell: Bool, exit: Bool, done: (() -> Void)?) {
        let api = defaults.string(forKey: "vf.api") ?? ""
        let apiKey = defaults.string(forKey: "vf.key") ?? ""
        let refresh = loadSecret()
        guard let apiUrl = URL(string: api), !apiKey.isEmpty, !refresh.isEmpty,
              let tokenUrl = URL(string: "https://securetoken.googleapis.com/v1/token?key=\(apiKey)") else {
            done?()
            return
        }
        let task = beginBackground()
        var tokenRequest = URLRequest(url: tokenUrl)
        tokenRequest.httpMethod = "POST"
        tokenRequest.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let encoded = refresh.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? refresh
        tokenRequest.httpBody = "grant_type=refresh_token&refresh_token=\(encoded)".data(using: .utf8)
        URLSession.shared.dataTask(with: tokenRequest) { data, _, _ in
            guard let data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let idToken = json["id_token"] as? String else {
                done?()
                self.endBackground(task)
                return
            }
            if let next = json["refresh_token"] as? String, !next.isEmpty { self.saveSecret(next) }
            let accuracy = location.horizontalAccuracy > 0 ? location.horizontalAccuracy : 50
            let body: [String: Any] = [
                "action": "syncVisitLocation",
                "input": [
                    "confirmedDwell": dwell,
                    "confirmedExit": exit,
                    "location": [
                        "lat": location.coordinate.latitude,
                        "lng": location.coordinate.longitude,
                        "accuracy": min(max(accuracy, 1), 5000),
                        "capturedAt": Int(location.timestamp.timeIntervalSince1970 * 1000),
                    ],
                ] as [String: Any],
            ]
            var request = URLRequest(url: apiUrl)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
            request.setValue("visit-fence", forHTTPHeaderField: "X-Team-Client")
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
            URLSession.shared.dataTask(with: request) { data, _, _ in
                if let data,
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let payload = json["data"] as? [String: Any],
                   let choices = payload["choices"] as? [Any], choices.count >= 2 {
                    self.notifyAmbiguous()
                }
                done?()
                self.endBackground(task)
            }.resume()
        }.resume()
    }

    private func notifyAmbiguous() {
        let content = UNMutableNotificationContent()
        content.title = "Twee klanten"
        content.body = "Twee adressen liggen in dezelfde cirkel. Open de app en kies. We gokken niet."
        content.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "visit-ambiguous", content: content, trigger: nil))
    }

    private func beginBackground() -> UIBackgroundTaskIdentifier {
        var id: UIBackgroundTaskIdentifier = .invalid
        id = UIApplication.shared.beginBackgroundTask(withName: "visit-fence") {
            if id != .invalid { UIApplication.shared.endBackgroundTask(id) }
        }
        return id
    }

    private func endBackground(_ id: UIBackgroundTaskIdentifier) {
        guard id != .invalid else { return }
        DispatchQueue.main.async { UIApplication.shared.endBackgroundTask(id) }
    }

    private func dwellMap() -> [String: Double] {
        let raw = defaults.dictionary(forKey: "vf.dwell") ?? [:]
        var map: [String: Double] = [:]
        for (key, value) in raw {
            if let number = value as? NSNumber { map[key] = number.doubleValue }
        }
        return map
    }

    private func dwellStart(_ id: String) -> Double { dwellMap()[id] ?? 0 }

    private func setDwell(_ id: String, _ time: Double) {
        var map = dwellMap()
        map[id] = time
        defaults.set(map, forKey: "vf.dwell")
    }

    private func clearDwell(_ id: String) {
        var map = dwellMap()
        map.removeValue(forKey: id)
        defaults.set(map, forKey: "vf.dwell")
    }

    private func center(of region: CLRegion) -> CLLocation {
        guard let circle = region as? CLCircularRegion else { return CLLocation(latitude: 0, longitude: 0) }
        return CLLocation(latitude: circle.center.latitude, longitude: circle.center.longitude)
    }

    private func siteMaps(_ call: CAPPluginCall) -> [[String: Any]] {
        guard let raw = call.options["sites"] else { return [] }
        let list: [Any]
        if let array = raw as? [Any] { list = array }
        else if let array = raw as? NSArray { list = array.map { $0 } }
        else { return [] }
        return list.compactMap { item in
            let row = item as? [String: Any]
            guard let row, let id = row["id"] as? String, let lat = number(row["lat"]), let lng = number(row["lng"]) else { return nil }
            return ["id": id, "lat": lat, "lng": lng, "radius": max(200, number(row["radius"]) ?? 200)]
        }
    }

    private func number(_ value: Any?) -> Double? {
        if let value = value as? NSNumber { return value.doubleValue }
        if let value = value as? String { return Double(value) }
        return nil
    }

    private func saveSecret(_ value: String) {
        let account = "vf.refresh"
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: account]
        SecItemDelete(query as CFDictionary)
        var next = query
        next[kSecValueData as String] = Data(value.utf8)
        next[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(next as CFDictionary, nil)
    }

    private func loadSecret() -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "vf.refresh",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }

    private func deleteSecret() {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: "vf.refresh"]
        SecItemDelete(query as CFDictionary)
    }
}
