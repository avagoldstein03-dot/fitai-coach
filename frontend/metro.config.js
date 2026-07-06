const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Three.js ships as "type":"module" (ESM).
// 1. Enable package-exports so Metro follows three's exports map.
// 2. Expand transformIgnorePatterns so Babel compiles three + expo-three
//    (Metro skips node_modules by default, leaving ESM syntax un-compiled).
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["require", "default"];
config.transformer.transformIgnorePatterns = [
  "node_modules/(?!(react-native|@react-native|expo|@expo|@unimodules|nativewind|three|expo-three)/)",
];

// react-native-svg ships web-compatible components alongside native ones.
// Without this resolver, Metro serves the native RNSVGSvgView stubs on web,
// which throws "Unimplemented component: <RNSVGSvgView>".
const origResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-svg") {
    return context.resolveRequest(
      context,
      "react-native-svg/src/ReactNativeSVG.web",
      platform,
    );
  }
  return origResolveRequest
    ? origResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
