// Lightweight no-op tracing shim. Arize/OpenTelemetry was removed; these stubs
// keep the existing `traced(...)` / `flushTraces()` call sites working without
// touching every route. If real observability is wanted later, swap this file.

export interface SpanLike {
  setAttribute(key: string, value: unknown): void;
  setAttributes(attrs: Record<string, unknown>): void;
}

const NOOP_SPAN: SpanLike = {
  setAttribute() {},
  setAttributes() {},
};

/** Run `fn`, passing a no-op span. (Tracing removed.) */
export async function traced<T>(
  _name: string,
  _attributes: Record<string, unknown>,
  fn: (span: SpanLike) => Promise<T>,
): Promise<T> {
  return fn(NOOP_SPAN);
}

export async function flushTraces(): Promise<void> {
  // no-op
}
