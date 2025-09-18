import { useState, useRef, useEffect } from "react";
import { Camera, X, RotateCcw, Play } from "lucide-react";
import { toast } from "sonner";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

export const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [hasStream, setHasStream] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    initializeCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      console.log("🛑 Stopping camera");
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const initializeCamera = async () => {
    try {
      console.log("🎥 Initializing camera...");
      setIsLoading(true);
      setError(null);

      // Check for camera support
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Kamera ikke understøttet i denne browser");
      }

      // Request camera permission
      console.log("📋 Requesting camera permission...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      console.log("✅ Camera permission granted");
      streamRef.current = stream;
      setHasStream(true);

      if (videoRef.current) {
        console.log("📺 Setting up video element...");
        videoRef.current.srcObject = stream;
        
        // Try to play immediately
        try {
          await videoRef.current.play();
          console.log("✅ Video auto-playing");
          setIsLoading(false);
          setShowPlayButton(false);
        } catch (playError) {
          console.log("⚠️ Auto-play blocked, showing play button");
          setIsLoading(false);
          setShowPlayButton(true);
        }

        // Listen for video events
        videoRef.current.onplaying = () => {
          console.log("▶️ Video started playing");
          setShowPlayButton(false);
        };

        videoRef.current.onpause = () => {
          console.log("⏸️ Video paused");
          setShowPlayButton(true);
        };
      }

    } catch (err: any) {
      console.error("❌ Camera initialization failed:", err);
      
      let message = "Kunne ikke starte kamera";
      
      if (err.name === "NotAllowedError") {
        message = "Kamera adgang nægtet. Tillad kamera adgang i browseren og prøv igen.";
      } else if (err.name === "NotFoundError") {
        message = "Ingen kamera fundet på denne enhed.";
      } else if (err.name === "NotSupportedError") {
        message = "Kamera ikke understøttet i denne browser.";
      } else if (err.name === "OverconstrainedError") {
        message = "Kamera indstillinger ikke understøttet.";
      }
      
      setError(message);
      setIsLoading(false);
      toast.error(message);
    }
  };

  const startVideo = async () => {
    if (videoRef.current) {
      try {
        console.log("▶️ Manual video start");
        await videoRef.current.play();
        setShowPlayButton(false);
      } catch (err) {
        console.error("❌ Manual play failed:", err);
        toast.error("Kunne ikke starte video");
      }
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !hasStream) {
      toast.error("Kamera ikke klar");
      return;
    }

    const video = videoRef.current;
    
    // Check if video is actually playing
    if (video.readyState < 2) {
      toast.error("Venter på kamera...");
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      toast.error("Canvas fejl");
      return;
    }

    // Set canvas size to video size
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    // Draw the current video frame
    ctx.drawImage(video, 0, 0);
    
    // Convert to base64
    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    console.log("📸 Photo captured successfully");
    
    setCapturedImage(imageData);
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    initializeCamera();
  };

  // Captured image view
  if (capturedImage) {
    return (
      <div className="fixed inset-0 bg-black z-50">
        <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
        
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button onClick={retakePhoto} className="flex flex-col items-center space-y-2 text-white">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <RotateCcw className="h-6 w-6" />
              </div>
              <span className="text-sm">Tag igen</span>
            </button>
            
            <button onClick={() => onCapture(capturedImage)} className="flex flex-col items-center space-y-2">
              <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-xl">
                <span className="text-white text-2xl font-bold">✓</span>
              </div>
              <span className="text-white text-sm font-medium">Analyser</span>
            </button>
            
            <button onClick={onClose} className="flex flex-col items-center space-y-2 text-white">
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
      {/* Close button */}
      <div className="absolute top-4 right-4 z-10">
        <button onClick={onClose} className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
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
          <p className="mb-6 text-white/80 leading-relaxed max-w-sm">{error}</p>
          <div className="space-y-3">
            <button 
              onClick={() => {
                setError(null);
                initializeCamera();
              }}
              className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Prøv igen
            </button>
            <br />
            <button 
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Tilbage
            </button>
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
      {!isLoading && !error && hasStream && (
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Play button overlay (shown when video needs manual start) */}
          {showPlayButton && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <button 
                onClick={startVideo}
                className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-xl"
              >
                <Play className="h-10 w-10 text-black ml-1" />
              </button>
              <div className="absolute bottom-1/3 left-0 right-0 text-center">
                <p className="text-white text-sm bg-black/50 inline-block px-4 py-2 rounded-full">
                  Tryk for at starte kamera
                </p>
              </div>
            </div>
          )}
          
          {/* Capture button */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <button 
              onClick={capturePhoto}
              disabled={showPlayButton}
              className="w-24 h-24 rounded-full bg-white/90 flex items-center justify-center shadow-xl active:scale-95 transition-transform disabled:opacity-50"
            >
              <Camera className="h-12 w-12 text-black" />
            </button>
          </div>
          
          {/* Instructions */}
          {!showPlayButton && (
            <div className="absolute bottom-32 left-0 right-0 flex justify-center">
              <div className="bg-black/50 rounded-full px-4 py-2">
                <span className="text-white text-sm">Tryk for at tage billede</span>
              </div>
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};