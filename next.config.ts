import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the OpenTelemetry Node SDK out of the bundle so its dynamic requires
  // (protobufjs, etc.) load correctly at runtime.
  serverExternalPackages: [
    "@opentelemetry/sdk-trace-node",
    "@opentelemetry/sdk-trace-base",
    "@opentelemetry/exporter-trace-otlp-proto",
    "@opentelemetry/resources",
    "playwright-core",
    "@browserbasehq/sdk",
    "pdf-parse",
  ],
};

export default nextConfig;
