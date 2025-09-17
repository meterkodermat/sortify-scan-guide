import { useState, useRef, useEffect } from "react";
import { Camera, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

export const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let mounted = true;

    const initCamera = async () => {
      try {
        console.log("📱 Starting camera...");
        
        // Check if camera is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Kamera ikke tilgængeligt på denne enhed");
        }

        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment", // Back camera
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        console.log("✅ Camera stream obtained");
        streamRef.current = stream;

        // Wait for video element
        if (videoRef.current) {
          const video = videoRef.current;
          video.srcObject = stream;
          
          // Wait for video to load
          video.onloadedmetadata = () => {
            console.log("✅ Video metadata loaded");
            if (mounted) {
              setIsLoading(false);
              setError(null);
            }
          };

          video.onerror = () => {
            console.error("❌ Video error");
            if (mounted) {
              setError("Kunne ikke afspille kamera");
              setIsLoading(false);
            }
          };
        }

      } catch (err: any) {
        console.error("❌ Camera error:", err);
        
        if (!mounted) return;
        
        let message = "Kunne ikke starte kamera";
        if (err.name === "NotAllowedError") {
          message = "Kamera adgang blev nægtet. Tillad venligst kamera adgang og prøv igen.";
        } else if (err.name === "NotFoundError") {
          message = "Intet kamera fundet på denne enhed";
        } else if (err.message) {
          message = err.message;
        }
        
        setError(message);
        setIsLoading(false);
        toast.error(message);
      }
    };

    initCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
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

    // Set canvas size
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw video frame
    context.drawImage(video, 0, 0);
    
    // Convert to base64
    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageData);

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    console.log("✅ Photo captured");
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setIsLoading(true);
    setError(null);
    
    // Restart component
    window.location.reload();
  };

  const confirmCapture = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  if (capturedImage) {
    return (
      <div className="fixed inset-0 bg-black z-50">
        <img
          src={capturedImage}
          alt="Captured"
          className="w-full h-full object-cover"
        />
        
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button 
              onClick={retakePhoto}
              className="flex flex-col items-center space-y-2 text-white"
            >
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <RotateCcw className="h-6 w-6" />
              </div>
              <span className="text-sm">Tag igen</span>
            </button>
            
            <button 
              onClick={confirmCapture}
              className="flex flex-col items-center space-y-2"
            >
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-xl">
                <span className="text-white text-xl font-bold">✓</span>
              </div>
              <span className="text-white text-sm font-medium">Analyser</span>
            </button>
            
            <button 
              onClick={onClose}
              className="flex flex-col items-center space-y-2 text-white"
            >
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <X className="h-6 w-6" />
              </div>
              <span className="text-sm">Luk</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Close button */}
      <div className="absolute top-4 right-4 z-10">
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
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
          <p className="text-white/80 mb-6 max-w-sm">{error}</p>
          <button 
            onClick={onClose}
            className="bg-white text-black px-8 py-3 rounded-full font-semibold"
          >
            Tilbage
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mb-4"></div>
          <p className="text-lg">Starter kamera...</p>
          <p className="text-sm text-white/70 mt-2">Giv tilladelse når browseren spørger</p>
        </div>
      )}

      {/* Camera view */}
      {!isLoading && !error && (
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Capture button overlay */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <button 
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-xl hover:bg-white transition-all duration-200 active:scale-95"
            >
              <Camera className="h-10 w-10 text-black" />
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};