import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    /// Full-screen cover shown while the app is inactive/backgrounded so that
    /// financial data never appears in the iOS app switcher snapshot.
    private var privacyCover: UIView?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneWillResignActive(_ scene: UIScene) {
        showPrivacyCover()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        hidePrivacyCover()
    }

    private func showPrivacyCover() {
        guard privacyCover == nil, let window = window else { return }

        let cover = UIView(frame: window.bounds)
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        // slate-950, matches the web app's background so the transition is seamless
        cover.backgroundColor = UIColor(red: 0.008, green: 0.024, blue: 0.090, alpha: 1.0)

        let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterialDark))
        blur.frame = cover.bounds
        blur.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.addSubview(blur)

        if let mark = UIImage(named: "Splash") {
            let imageView = UIImageView(image: mark)
            imageView.contentMode = .scaleAspectFit
            imageView.alpha = 0.9
            imageView.translatesAutoresizingMaskIntoConstraints = false
            cover.addSubview(imageView)
            NSLayoutConstraint.activate([
                imageView.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
                imageView.centerYAnchor.constraint(equalTo: cover.centerYAnchor),
                imageView.widthAnchor.constraint(equalToConstant: 120),
                imageView.heightAnchor.constraint(equalToConstant: 120),
            ])
        }

        window.addSubview(cover)
        privacyCover = cover
    }

    private func hidePrivacyCover() {
        guard let cover = privacyCover else { return }
        privacyCover = nil
        UIView.animate(withDuration: 0.2, animations: {
            cover.alpha = 0
        }, completion: { _ in
            cover.removeFromSuperview()
        })
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
