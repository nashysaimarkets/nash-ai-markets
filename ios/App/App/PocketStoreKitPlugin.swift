import Capacitor
import Foundation
import Security
import StoreKit

@objc(PocketStoreKitPlugin)
public class PocketStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PocketStoreKitPlugin"
    public let jsName = "PocketStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumeFreeUse", returnType: CAPPluginReturnPromise)
    ]

    private let freeUseKey = "com.nashaimarkets.pocketbullseye.free-use-consumed.v1"

    @objc func getStatus(_ call: CAPPluginCall) {
        Task { await resolveStatus(call, productId: call.getString("productId") ?? "") }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        let productId = call.getString("productId") ?? ""
        Task {
            do {
                guard let product = try await Product.products(for: [productId]).first else {
                    call.reject("Pocket Bullseye Monthly is temporarily unavailable from Apple.")
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let transaction = try verified(verification)
                    await transaction.finish()
                    await resolveStatus(call, productId: productId, product: product)
                case .pending:
                    call.reject("Purchase pending Apple approval.")
                case .userCancelled:
                    call.reject("Purchase cancelled.")
                @unknown default:
                    call.reject("Apple returned an unknown purchase result.")
                }
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        let productId = call.getString("productId") ?? ""
        Task {
            do {
                try await AppStore.sync()
                await resolveStatus(call, productId: productId)
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func consumeFreeUse(_ call: CAPPluginCall) {
        guard writeKeychain(Data([1])) else {
            call.reject("The completed free analysis could not be secured on this device.")
            return
        }
        call.resolve(["freeUseConsumed": true])
    }

    private func resolveStatus(_ call: CAPPluginCall, productId: String, product suppliedProduct: Product? = nil) async {
        guard !productId.isEmpty else { call.reject("Missing Apple product identifier."); return }

        let product: Product?
        if let suppliedProduct {
            product = suppliedProduct
        } else {
            do {
                product = try await Product.products(for: [productId]).first
            } catch {
                product = nil
            }
        }

        var active: Transaction?
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  transaction.productID == productId,
                  transaction.revocationDate == nil else { continue }
            active = transaction
            break
        }
        var payload: [String: Any] = [
            "isNative": true,
            "entitled": active != nil,
            "freeUseConsumed": readKeychain() != nil,
            "productId": productId,
            "displayName": product?.displayName ?? "Pocket Bullseye Monthly",
            "displayPrice": product?.displayPrice ?? "£4.99"
        ]
        if let transaction = active {
            payload["transactionId"] = String(transaction.id)
            payload["originalTransactionId"] = String(transaction.originalID)
        }
        call.resolve(payload)
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
