export type CallType = "audio" | "video";

const isSafariIOS = () => {
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod/.test(ua) &&
    /WebKit/.test(ua) &&
    !/CriOS|FxiOS|OPiOS|mercury/i.test(ua)
  );
};

/**
 * iOS Safari requires getUserMedia to be executed directly in a user gesture (tap/click).
 * This helper requests permissions and immediately stops tracks (preflight).
 */
export const requestCallMediaPermission = async (callType: CallType) => {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error("MediaDevices API is not supported");
  }

  const safariIOS = isSafariIOS();

  const constraints: MediaStreamConstraints =
    callType === "video"
      ? safariIOS
        ? { video: true, audio: true }
        : {
            video: { facingMode: "user" },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          }
      : safariIOS
        ? { audio: true }
        : {
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  // Preflight only: release devices immediately.
  stream.getTracks().forEach((t) => t.stop());

  return true;
};
