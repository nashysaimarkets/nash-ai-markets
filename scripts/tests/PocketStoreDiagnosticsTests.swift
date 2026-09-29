import Foundation

@main
struct PocketStoreDiagnosticsTests {
    static func main() throws {
        var checks = 0
        func check(_ condition: Bool, _ name: String) {
            precondition(condition, name)
            checks += 1
        }
        let unknown = NSError(domain: "StoreKit.StoreKitError", code: 2, userInfo: [:])
        let plain = PocketStoreDiagnostics.errorCodes(unknown)
        check(plain.count == 1 && plain[0]["domain"] as? String == "StoreKit.StoreKitError" && plain[0]["code"] as? Int == 2,
              "Preserve the unknown StoreKit error without inventing its cause")

        let network = NSError(domain: NSURLErrorDomain, code: -1009,
                              userInfo: [NSLocalizedDescriptionKey: "private@example.test", "receipt": "private-receipt"])
        let system = NSError(domain: "ASDErrorDomain", code: 500,
                             userInfo: [NSUnderlyingErrorKey: network, "requestURL": "https://private.test/token"])
        let nested = PocketStoreDiagnostics.errorCodes(system)
        check(nested.count == 2, "Preserve an underlying NSError chain")
        check(nested[1]["code"] as? Int == -1009, "Preserve signed network error codes")
        let encoded = String(data: try JSONSerialization.data(withJSONObject: nested), encoding: .utf8)!
        check(!encoded.contains("private") && !encoded.contains("receipt") && !encoded.contains("requestURL"),
              "Do not expose userInfo, descriptions, receipts or URLs")

        let associated = PocketStoreDiagnostics.errorCodes(unknown, underlying: network)
        check(associated.count == 2 && associated[1]["domain"] as? String == NSURLErrorDomain,
              "Preserve StoreKit associated errors when userInfo is empty")
        let duplicate = PocketStoreDiagnostics.errorCodes(system, underlying: network)
        check(duplicate.count == 2, "Do not append an already-seen associated error")

        let privateDomain = NSError(domain: "account-private@example.test", code: 5)
        let redacted = PocketStoreDiagnostics.errorCodes(privateDomain)
        check(redacted[0]["domain"] as? String == "Other", "Unknown domains must not expose account data")

        var deep = NSError(domain: "AMSErrorDomain", code: 0)
        for i in 1...10 { deep = NSError(domain: "ASDErrorDomain", code: i, userInfo: [NSUnderlyingErrorKey: deep]) }
        let bounded = PocketStoreDiagnostics.errorCodes(deep)
        check(bounded.count == 4, "Bound error-chain size")
        check(bounded[0]["code"] as? Int == 10 && bounded[3]["code"] as? Int == 7,
              "Preserve error order within the bound")
        check(JSONSerialization.isValidJSONObject(bounded), "Error diagnostics must cross Capacitor as JSON")
        print("PASS: \(checks) native error diagnostic checks (bounded codes, underlying errors and privacy)")
    }
}
