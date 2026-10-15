import Foundation

// Only error domains/codes leave the native error object. Never serialize
// userInfo, descriptions, account identifiers, receipts, or request URLs.
enum PocketStoreDiagnostics {
    static let allowedDomains: Set<String> = [
        "StoreKit.StoreKitError", "SKErrorDomain", "ASDErrorDomain", "AMSErrorDomain",
        "NSURLErrorDomain", "NSCocoaErrorDomain", "NSPOSIXErrorDomain",
        "NSOSStatusErrorDomain", "AKAuthenticationError", "ACErrorDomain"
    ]

    static func errorCodes(_ error: Error, underlying: Error? = nil) -> [[String: Any]] {
        var codes: [[String: Any]] = []
        var seen = Set<ObjectIdentifier>()
        var next: NSError? = error as NSError
        var associated = underlying.map { $0 as NSError }
        while let current = next, codes.count < 4 {
            guard seen.insert(ObjectIdentifier(current)).inserted else { break }
            codes.append([
                "domain": allowedDomains.contains(current.domain) ? current.domain : "Other",
                "code": current.code
            ])
            if let nested = current.userInfo[NSUnderlyingErrorKey] as? NSError {
                next = nested
            } else {
                next = associated
                associated = nil
            }
        }
        return codes
    }
}
