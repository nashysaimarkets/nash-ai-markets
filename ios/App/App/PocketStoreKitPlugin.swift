import Capacitor
import Foundation
import Security
import StoreKit
import UIKit
import OSLog

@objc(PocketStoreKitPlugin)
public class PocketStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PocketStoreKitPlugin"
    public let jsName = "PocketStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumeFreeUse", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recordSuccessfulAnalysis", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestReviewIfEligible", returnType: CAPPluginReturnPromise)
    ]

    private let freeUseKey = "com.nashaimarkets.pocketbullseye.free-use-consumed.v1"
    private let successfulAnalysisCountKey = "com.nashaimarkets.pocketbullseye.successful-analysis-count.v1"
    private let reviewRequestedKey = "com.nashaimarkets.pocketbullseye.review-requested.v1"
    private let logger = Logger(subsystem: "com.nashaimarkets.pocketbullseye", category: "Purchases")
    private let monthlyProductId = "com.nashaimarkets.pocketbullseye.monthly"
    private var transactionUpdatesTask: Task<Void, Never>?
    @MainActor private var cachedProduct: Product?
    @MainActor private var storeActionRunning = false

    public override func load() {
        // Apple delivers unfinished and out-of-app transactions here at launch.
        // A purchase-button-only implementation misses this recovery path.
        transactionUpdatesTask = Task { @MainActor [weak self] in
            for await result in Transaction.updates {
                guard !Task.isCancelled, let self else { return }
                guard case .verified(let transaction) = result,
                      transaction.productID == self.monthlyProductId else { continue }
                let active = await self.activeEntitlement(productId: self.monthlyProductId, completedTransaction: transaction)
                let payload = await self.statusPayload(productId: self.monthlyProductId, product: self.cachedProduct, active: active)
                if active != nil || !self.storeActionRunning {
                    self.notifyListeners("accessChanged", data: payload, retainUntilConsumed: true)
                }
                await transaction.finish()
            }
        }
    }

    deinit { transactionUpdatesTask?.cancel() }

    @objc func getStatus(_ call: CAPPluginCall) {
        Task { @MainActor in await resolveStatus(call, productId: call.getString("productId") ?? "") }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        let productId = call.getString("productId") ?? ""
        Task { @MainActor in
            guard !storeActionRunning else { call.reject("Apple is still handling the previous request.", "STORE_REQUEST_BUSY"); return }
            storeActionRunning = true
            defer { storeActionRunning = false }
            logger.info("Purchase requested")
            do {
                guard productId == monthlyProductId else {
                    call.reject("This Apple product is not supported by Pocket Bullseye.", "STORE_PRODUCT_MISMATCH")
                    return
                }
                // Settle verified deliveries left by an older launch before
                // asking Apple for a new purchase. This is not a purchase retry.
                await reconcileUnfinishedTransactions(productId: productId)
                if let active = await activeEntitlement(productId: productId) {
                    call.resolve(await statusPayload(productId: productId, product: cachedProduct, active: active))
                    return
                }
                // Capacitor invokes plugins on its bridge queue. StoreKit's
                // confirmation must use the foreground scene on the main actor.
                guard let scene = bridge?.viewController?.view.window?.windowScene,
                      scene.activationState == .foregroundActive else {
                    call.reject("Open Pocket Bullseye in the foreground and try again.", "STORE_SCENE_UNAVAILABLE")
                    return
                }
                let loadedProduct: Product?
                if let cachedProduct, cachedProduct.id == productId {
                    loadedProduct = cachedProduct
                } else {
                    loadedProduct = try await Product.products(for: [productId]).first
                }
                guard let product = loadedProduct else {
                    call.reject("Pocket Bullseye Monthly is temporarily unavailable from Apple. Please try again shortly.", "STORE_PRODUCT_UNAVAILABLE")
                    return
                }
                cachedProduct = product
                logger.info("Presenting Apple purchase confirmation")
                let result: Product.PurchaseResult
                if #available(iOS 17.0, *) {
                    result = try await product.purchase(confirmIn: scene)
                } else {
                    result = try await product.purchase()
                }
                switch result {
                case .success(let verification):
                    let transaction = try verified(verification)
                    guard transaction.productID == productId else {
                        call.reject("Apple returned a purchase for a different product. Please contact support.", "STORE_PRODUCT_MISMATCH")
                        return
                    }
                    if let active = await activeEntitlement(productId: productId, completedTransaction: transaction) {
                        // Deliver access before acknowledging the transaction.
                        call.resolve(await statusPayload(productId: productId, product: product, active: active))
                        await transaction.finish()
                        logger.info("Purchase verified and access delivered")
                    } else {
                        let state = purchaseState(transaction, productId: productId)
                        await transaction.finish()
                        logger.error("Purchase returned inactive transaction: \(state.rawValue, privacy: .public)")
                        call.reject(inactivePurchaseMessage(state), "STORE_TRANSACTION_\(state.rawValue.uppercased())")
                    }
                case .pending:
                    call.reject("Purchase pending Apple approval. Check your access again after approval.", "STORE_PURCHASE_PENDING")
                case .userCancelled:
                    call.reject("Purchase cancelled.", "STORE_PURCHASE_CANCELLED")
                @unknown default:
                    call.reject("Apple returned an unknown purchase result.")
                }
            } catch {
                logger.error("Purchase failed: \((error as NSError).code)")
                call.reject(error.localizedDescription, "STORE_PURCHASE_FAILED")
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        let productId = call.getString("productId") ?? ""
        Task { @MainActor in
            guard !storeActionRunning else { call.reject("Apple is still handling the previous request.", "STORE_REQUEST_BUSY"); return }
            storeActionRunning = true
            defer { storeActionRunning = false }
            logger.info("Restore requested")
            do {
                try await AppStore.sync()
                // Restoring ownership must not depend on another catalogue
                // request succeeding after Apple has finished account sync.
                await resolveStatus(call, productId: productId, product: cachedProduct, loadProduct: false)
                logger.info("Restore status returned")
            } catch {
                logger.error("Restore failed: \((error as NSError).code)")
                call.reject(error.localizedDescription, "STORE_RESTORE_FAILED")
            }
        }
    }

    @objc func consumeFreeUse(_ call: CAPPluginCall) {
        guard writeKeychain(Data([1])) else {
            call.reject("The completed free analysis could not be secured on this device.")
            return
        }
        call.resolve(["freeUseConsumed": true])
    }

    @objc func recordSuccessfulAnalysis(_ call: CAPPluginCall) {
        let defaults = UserDefaults.standard
        let count = defaults.integer(forKey: successfulAnalysisCountKey) + 1
        defaults.set(count, forKey: successfulAnalysisCountKey)
        call.resolve([
            "successfulAnalysisCount": count,
            "eligible": count >= 2 && !defaults.bool(forKey: reviewRequestedKey)
        ])
    }

    @objc func requestReviewIfEligible(_ call: CAPPluginCall) {
        let defaults = UserDefaults.standard
        let count = defaults.integer(forKey: successfulAnalysisCountKey)
        guard count >= 2, !defaults.bool(forKey: reviewRequestedKey) else {
            call.resolve([
                "successfulAnalysisCount": count,
                "eligible": false,
                "requested": false
            ])
            return
        }

        DispatchQueue.main.async {
            guard let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }) else {
                call.resolve([
                    "successfulAnalysisCount": count,
                    "eligible": true,
                    "requested": false
                ])
                return
            }

            // Record the request before invoking StoreKit so repeated taps can
            // never spam Apple's system-controlled review prompt. Apple alone
            // decides whether the prompt is displayed.
            defaults.set(true, forKey: self.reviewRequestedKey)
            if #available(iOS 16.0, *) {
                AppStore.requestReview(in: scene)
            } else {
                SKStoreReviewController.requestReview(in: scene)
            }
            call.resolve([
                "successfulAnalysisCount": count,
                "eligible": true,
                "requested": true
            ])
        }
    }

    @MainActor
    private func resolveStatus(_ call: CAPPluginCall, productId: String, product suppliedProduct: Product? = nil, loadProduct: Bool = true, completedTransaction: Transaction? = nil) async {
        guard !productId.isEmpty else { call.reject("Missing Apple product identifier."); return }

        let product: Product?
        if let suppliedProduct {
            product = suppliedProduct
        } else if loadProduct {
            do {
                product = try await Product.products(for: [productId]).first
                cachedProduct = product
            } catch {
                logger.error("Product lookup failed: \((error as NSError).code)")
                product = nil
            }
        } else {
            product = nil
        }

        let active = await activeEntitlement(productId: productId, completedTransaction: completedTransaction)
        call.resolve(await statusPayload(productId: productId, product: product, active: active))
    }

    private func purchaseState(_ transaction: Transaction, productId: String) -> PocketPurchaseState {
        PocketPurchaseState.completed(matchesProduct: transaction.productID == productId,
                                      revoked: transaction.revocationDate != nil,
                                      upgraded: transaction.isUpgraded,
                                      expiration: transaction.expirationDate)
    }

    @MainActor
    private func activeEntitlement(productId: String, completedTransaction: Transaction? = nil) async -> Transaction? {
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  PocketPurchaseState.currentEntitlement(matchesProduct: transaction.productID == productId,
                                                         revoked: transaction.revocationDate != nil,
                                                         upgraded: transaction.isUpgraded) else { continue }
            return transaction
        }
        // Accept a fresh verified purchase when the entitlement stream has not
        // caught up. Never turn an expired/revoked replay into paid access.
        if let transaction = completedTransaction, purchaseState(transaction, productId: productId) == .active {
            return transaction
        }
        return nil
    }

    @MainActor
    private func reconcileUnfinishedTransactions(productId: String) async {
        for await result in Transaction.unfinished {
            guard case .verified(let transaction) = result,
                  transaction.productID == productId else { continue }
            // Reconcile delivery without turning historical purchases into
            // access. Only current entitlements can recover existing access.
            await transaction.finish()
        }
    }

    private func inactivePurchaseMessage(_ state: PocketPurchaseState) -> String {
        switch state {
        case .expired:
            return "Apple returned an expired subscription instead of a new purchase. Complete Apple sign-in through Restore Purchases, then try Subscribe again."
        case .revoked:
            return "Apple returned a refunded or revoked subscription. Check your Apple Account subscriptions before trying again."
        case .superseded:
            return "Apple returned a subscription that was replaced by another plan. Use Restore Purchases to check your current access."
        default:
            return "Apple returned a purchase without valid subscription dates. Use Restore Purchases to check your access, or contact support if this continues."
        }
    }

    @MainActor
    private func statusPayload(productId: String, product: Product?, active: Transaction?) async -> [String: Any] {
        var payload: [String: Any] = [
            "isNative": true,
            "entitled": active != nil,
            "freeUseConsumed": readKeychain() != nil,
            "productId": productId,
            "displayName": product?.displayName ?? "Pocket Bullseye Monthly",
            "displayPrice": product?.displayPrice ?? "",
            "productAvailable": product != nil,
            "currencyCode": product?.priceFormatStyle.currencyCode ?? "",
            "isSandbox": Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
        ]
        if let storefront = await Storefront.current { payload["storefrontCountryCode"] = storefront.countryCode }
        if let transaction = active {
            payload["transactionId"] = String(transaction.id)
            payload["originalTransactionId"] = String(transaction.originalID)
        }
        return payload
    }

    private func verified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let safe): return safe
        case .unverified: throw StoreError.failedVerification
        }
    }

    private func readKeychain() -> Data? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: freeUseKey, kSecAttrAccount as String: freeUseKey, kSecReturnData as String: true]
        var item: CFTypeRef?
        return SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess ? item as? Data : nil
    }

    private func writeKeychain(_ data: Data) -> Bool {
        let identity: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: freeUseKey, kSecAttrAccount as String: freeUseKey]
        SecItemDelete(identity as CFDictionary)
        var item = identity
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
    }

    private enum StoreError: LocalizedError {
        case failedVerification
        var errorDescription: String? { "Apple could not verify this purchase." }
    }
}
