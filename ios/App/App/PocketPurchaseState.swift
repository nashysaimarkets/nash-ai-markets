import Foundation

// Only pass StoreKit-verified transactions to this policy. A purchase response
// is not automatically a current subscription (for example, an old sandbox
// renewal can already have expired). Current entitlements also include grace.
enum PocketPurchaseState: String {
    case active, expired, revoked, superseded, wrongProduct, missingExpiration

    static func completed(matchesProduct: Bool, revoked: Bool, upgraded: Bool,
                          expiration: Date?, now: Date = Date()) -> Self {
        guard matchesProduct else { return .wrongProduct }
        guard !revoked else { return .revoked }
        guard !upgraded else { return .superseded }
        guard let expiration else { return .missingExpiration }
        return expiration > now ? .active : .expired
    }

    static func currentEntitlement(matchesProduct: Bool, revoked: Bool, upgraded: Bool) -> Bool {
        // Do not reject Apple's current-entitlement stream by the last paid
        // expiry date: Billing Grace Period is an active service entitlement.
        matchesProduct && !revoked && !upgraded
    }
}
