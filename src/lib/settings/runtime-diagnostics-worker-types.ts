export interface RuntimeDiagnosticsWorkerPingMessage {
  type: "ping";
  requestId: string;
}

export interface RuntimeDiagnosticsWorkerPongMessage {
  type: "pong";
  requestId: string;
  indexedDbAvailable: boolean;
  generatedAt: string;
}

export interface RuntimeDiagnosticsWorkerErrorMessage {
  type: "error";
  requestId: string;
  errorMessage: string;
}

export type RuntimeDiagnosticsWorkerIncomingMessage =
  RuntimeDiagnosticsWorkerPingMessage;

export type RuntimeDiagnosticsWorkerOutgoingMessage =
  | RuntimeDiagnosticsWorkerPongMessage
  | RuntimeDiagnosticsWorkerErrorMessage;
