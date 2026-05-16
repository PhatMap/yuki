import type { RuntimeDiagnosticsReport } from "@/lib/settings/runtime-diagnostics";

export function createRuntimeDiagnosticsFileName(
  report: RuntimeDiagnosticsReport,
) {
  const timestamp = report.generatedAt
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");

  return `yuki-runtime-diagnostics-${timestamp}.json`;
}

export function downloadRuntimeDiagnosticsReport(
  report: RuntimeDiagnosticsReport,
) {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error(
      "Runtime diagnostics download is only available in the browser.",
    );
  }

  const fileName = createRuntimeDiagnosticsFileName(report);
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return fileName;
}
