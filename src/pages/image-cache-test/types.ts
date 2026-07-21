export type ImageRequestWorkerRequest = {
  requestId: string;
  url: string;
};

export type ImageRequestResult = {
  cacheLevel: string | null;
  elapsedMs: number;
  ok: boolean;
  responseType: ResponseType;
  source: "main" | "worker";
  status: number;
};

export type ImageRequestWorkerResponse =
  | ({
      requestId: string;
      type: "complete";
    } & ImageRequestResult)
  | {
      error: string;
      requestId: string;
      source: "worker";
      type: "error";
    };
