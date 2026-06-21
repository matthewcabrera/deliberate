// Next.js runs this once on server startup. Set up Arize tracing only in the
// Node.js runtime (the OpenTelemetry Node SDK can't load on the edge runtime).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupTracing } = await import("./lib/otel");
    setupTracing();
  }
}
