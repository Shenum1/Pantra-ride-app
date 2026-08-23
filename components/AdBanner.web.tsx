// react-native-google-mobile-ads has no web build and pulls in native-only RN
// internals (codegenNativeComponent) that Metro can't bundle for web — even a
// runtime Platform.OS check doesn't help, since Metro statically resolves every
// require() in a file regardless of whether it runs. This .web.tsx variant keeps
// that import out of the web bundle entirely; Metro picks it automatically for
// web builds over components/AdBanner.tsx.
export default function AdBanner() {
  return null;
}
