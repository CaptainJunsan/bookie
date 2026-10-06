// The app's brand mark wherever it sits next to the "Bookie" wordmark —
// uses the same favicon.svg as the browser tab/home-screen icon so the logo
// is consistent everywhere, instead of the 📚 emoji placeholder it replaces.
export default function Logo({ size = 24 }: { size?: number }) {
  return <img src="/favicon.svg" alt="" width={size} height={size} className="shrink-0" />;
}
