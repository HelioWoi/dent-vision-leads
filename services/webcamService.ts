import React from 'react';

// Type for the stream ref
type StreamRef = React.MutableRefObject<MediaStream | null>;

/**
 * Starts the camera and streams the video to the provided video element.
 * @param videoElement The HTMLVideoElement to display the stream.
 * @param streamRef A ref to store the MediaStream instance.
 * @returns A promise that resolves when the camera is started, or rejects with an error message.
 */
export const startCamera = async (
  videoElement: HTMLVideoElement,
  streamRef: StreamRef
): Promise<void> => {
  if (streamRef.current) {
    // Camera is already running
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    videoElement.srcObject = stream;
    streamRef.current = stream;
  } catch (err) {
    let errorMessage = "Could not access camera. Please check it's not in use by another app.";
    if (err instanceof DOMException) {
      switch (err.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          errorMessage = "Camera permission was denied. Please enable it in your browser settings to use this feature.";
          break;
        case 'NotFoundError':
          errorMessage = "No camera found on your device. Please ensure a camera is connected.";
          break;
        case 'NotReadableError':
          errorMessage = "There was a hardware error, or the camera is in use by another application.";
          break;
      }
      console.error("Camera error:", err.name, "-", errorMessage);
    } else {
      console.error("Camera error:", err instanceof Error ? err.message : String(err));
    }
    throw new Error(errorMessage);
  }
};

/**
 * Stops the camera stream.
 * @param streamRef A ref holding the MediaStream instance to stop.
 */
export const stopCamera = (streamRef: StreamRef): void => {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }
};

/**
 * Captures a single frame from the video stream and returns it as a File.
 * @param videoElement The HTMLVideoElement to capture from.
 * @param canvasElement A hidden HTMLCanvasElement to use for drawing.
 * @returns A promise that resolves with the captured image as a File.
 */
export const captureImage = (
  videoElement: HTMLVideoElement,
  canvasElement: HTMLCanvasElement
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const context = canvasElement.getContext('2d');
    if (!context) {
      return reject(new Error('Could not get canvas context.'));
    }

    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    context.drawImage(videoElement, 0, 0, videoElement.videoWidth, videoElement.videoHeight);

    canvasElement.toBlob(blob => {
      if (blob) {
        const newFile = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        resolve(newFile);
      } else {
        reject(new Error('Failed to create blob from canvas.'));
      }
    }, 'image/jpeg', 0.9); // 90% quality JPEG
  });
};
