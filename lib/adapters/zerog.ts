// Browser-side adapters for 0G. They only talk to our own API routes:
// - the 0G API key and relay wallet key stay server-side,
// - storage routes only ever receive/return ciphertext.
import type { AiAdapter, AiResponse, AiTask, Progress, StorageAdapter, TranscribeResponse, UploadResult } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryable: boolean,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function asApiError(res: Response): Promise<ApiError> {
  let msg = `Request failed (${res.status})`;
  try {
    const j = (await res.json()) as { error?: string };
    if (j.error) msg = j.error;
  } catch {
    /* ignore */
  }
  return new ApiError(msg, res.status, res.status >= 500 || res.status === 429 || res.status === 408);
}

export class ZeroGAiAdapter implements AiAdapter {
  readonly name = "0g-private-computer";

  async transcribe(audio: Blob, signal?: AbortSignal): Promise<TranscribeResponse> {
    const fd = new FormData();
    const ext = audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : "webm";
    fd.append("file", audio, `voice.${ext}`);
    const res = await fetch("/api/ai/transcribe", { method: "POST", body: fd, signal });
    if (!res.ok) throw await asApiError(res);
    return (await res.json()) as TranscribeResponse;
  }

  async run(task: AiTask, input: unknown, signal?: AbortSignal): Promise<AiResponse> {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, input }),
      signal,
    });
    if (!res.ok) throw await asApiError(res);
    return (await res.json()) as AiResponse;
  }
}

export class ZeroGStorageAdapter implements StorageAdapter {
  readonly name = "0g-storage";

  upload(bytes: Uint8Array, onProgress?: Progress): Promise<UploadResult> {
    // XHR (not fetch) so we can report upload progress on slow networks.
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/storage/upload");
      xhr.setRequestHeader("content-type", "application/octet-stream");
      xhr.timeout = 180_000;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(0.4 * (e.loaded / e.total), "Sending encrypted backup");
      };
      xhr.upload.onload = () => onProgress?.(0.45, "Storing on the backup network");
      xhr.onload = () => {
        let body: { error?: string } & Partial<UploadResult> = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          /* ignore */
        }
        if (xhr.status >= 200 && xhr.status < 300 && body.root) {
          onProgress?.(1, "Done");
          resolve({ root: body.root, txHash: body.txHash, size: body.size ?? bytes.length });
        } else {
          reject(new ApiError(body.error ?? `Upload failed (${xhr.status})`, xhr.status, xhr.status >= 500 || xhr.status === 429));
        }
      };
      xhr.onerror = () => reject(new ApiError("Network error during upload", 0, true));
      xhr.ontimeout = () => reject(new ApiError("Upload timed out", 408, true));
      xhr.send(new Blob([bytes as BlobPart]));
    });
  }

  async download(root: string, onProgress?: Progress): Promise<Uint8Array> {
    onProgress?.(0.05, "Finding your backup");
    const res = await fetch(`/api/storage/download?root=${encodeURIComponent(root)}`);
    if (!res.ok || !res.body) throw await asApiError(res);
    const total = Number(res.headers.get("content-length") ?? "0");
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      if (total) onProgress?.(0.1 + 0.9 * (got / total), "Downloading");
    }
    const out = new Uint8Array(got);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    onProgress?.(1, "Downloaded");
    return out;
  }
}
