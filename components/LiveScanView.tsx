import React, { useState, useEffect, useRef } from 'react';
import { startCamera, stopCamera, captureImage } from '../services/webcamService';
import { XIcon, ViewfinderIcon, AlertTriangleIcon } from './Icons';
import { PanelType } from '../types';

const SCAN_DURATION_S = 15;
const FRAME_INTERVAL_MS = 2500;
const MAX_FRAMES = 4; // Limit to 4 frames to reduce AI calls
const INACTIVITY_TIMEOUT_S = 8;
const INACTIVITY_CHECK_THRESHOLD = 0.98; // 98% similarity to be considered inactive

interface LiveScanViewProps {
  selectedPanels: PanelType[];
  currentPanelIndex: number;
  onPanelComplete: (frames: File[], frozenFrame: string) => void;
  onScanComplete: (frames: File[]) => void;
  onCancel: () => void;
}

const areImageDataSimilar = (
    data1: Uint8ClampedArray,
    data2: Uint8ClampedArray,
    width: number,
    height: number,
): boolean => {
    // Downsample for performance by checking every Nth pixel
    const step = 8;
    let differentPixels = 0;
    const pixelsToCheck = (width * height) / (step * step);

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const index = (y * width + x) * 4;
            const r1 = data1[index];
            const g1 = data1[index + 1];
            const b1 = data1[index + 2];
            const r2 = data2[index];
            const g2 = data2[index + 1];
            const b2 = data2[index + 2];
            const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
            if (diff > 50) { // Threshold for pixel difference
                differentPixels++;
            }
        }
    }

    const similarity = 1 - (differentPixels / pixelsToCheck);
    return similarity > INACTIVITY_CHECK_THRESHOLD;
};

const LiveScanView: React.FC<LiveScanViewProps> = ({ 
    selectedPanels, 
    currentPanelIndex, 
    onPanelComplete, 
    onScanComplete, 
    onCancel 
}) => {
    const [timeLeft, setTimeLeft] = useState(SCAN_DURATION_S);
    const [statusText, setStatusText] = useState('Rotate your phone to landscape to begin...');
    const [inactivityCounter, setInactivityCounter] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isPortrait, setIsPortrait] = useState(true);
    const [scanStarted, setScanStarted] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const framesRef = useRef<File[]>([]);
    const lastFrameDataRef = useRef<Uint8ClampedArray | null>(null);
    
    const currentPanel = selectedPanels[currentPanelIndex];
    const totalPanels = selectedPanels.length;
    const isLastPanel = currentPanelIndex === totalPanels - 1;

    // Reset frames when panel changes
    useEffect(() => {
        framesRef.current = [];
        setTimeLeft(SCAN_DURATION_S);
        lastFrameDataRef.current = null;
        setInactivityCounter(0);
    }, [currentPanelIndex]);

    // Detect device orientation
    useEffect(() => {
        const checkOrientation = () => {
            // Check if portrait mode (height > width)
            const isPortraitMode = window.innerHeight > window.innerWidth;
            setIsPortrait(isPortraitMode);
            
            // Start scan automatically when switching to landscape
            if (!isPortraitMode && !scanStarted) {
                setScanStarted(true);
                setStatusText('Prepare to scan...');
            }
        };

        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);

        return () => {
            window.removeEventListener('resize', checkOrientation);
            window.removeEventListener('orientationchange', checkOrientation);
        };
    }, [scanStarted]);

    // Main effect for starting camera and timers
    useEffect(() => {
        const videoElement = videoRef.current;
        if (!videoElement) return;

        startCamera(videoElement, streamRef).catch(err => {
            console.error(err);
            setError(err.message);
        });
        
        // Don't start timers until scan is started (landscape mode)
        if (!scanStarted) return;

        // Master countdown timer for the whole session
        const countdownInterval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(countdownInterval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Frame capture logic
        const captureFrame = async () => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas || video.readyState < 2) return;
            
            // Stop capturing if we've reached max frames for this panel
            if (framesRef.current.length >= MAX_FRAMES) {
                return;
            }
            
            setStatusText('Capturing frame...');
            
            const imageFile = await captureImage(video, canvas);
            framesRef.current.push(imageFile);

            // Inactivity Check
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                const { width, height } = canvas;
                const currentFrameData = ctx.getImageData(0, 0, width, height).data;
                if (lastFrameDataRef.current) {
                    if (areImageDataSimilar(lastFrameDataRef.current, currentFrameData, width, height)) {
                        setInactivityCounter(prev => prev + FRAME_INTERVAL_MS / 1000);
                    } else {
                        setInactivityCounter(0); // Reset on movement
                    }
                }
                lastFrameDataRef.current = currentFrameData;
            }

            await new Promise(res => setTimeout(res, 500)); // Show "Capturing..." for a bit
            setStatusText(`Scanning ${currentPanel}... Move the camera slowly.`);
        };
        
        // Use a timeout to schedule captures instead of interval to avoid drift and overlap
        let captureTimeout: number;
        const scheduleNextCapture = () => {
            captureTimeout = window.setTimeout(() => {
                captureFrame();
                if (framesRef.current.length < MAX_FRAMES) {
                    scheduleNextCapture();
                }
            }, FRAME_INTERVAL_MS);
        };
        
        window.setTimeout(() => scheduleNextCapture(), 2000); // Initial delay

        // Master timeout to end the panel scan
        const sessionTimeout = window.setTimeout(async () => {
            // Capture frozen frame for pause screen
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video && canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0);
                    const frozenFrame = canvas.toDataURL('image/jpeg', 0.8);
                    onPanelComplete(framesRef.current, frozenFrame);
                }
            }
        }, SCAN_DURATION_S * 1000);

        return () => {
            clearInterval(countdownInterval);
            clearTimeout(sessionTimeout);
            clearTimeout(captureTimeout);
            stopCamera(streamRef);
        };
    }, [onPanelComplete, currentPanel, scanStarted]);
    
    // Effect to check for inactivity timeout
    useEffect(() => {
        if (inactivityCounter >= INACTIVITY_TIMEOUT_S) {
            setStatusText('Session ended due to inactivity.');
            window.setTimeout(() => onScanComplete(framesRef.current), 1500);
        }
    }, [inactivityCounter, onScanComplete]);
    

    const progress = ((SCAN_DURATION_S - timeLeft) / SCAN_DURATION_S) * 100;

    if (error) {
        return (
            <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-4 text-center animate-fade-in">
                <AlertTriangleIcon className="w-12 h-12 text-red-400 mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Camera Error</h2>
                <p className="text-brand-gray-200 max-w-md mb-6">{error}</p>
                {error.includes("permission was denied") && (
                    <p className="text-sm text-yellow-300 max-w-md mb-6">
                        Please allow camera access for this site in your browser's settings (usually via the lock icon in the address bar) and try again.
                    </p>
                )}
                <button onClick={onCancel} className="bg-brand-gray-700 hover:bg-brand-gray-600 text-white font-bold py-2 px-6 rounded-lg border border-white/20">
                    Close
                </button>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center animate-fade-in"
            role="dialog"
            aria-modal="true"
        >
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                playsInline
                muted
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-between p-4 sm:p-8 landscape:p-2 landscape:py-4">
                {/* Header */}
                <div className="w-full flex justify-between items-center text-white">
                    <div>
                        <h2 className="text-xl font-bold landscape:text-base">Quick Live Scan</h2>
                        <p className="text-sm text-white/80 landscape:text-xs">
                            Panel {currentPanelIndex + 1} of {totalPanels}: {currentPanel}
                        </p>
                    </div>
                    <button 
                        onClick={() => {
                            stopCamera(streamRef);
                            onCancel();
                        }} 
                        aria-label="Cancel Scan"
                    >
                        <XIcon className="w-8 h-8 landscape:w-6 landscape:h-6" />
                    </button>
                </div>

                {/* Viewfinder */}
                <div className="w-full max-w-2xl aspect-video relative flex items-center justify-center landscape:max-w-xl">
                    <ViewfinderIcon className="absolute inset-0 w-full h-full text-white/30" />
                </div>

                {/* Footer */}
                <div className="w-full text-center landscape:space-y-1">
                    <div className="text-center mb-4 landscape:mb-1">
                        <p className="text-white text-lg font-semibold animate-pulse landscape:text-sm">{statusText}</p>
                        {inactivityCounter > 0 && <p className="text-yellow-400 text-sm mt-1 landscape:text-xs landscape:mt-0">Inactivity detected: {inactivityCounter}s</p>}
                    </div>
                    <div className="text-white text-4xl font-mono font-bold mb-4 landscape:text-2xl landscape:mb-2">{timeLeft}s</div>
                    <div className="w-full max-w-md bg-white/20 rounded-full h-2.5 mx-auto landscape:h-1.5 landscape:max-w-sm">
                        <div className="bg-brand-lime h-2.5 rounded-full transition-all duration-1000 ease-linear landscape:h-1.5" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveScanView;