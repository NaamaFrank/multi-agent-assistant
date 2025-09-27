// Ambient declarations for the runtime-provided 'awslambda' object.
// This satisfies TypeScript; at runtime Lambda provides the real object.
declare const awslambda: {
  streamifyResponse: <T extends (event: any, responseStream: any, context: any) => any>(handler: T) => any;
  HttpResponseStream: {
    from: (
      stream: any,
      opts: { statusCode?: number; headers?: Record<string, string> }
    ) => {
      write: (chunk: string | Uint8Array) => void;
      end: () => void;
    };
  };
};
export {};
