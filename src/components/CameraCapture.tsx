import { useState, useRef, useEffect } from "react";
import { Camera, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

export const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    startCamera();

    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    console.log("📱 Starting camera...");
    
    try {
      setIsLoading(true);
      setError(null);

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Kamera ikke understøttet i denne browser");
      }

      // Request camera with optimized settings
      const constraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        },
        audio: false
      };

      console.log("🎥 Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!mountedRef.current) {
        console.log("⚠️ Component unmounted, stopping stream");
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      console.log("✅ Camera stream obtained");
      streamRef.current = stream;

      // Setup video element
      if (videoRef.current && mountedRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        
        // Wait for video to be ready
        video.onloadedmetadata = () => {
          console.log("✅ Video metadata loaded");
          if (mountedRef.current && videoRef.current) {
            videoRef.current.play()
              .then(() => {
                console.log("✅ Video playing");
                if (mountedRef.current) {
                  setIsLoading(false);
                  setCameraReady(true);
                  setError(null);
                }
              })
              .catch((err) => {
                console.error("❌ Video play failed:", err);
                if (mountedRef.current) {
                  setError("Kunne ikke starte video afspilning");
                  setIsLoading(false);
                }
              });
          }
        };

        video.onerror = (e) => {
          console.error("❌ Video error:", e);
          if (mountedRef.current) {
            setError("Video fejl");
            setIsLoading(false);
          }
        };
      }

    } catch (err: any) {
      console.error("❌ Camera error:", err);
      
      if (!mountedRef.current) return;

      let message = "Kunne ikke starte kamera";
      
      if (err.name === "NotAllowedError") {
        message = "Kamera adgang nægtet. Tillad kamera adgang i browseren og prøv igen.";
      } else if (err.name === "NotFoundError") {
        message = "Ingen kamera fundet på denne enhed";
      } else if (err.name === "NotSupportedError") {
        message = "Kamera ikke understøttet i denne browser";
      } else if (err.message) {
        message = err.message;
      }

      setError(message);
      setIsLoading(false);
      toast.error(message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      console.log("🛑 Stopping camera stream");
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) {
      toast.error("Kamera ikke klar");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      toast.error("Kunne ikke forberede billede");
      return;
    }

    // Set canvas dimensions
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64 image
    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    
    console.log("📸 Photo captured");
    setCapturedImage(imageData);
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setIsLoading(true);
    setError(null);
    setCameraReady(false);
    startCamera();
  };

  const confirmCapture = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const retryCamera = () => {
    setError(null);
    setIsLoading(true);
    startCamera();
  };

  // Show captured image
  if (capturedImage) {
    return (
      <div className="fixed inset-0 bg-black z-50">
        <img
          src={capturedImage}
          alt="Captured"
          className="w-full h-full object-contain"
        />
        
        {/* Action buttons */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button 
              onClick={retakePhoto}
              className="flex flex-col items-center space-y-2 text-white touch-manipulation"
            >
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <RotateCcw className="h-6 w-6" />
              </div>
              <span className="text-sm">Tag igen</span>
            </button>
            
            <button 
              onClick={confirmCapture}
              className="flex flex-col items-center space-y-2 touch-manipulation"
            >
              <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-xl">
                <span className="text-white text-2xl font-bold">✓</span>
              </div>
              <span className="text-white text-sm font-medium">Analyser</span>
            </button>
            
            <button 
              onClick={handleClose}
              className="flex flex-col items-center space-y-2 text-white touch-manipulation"
            >
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <X className="h-6 w-6" />
              </div>
              <span className="text-sm">Luk</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main camera interface
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="absolute top-4 right-4 z-10">
        <button 
          onClick={handleClose}
          className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center touch-manipulation"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <X className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-xl font-semibold mb-4">Kamera fejl</h3>
          <p className="text-white/80 mb-6 max-w-sm leading-relaxed">{error}</p>
          <div className="space-y-3">
            <Button onClick={retryCamera} variant="secondary">
              Prøv igen
            </Button>
            <Button onClick={handleClose} variant="outline">
              Tilbage
            </Button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mb-4"></div>
          <p className="text-lg mb-2">Starter kamera...</p>
          <p className="text-sm text-white/70 text-center px-4">
            Tillad kamera adgang når browseren spørger
          </p>
        </div>
      )}

      {/* Camera view */}
      {!isLoading && !error && cameraReady && (
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Capture button */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <button 
              onClick={capturePhoto}
              className="w-24 h-24 rounded-full bg-white/90 flex items-center justify-center shadow-xl hover:bg-white transition-all duration-200 active:scale-95 touch-manipulation"
            >
              <Camera className="h-12 w-12 text-black" />
            </button>
          </div>
          
          {/* Instructions */}
          <div className="absolute bottom-32 left-0 right-0 flex justify-center">
            <div className="bg-black/50 rounded-full px-4 py-2">
              <span className="text-white text-sm">Tryk for at tage billede</span>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};