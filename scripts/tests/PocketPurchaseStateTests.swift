import Foundation

@main
struct PocketPurchaseStateTests {
    static func main() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let future = now.addingTimeInterval(300)
        let past = now.addingTimeInterval(-300)
        let purchases: [(String, Bool, Bool, Bool, Date?, PocketPurchaseState)] = [
            ("fresh verified subscription", true, false, false, future, .active),
            ("expired sandbox replay", true, false, false, past, .expired),
            ("expiry boundary", true, false, false, now, .expired),
            ("refunded purchase still has a future date", true, true, false, future, .revoked),
            ("replaced subscription", true, false, true, future, .superseded),
            ("different product cannot unlock Pocket", false, false, false, future, .wrongProduct),
            ("missing subscription expiry cannot become permanent access", true, false, false, nil, .missingExpiration)
        ]
        for (name, matches, revoked, upgraded, expiration, expected) in purchases {
            let actual = PocketPurchaseState.completed(matchesProduct: matches, revoked: revoked,
                                                        upgraded: upgraded, expiration: expiration, now: now)
            precondition(actual == expected, "Failed: \(name): \(actual) != \(expected)")
        }

        // Current entitlements are supplied by StoreKit, including Billing
        // Grace Period. They must not depend on a last-paid expiry timestamp.
        let current: [(Bool, Bool, Bool, Bool)] = [
            (true, false, false, true),
            (true, true, false, false),
            (true, false, true, false),
            (true, true, true, false),
            (false, false, false, false),
            (false, true, false, false),
            (false, false, true, false),
            (false, true, true, false)
        ]
        for (matches, revoked, upgraded, expected) in current {
            precondition(PocketPurchaseState.currentEntitlement(matchesProduct: matches, revoked: revoked,
                                                                upgraded: upgraded) == expected,
                         "Current entitlement policy failed")
        }
        print("PASS: 15 native subscription state cases (including expired replay and Billing Grace Period)")
    }
}
