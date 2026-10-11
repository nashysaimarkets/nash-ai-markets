import Capacitor

final class PocketBridgeViewController: CAPBridgeViewController {
    override public func capacitorDidLoad() {
        bridge?.registerPluginInstance(PocketStoreKitPlugin())
    }
}
