/**
 * Live passport-photo capture.
 *
 * Face position comes from MediaPipe Face Landmarker. Glasses come from
 * FrameFind's on-device ONNX classifier, cropped to the eye region with
 * those same landmarks. Nothing is uploaded until the photo is accepted.
 */

const MEDIAPIPE_VERSION = '0.10.35';
const MEDIAPIPE_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const GLASSES_MODEL =
  'https://cdn.framefind.moraxh.dev/models/glasses/v1/glasses.onnx';
const ORT_WASM = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.25.1/dist/';

const FACE_MIN_WIDTH = 0.18;
const FACE_MAX_WIDTH = 0.62;
const FACE_CENTER_X = 0.5;
const FACE_CENTER_Y = 0.46;
const CENTER_TOLERANCE_X = 0.16;
const CENTER_TOLERANCE_Y = 0.18;
const GLASSES_THRESHOLD = 0.35;

const OUTPUT_WIDTH = 700;
const OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH * (45 / 35));

/**
 * MediaPipe writes this status line with console.error. Next.js then shows it
 * as a runtime error even though face detection succeeded.
 */
const MEDIAPIPE_NOISE =
  /TensorFlow Lite XNNPACK delegate|XNNPACK delegate for CPU/i;

let mediapipeSilenceDepth = 0;
let mediapipeConsole: {
  error: typeof console.error;
  warn: typeof console.warn;
  info: typeof console.info;
  log: typeof console.log;
} | null = null;

function isMediapipeNoise(args: unknown[]) {
  return args.some((arg) => {
    if (typeof arg === 'string') return MEDIAPIPE_NOISE.test(arg);
    if (arg instanceof Error) return MEDIAPIPE_NOISE.test(arg.message);
    return false;
  });
}

function beginMediapipeSilence() {
  if (mediapipeSilenceDepth === 0) {
    mediapipeConsole = {
      error: console.error,
      warn: console.warn,
      info: console.info,
      log: console.log,
    };
    const wrap =
      (original: (...args: unknown[]) => void) =>
      (...args: unknown[]) => {
        if (isMediapipeNoise(args)) return;
        original.apply(console, args);
      };
    console.error = wrap(mediapipeConsole.error);
    console.warn = wrap(mediapipeConsole.warn);
    console.info = wrap(mediapipeConsole.info);
    console.log = wrap(mediapipeConsole.log);
  }
  mediapipeSilenceDepth += 1;
}

function endMediapipeSilence() {
  if (mediapipeSilenceDepth === 0) return;
  mediapipeSilenceDepth -= 1;
  if (mediapipeSilenceDepth === 0 && mediapipeConsole) {
    console.error = mediapipeConsole.error;
    console.warn = mediapipeConsole.warn;
    console.info = mediapipeConsole.info;
    console.log = mediapipeConsole.log;
    mediapipeConsole = null;
  }
}

export type PhotoCaptureStatus =
  | 'no-face'
  | 'multiple-faces'
  | 'too-close'
  | 'too-far'
  | 'off-center'
  | 'glasses'
  | 'ready';

export function passportPhotoStatusMessage(status: PhotoCaptureStatus) {
  switch (status) {
    case 'no-face':
      return 'Position your face inside the oval.';
    case 'multiple-faces':
      return 'Only one person should be in the photo.';
    case 'too-close':
      return 'Move a little farther from the camera.';
    case 'too-far':
      return 'Move closer so your face fills the oval.';
    case 'off-center':
      return 'Center your face in the oval.';
    case 'glasses':
      return 'Glasses detected. Remove them and look at the camera.';
    case 'ready':
      return 'Hold still. You can capture this photo.';
  }
}

export class PassportPhotoCaptureError extends Error {
  readonly status: PhotoCaptureStatus;

  constructor(status: PhotoCaptureStatus) {
    super(passportPhotoStatusMessage(status));
    this.name = 'PassportPhotoCaptureError';
    this.status = status;
  }
}

interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface FaceBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
}

interface FaceLandmarkerLike {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number
  ) => { faceLandmarks?: Array<Array<{ x: number; y: number; z?: number }>> };
  close: () => void;
}

interface GlassesDetectorLike {
  load: () => Promise<void>;
  detectFromVideoFrame: (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    landmarks?: Landmark[]
  ) => Promise<{ glasses: boolean }>;
  detectFromCanvas: (
    canvas: HTMLCanvasElement,
    landmarks?: Landmark[]
  ) => Promise<{ glasses: boolean }>;
  resetHistory: () => void;
  dispose: () => void;
}

export interface PhotoCaptureRead {
  status: PhotoCaptureStatus;
  message: string;
}

export interface PassportPhotoEngine {
  inspect: (video: HTMLVideoElement) => Promise<PhotoCaptureRead>;
  capture: (video: HTMLVideoElement) => Promise<File>;
  close: () => void;
}

function readStatus(status: PhotoCaptureStatus): PhotoCaptureRead {
  return { status, message: passportPhotoStatusMessage(status) };
}

function toLandmarks(
  points: Array<{ x: number; y: number; z?: number }>
): Landmark[] {
  return points.map((point) => ({
    x: point.x,
    y: point.y,
    z: point.z ?? 0,
  }));
}

function faceBox(landmarks: Landmark[]): FaceBox {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of landmarks) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function framingStatus(box: FaceBox): PhotoCaptureStatus | null {
  if (box.width < FACE_MIN_WIDTH) return 'too-far';
  if (box.width > FACE_MAX_WIDTH) return 'too-close';
  if (
    Math.abs(box.cx - FACE_CENTER_X) > CENTER_TOLERANCE_X ||
    Math.abs(box.cy - FACE_CENTER_Y) > CENTER_TOLERANCE_Y
  ) {
    return 'off-center';
  }
  return null;
}

function drawVideoFrame(video: HTMLVideoElement) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Could not read the camera frame.');
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function cropPassportPhoto(source: HTMLCanvasElement, landmarks: Landmark[]) {
  const box = faceBox(landmarks);
  const faceW = Math.max(1, box.width * source.width);
  const faceH = Math.max(1, box.height * source.height);
  const centerX = box.cx * source.width;
  let top = box.minY * source.height - faceH * 0.7;
  let bottom = box.maxY * source.height + faceH * 0.9;
  let cropH = bottom - top;
  let cropW = cropH * (35 / 45);
  let left = centerX - cropW / 2;

  if (left < 0) left = 0;
  if (top < 0) top = 0;
  if (left + cropW > source.width) cropW = source.width - left;
  if (top + cropH > source.height) cropH = source.height - top;

  const aspect = 35 / 45;
  if (cropW / cropH > aspect) {
    const nextW = cropH * aspect;
    left += (cropW - nextW) / 2;
    cropW = nextW;
  } else {
    const nextH = cropW / aspect;
    top += (cropH - nextH) / 2;
    cropH = nextH;
  }

  left = Math.max(0, Math.min(left, source.width - cropW));
  top = Math.max(0, Math.min(top, source.height - cropH));

  const output = document.createElement('canvas');
  output.width = OUTPUT_WIDTH;
  output.height = OUTPUT_HEIGHT;
  const context = output.getContext('2d');
  if (!context || cropW < 2 || cropH < 2) {
    throw new Error('Could not crop the face photo.');
  }
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(
    source,
    left,
    top,
    cropW,
    cropH,
    0,
    0,
    output.width,
    output.height
  );
  return output;
}

function canvasToFile(canvas: HTMLCanvasElement) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not save the photo.'));
          return;
        }
        resolve(
          new File([blob], 'passport-photo.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
        );
      },
      'image/jpeg',
      0.92
    );
  });
}

async function createLandmarker(): Promise<FaceLandmarkerLike> {
  const vision = await import('@mediapipe/tasks-vision');
  const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
  const shared = {
    runningMode: 'VIDEO' as const,
    numFaces: 2,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };

  try {
    return await vision.FaceLandmarker.createFromOptions(fileset, {
      ...shared,
      baseOptions: {
        modelAssetPath: FACE_MODEL,
        delegate: 'GPU',
      },
    });
  } catch {
    return vision.FaceLandmarker.createFromOptions(fileset, {
      ...shared,
      baseOptions: {
        modelAssetPath: FACE_MODEL,
        delegate: 'CPU',
      },
    });
  }
}

export async function createPassportPhotoEngine(): Promise<PassportPhotoEngine> {
  beginMediapipeSilence();
  try {
    return await createPassportPhotoEngineInner();
  } catch (error) {
    endMediapipeSilence();
    throw error;
  }
}

async function createPassportPhotoEngineInner(): Promise<PassportPhotoEngine> {
  const [{ GlassesDetector }, landmarker] = await Promise.all([
    import('@framefind/core'),
    createLandmarker(),
  ]);

  const glasses = new GlassesDetector({
    autoLandmarks: false,
    modelUrl: GLASSES_MODEL,
    wasmPaths: ORT_WASM,
    threshold: GLASSES_THRESHOLD,
    smoothingWindow: 4,
    inferenceIntervalMs: 0,
    preferGpu: false,
  }) as GlassesDetectorLike;
  const sampleCanvas = document.createElement('canvas');

  try {
    await glasses.load();
  } catch (error) {
    landmarker.close();
    throw error;
  }

  let timestamp = 0;
  let disposed = false;

  const nextTimestamp = () => {
    const now = Math.round(performance.now());
    timestamp = now > timestamp ? now : timestamp + 1;
    return timestamp;
  };

  const readFaces = (video: HTMLVideoElement) => {
    if (video.readyState < 2 || video.videoWidth === 0) {
      return [] as Landmark[][];
    }
    const result = landmarker.detectForVideo(video, nextTimestamp());
    return (result.faceLandmarks ?? []).map(toLandmarks);
  };

  return {
    async inspect(video) {
      if (disposed) return readStatus('no-face');
      const faces = readFaces(video);
      if (faces.length === 0) {
        glasses.resetHistory();
        return readStatus('no-face');
      }
      if (faces.length > 1) {
        glasses.resetHistory();
        return readStatus('multiple-faces');
      }

      const landmarks = faces[0];
      const framing = framingStatus(faceBox(landmarks));
      if (framing === 'too-far') {
        glasses.resetHistory();
        return readStatus('too-far');
      }

      const verdict = await glasses.detectFromVideoFrame(
        video,
        sampleCanvas,
        landmarks
      );
      if (disposed) return readStatus('no-face');
      if (verdict.glasses) return readStatus('glasses');
      if (framing) return readStatus(framing);
      return readStatus('ready');
    },

    async capture(video) {
      if (disposed) {
        throw new PassportPhotoCaptureError('no-face');
      }
      const faces = readFaces(video);
      if (faces.length === 0) throw new PassportPhotoCaptureError('no-face');
      if (faces.length > 1) {
        throw new PassportPhotoCaptureError('multiple-faces');
      }

      const landmarks = faces[0];
      const framing = framingStatus(faceBox(landmarks));
      if (framing) throw new PassportPhotoCaptureError(framing);

      const still = drawVideoFrame(video);
      glasses.resetHistory();
      const verdict = await glasses.detectFromCanvas(still, landmarks);
      if (verdict.glasses) throw new PassportPhotoCaptureError('glasses');

      return canvasToFile(cropPassportPhoto(still, landmarks));
    },

    close() {
      if (disposed) return;
      disposed = true;
      try {
        glasses.resetHistory();
        glasses.dispose();
        landmarker.close();
      } finally {
        endMediapipeSilence();
      }
    },
  };
}
