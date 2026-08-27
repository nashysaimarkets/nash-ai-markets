import Capacitor

final class PocketBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PocketStoreKitPlugin())
    }
}
