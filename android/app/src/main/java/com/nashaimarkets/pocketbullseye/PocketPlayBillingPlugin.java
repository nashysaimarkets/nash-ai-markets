package com.nashaimarkets.pocketbullseye;

import android.content.Context;
import android.content.SharedPreferences;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "PocketPlayBilling")
public class PocketPlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private static final String PREFERENCES_NAME = "PocketBullseyeNativeAccess";
    private static final String FREE_USE_KEY = "free_analysis_consumed_v1";
    private static final String DEFAULT_PRODUCT_ID = "pocket_bullseye_monthly";
    private static final String DEFAULT_DISPLAY_NAME = "Pocket Bullseye Monthly";
    private static final String DEFAULT_DISPLAY_PRICE = "Google Play";

    private BillingClient billingClient;
    private SharedPreferences preferences;
    private PluginCall activePurchaseCall;
    private ProductDetails activeProductDetails;

    private interface ReadyAction {
        void run();
    }

    @Override
    public void load() {
        preferences = getContext().getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build()
            )
            .enableAutoServiceReconnection()
            .build();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        String productId = productId(call);
        withBillingReady(call, () -> queryStatus(call, productId));
    }

    @PluginMethod
    public void restore(PluginCall call) {
        String productId = productId(call);
        withBillingReady(call, () -> queryStatus(call, productId));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = productId(call);
        synchronized (this) {
            if (activePurchaseCall != null) {
                call.reject("Another Google Play purchase is already in progress.");
                return;
            }
            activePurchaseCall = call;
        }
        withBillingReady(call, () -> queryExistingBeforePurchase(call, productId));
    }

    @PluginMethod
    public void consumeFreeUse(PluginCall call) {
        boolean stored = preferences.edit().putBoolean(FREE_USE_KEY, true).commit();
        if (!stored) {
            call.reject("The free analysis could not be secured on this device.");
            return;
        }
        JSObject result = new JSObject();
        result.put("freeUseConsumed", true);
        call.resolve(result);
    }

    private void queryExistingBeforePurchase(PluginCall call, String productId) {
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build();
        billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
            if (!isOk(billingResult)) {
                rejectPurchase(call, playError("Google Play could not check existing purchases", billingResult));
                return;
            }
            Purchase active = activePurchase(purchases, productId);
            if (active != null) {
                acknowledgeAndResolve(call, productId, null, active);
                return;
            }
            queryProductForPurchase(call, productId);
        });
    }

    private void queryProductForPurchase(PluginCall call, String productId) {
        queryProductDetails(productId, (billingResult, productDetails) -> {
            if (!isOk(billingResult)) {
                rejectPurchase(call, playError("Google Play could not load this subscription", billingResult));
                return;
            }
            if (productDetails == null) {
                rejectPurchase(call, "Pocket Bullseye Monthly is not available from Google Play in this account or territory.");
                return;
            }
            ProductDetails.SubscriptionOfferDetails offer = basePlanOffer(productDetails);
            if (offer == null) {
                rejectPurchase(call, "Google Play did not return an eligible monthly subscription offer.");
                return;
            }
            activeProductDetails = productDetails;
            BillingFlowParams.ProductDetailsParams productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(productDetails)
                .setOfferToken(offer.getOfferToken())
                .build();
            BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(productParams))
                .setIsOfferPersonalized(false)
                .build();
            getActivity().runOnUiThread(() -> {
                BillingResult launch = billingClient.launchBillingFlow(getActivity(), flowParams);
                if (!isOk(launch)) rejectPurchase(call, playError("Google Play could not open the purchase screen", launch));
            });
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        PluginCall call;
        synchronized (this) {
            call = activePurchaseCall;
        }
        if (call == null) return;
        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            rejectPurchase(call, "Purchase cancelled. You have not been charged.");
            return;
        }
        if (!isOk(billingResult)) {
            rejectPurchase(call, playError("Google Play could not complete the purchase", billingResult));
            return;
        }
        String productId = activeProductDetails == null ? DEFAULT_PRODUCT_ID : activeProductDetails.getProductId();
        Purchase purchase = purchaseForProduct(purchases, productId);
        if (purchase == null) {
            rejectPurchase(call, "Google Play returned no Pocket Bullseye purchase.");
            return;
        }
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            resolvePurchase(call, status(productId, activeProductDetails, purchase, false, true));
            return;
        }
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) {
            rejectPurchase(call, "The Google Play purchase was not completed. You have not been charged.");
            return;
        }
        acknowledgeAndResolve(call, productId, activeProductDetails, purchase);
    }

    private void queryStatus(PluginCall call, String productId) {
        queryProductDetails(productId, (productResult, productDetails) -> {
            QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build();
            billingClient.queryPurchasesAsync(params, (purchaseResult, purchases) -> {
                if (!isOk(purchaseResult)) {
                    call.reject(playError("Google Play could not verify subscription status", purchaseResult));
                    return;
                }
                Purchase active = activePurchase(purchases, productId);
                Purchase pending = pendingPurchase(purchases, productId);
                if (active != null && !active.isAcknowledged()) {
                    acknowledgeAndResolve(call, productId, productDetails, active);
                    return;
                }
                call.resolve(status(productId, productDetails, active != null ? active : pending, active != null, pending != null));
            });
        });
    }

    private interface ProductResult {
        void accept(BillingResult billingResult, ProductDetails productDetails);
    }

    private void queryProductDetails(String productId, ProductResult callback) {
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(productId)
            .setProductType(BillingClient.ProductType.SUBS)
            .build();
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(product))
            .build();
        billingClient.queryProductDetailsAsync(params, (billingResult, queryResult) -> {
            ProductDetails match = null;
            if (isOk(billingResult) && queryResult != null) {
                for (ProductDetails item : queryResult.getProductDetailsList()) {
                    if (productId.equals(item.getProductId())) {
                        match = item;
                        break;
                    }
                }
            }
            callback.accept(billingResult, match);
        });
    }

    private void acknowledgeAndResolve(PluginCall call, String productId, ProductDetails details, Purchase purchase) {
        if (purchase.isAcknowledged()) {
            if (isActivePurchase(purchase, productId)) {
                if (call == activePurchaseCall) resolvePurchase(call, status(productId, details, purchase, true, false));
                else call.resolve(status(productId, details, purchase, true, false));
            } else {
                if (call == activePurchaseCall) rejectPurchase(call, "Google Play could not verify an active Pocket Bullseye subscription.");
                else call.reject("Google Play could not verify an active Pocket Bullseye subscription.");
            }
            return;
        }
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();
        billingClient.acknowledgePurchase(params, result -> {
            if (!isOk(result)) {
                String message = playError("Google Play could not acknowledge the subscription", result);
                if (call == activePurchaseCall) rejectPurchase(call, message);
                else call.reject(message);
                return;
            }
            if (call == activePurchaseCall) resolvePurchase(call, status(productId, details, purchase, true, false));
            else call.resolve(status(productId, details, purchase, true, false));
        });
    }

    private JSObject status(String productId, ProductDetails details, Purchase purchase, boolean entitled, boolean pending) {
        JSObject result = new JSObject();
        result.put("isNative", true);
        result.put("entitled", entitled);
        result.put("freeUseConsumed", preferences.getBoolean(FREE_USE_KEY, false));
        result.put("productId", productId);
        result.put("displayName", details == null ? DEFAULT_DISPLAY_NAME : details.getName());
        result.put("displayPrice", displayPrice(details));
        result.put("pending", pending);
        if (purchase != null) result.put("purchaseToken", purchase.getPurchaseToken());
        if (purchase != null && purchase.getOrderId() != null) result.put("orderId", purchase.getOrderId());
        return result;
    }

    private String displayPrice(ProductDetails details) {
        ProductDetails.SubscriptionOfferDetails offer = basePlanOffer(details);
        if (offer == null) return DEFAULT_DISPLAY_PRICE;
        List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
        if (phases.isEmpty()) return DEFAULT_DISPLAY_PRICE;
        return phases.get(phases.size() - 1).getFormattedPrice();
    }

    private ProductDetails.SubscriptionOfferDetails basePlanOffer(ProductDetails details) {
        if (details == null || details.getSubscriptionOfferDetails() == null) return null;
        ProductDetails.SubscriptionOfferDetails fallback = null;
        for (ProductDetails.SubscriptionOfferDetails offer : details.getSubscriptionOfferDetails()) {
            if (fallback == null) fallback = offer;
            if (offer.getOfferId() == null) return offer;
        }
        return fallback;
    }

    private Purchase activePurchase(List<Purchase> purchases, String productId) {
        for (Purchase purchase : safePurchases(purchases)) {
            if (isActivePurchase(purchase, productId)) return purchase;
        }
        return null;
    }

    private Purchase pendingPurchase(List<Purchase> purchases, String productId) {
        for (Purchase purchase : safePurchases(purchases)) {
            if (purchase.getProducts().contains(productId) && purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) return purchase;
        }
        return null;
    }

    private Purchase purchaseForProduct(List<Purchase> purchases, String productId) {
        for (Purchase purchase : safePurchases(purchases)) {
            if (purchase.getProducts().contains(productId)) return purchase;
        }
        return null;
    }

    private boolean isActivePurchase(Purchase purchase, String productId) {
        return purchase.getProducts().contains(productId) && purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED;
    }

    private List<Purchase> safePurchases(List<Purchase> purchases) {
        return purchases == null ? new ArrayList<>() : purchases;
    }

    private void withBillingReady(PluginCall call, ReadyAction action) {
        if (billingClient == null) {
            call.reject("Google Play Billing is not available on this device.");
            clearPurchaseIf(call);
            return;
        }
        if (billingClient.isReady()) {
            action.run();
            return;
        }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                if (isOk(result)) action.run();
                else {
                    call.reject(playError("Google Play Billing could not connect", result));
                    clearPurchaseIf(call);
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Automatic reconnection is enabled for the next BillingClient request.
            }
        });
    }

    private String productId(PluginCall call) {
        String supplied = call.getString("productId", DEFAULT_PRODUCT_ID);
        return supplied == null || supplied.isBlank() ? DEFAULT_PRODUCT_ID : supplied;
    }

    private boolean isOk(BillingResult result) {
        return result != null && result.getResponseCode() == BillingClient.BillingResponseCode.OK;
    }

    private String playError(String prefix, BillingResult result) {
        String detail = result == null ? "unknown response" : result.getDebugMessage();
        return detail == null || detail.isBlank() ? prefix + "." : prefix + ": " + detail;
    }

    private void resolvePurchase(PluginCall call, JSObject result) {
        clearPurchaseIf(call);
        call.resolve(result);
    }

    private void rejectPurchase(PluginCall call, String message) {
        clearPurchaseIf(call);
        call.reject(message);
    }

    private synchronized void clearPurchaseIf(PluginCall call) {
        if (activePurchaseCall == call) {
            activePurchaseCall = null;
            activeProductDetails = null;
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (billingClient == null) return;
        if (!billingClient.isReady()) return;
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build();
        billingClient.queryPurchasesAsync(params, (result, purchases) -> {
            if (!isOk(result)) return;
            Purchase active = activePurchase(purchases, DEFAULT_PRODUCT_ID);
            if (active != null && !active.isAcknowledged()) {
                AcknowledgePurchaseParams acknowledge = AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(active.getPurchaseToken())
                    .build();
                billingClient.acknowledgePurchase(acknowledge, ignored -> {});
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (activePurchaseCall != null) rejectPurchase(activePurchaseCall, "The purchase screen closed before Google Play returned a result.");
        if (billingClient != null && billingClient.isReady()) billingClient.endConnection();
        super.handleOnDestroy();
    }
}
