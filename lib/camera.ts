// One live camera stream for the whole time SommAI is open.
// iOS Safari treats stop-tracks + getUserMedia as a brand-new ask.
// Never stop tracks. Never drop the stream on a remount.

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: { ideal: "environment" } },
  audio: false,
};

let shared: MediaStream | null = null;
let inflight: Promise<MediaStream> | null = null;

function isLive(stream: MediaStream | null): stream is MediaStream {
  return !!stream && stream.active && stream.getVideoTracks().some((t) => t.readyState === "live");
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export async function cameraPermissionState(): Promise<PermissionState | "unknown"> {
  const permissions = navigator.permissions;
  if (!permissions?.query) return "unknown";
  try {
    const status = await permissions.query({ name: "camera" as PermissionName });
    return status.state;
  } catch {
    try {
      const status = await permissions.query({ name: "video_capture" as PermissionName });
      return status.state;
    } catch {
      return "unknown";
    }
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
    // granted → getUserMedia is silent. prompt/unknown → first-launch OS dialog.
    const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
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

export function attachCamera(video: HTMLVideoElement | null, stream: MediaStream) {
  if (!video) return;
  if (video.srcObject !== stream) video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  void video.play().catch(() => {});
}

export async function resumeCamera(video: HTMLVideoElement | null): Promise<MediaStream | null> {
  if (isLive(shared)) {
    attachCamera(video, shared);
    return shared;
  }
  // Only re-request if iOS already granted — otherwise a visibility
  // bounce would show Allow / Cancel again.
  const perm = await cameraPermissionState();
  if (perm !== "granted") return null;
  const stream = await acquireCamera();
  attachCamera(video, stream);
  return stream;
}
