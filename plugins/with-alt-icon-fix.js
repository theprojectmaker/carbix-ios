/**
 * expo-alternate-app-icons 8.0.0 calls the Swift async `UIApplication.setAlternateIconName(_:)`, which on this phone ends
 * with "Unexpected exception: the operation was cancelled" (Promise.swift) and the icon never changes. The older
 * completion-handler version of the same call does not have that problem, so this plugin swaps the module's Swift file
 * for one that uses it. It runs during prebuild, before the iOS project is built.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SWIFT = `import ExpoModulesCore
import UIKit

public class ExpoAlternateAppIconsModule: Module {
    private var supportsAlternateIcons = UIApplication.shared.supportsAlternateIcons

    public func definition() -> ModuleDefinition {
        Name("ExpoAlternateAppIcons")

        Constants({
          return [
            "supportsAlternateIcons": self.supportsAlternateIcons
          ]
        })

        AsyncFunction("setAlternateAppIcon", setAlternateAppIcon)
        Function("getAppIconName", getAppIconName)
    }

    private func getAppIconName() -> String? {
        return UIApplication.shared.alternateIconName
    }

    private func setAlternateAppIcon(icon: String?, promise: Promise) -> Void {
        DispatchQueue.main.async {
            UIApplication.shared.setAlternateIconName(icon) { error in
                if let error = error {
                    promise.reject(error)
                } else {
                    promise.resolve(icon)
                }
            }
        }
    }
}
`;

module.exports = function withAltIconFix(config) {
  return withDangerousMod(config, [
    'ios',
    (c) => {
      const file = path.join(c.modRequest.projectRoot, 'node_modules', 'expo-alternate-app-icons', 'ios', 'ExpoAlternateAppIconsModule.swift');
      if (fs.existsSync(file)) fs.writeFileSync(file, SWIFT);
      else console.warn('with-alt-icon-fix: expo-alternate-app-icons Swift file not found, left as is');
      return c;
    },
  ]);
};
