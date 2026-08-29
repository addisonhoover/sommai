// One live camera stream for the whole SPA session.
// iOS Safari re-prompts if we stop tracks and call getUserMedia again
// (CameraView used to do that on every unmount). Keep the stream alive
// while SommAI is open; only attach/detach the <video> element.

let shared: MediaStream | null = null;
let inflight: Promise<MediaStream> | null = null;

function isLive(stream: MediaStream | null): stream is MediaStream {
  return !!stream && stream.active && stream.getVideoTracks().some((t) => t.readyState === "live");
}

export async function cameraPermissionState(): Promise<PermissionState | "unknown"> {
  const permissions = navigator.permissions;
  if (!permissions?.query) return "unknown";
  try {
    const status = await permissions.query({ name: "camera" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
}

export async function acquireCamera(): Promise<MediaStream> {
  if (isLive(shared)) return shared;
  if (inflight) return inflight;

  inflight = (async () => {
    const perm = await cameraPermissionState();
    if (perm === "denied") {
      throw new DOMException("Camera permission denied", "NotAllowedError");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    shared = stream;
    for (const track of stream.getVideoTracks()) {
      track.addEventListener("ended", () => {
        if (shared === stream) shared = null;
      });
    }
    return stream;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function detachCamera(video: HTMLVideoElement | null) {
  if (video) video.srcObject = null;
}
