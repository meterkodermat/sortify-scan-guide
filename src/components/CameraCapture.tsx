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
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  console.log("🎥 CameraCapture state:", { isLoading, error, cameraReady, capturedImage: !!capturedImage });

  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      console.log("📱 Starting camera...");
      
      try {
        // Basic checks
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error("Kamera API ikke understøttet");
        }

        console.log("🎬 Requesting camera permission...");
        
        // Try a simpler camera request first
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true
        }).catch(async (err) => {
          console.log("🔄 Simple request failed, trying with constraints...", err);
          // Fallback with specific constraints
          return navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "environment",
              width: { min: 640, ideal: 1280, max: 1920 },
              height: { min: 480, ideal: 720, max: 1080 }
            }
          });
        });

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        console.log("✅ Got camera stream");
        streamRef.current = stream;

        // Setup video element
        if (!videoRef.current) {
          console.log("⏳ Video element not ready yet");
          setTimeout(() => startCamera(), 100);
          return;
        }

        console.log("📺 Setting up video element");
        const video = videoRef.current;
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        
        const setupVideo = async () => {
          try {
            await video.play();
            console.log("✅ Video playing");
            
            // Wait for video to have actual dimensions
            const waitForDimensions = () => {
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                console.log("✅ Video dimensions ready:", video.videoWidth, "x", video.videoHeight);
                if (mounted) {
                  setCameraReady(true);
                  setIsLoading(false);
                  setError(null);
                }
              } else {
                console.log("⏳ Waiting for video dimensions...");
                setTimeout(waitForDimensions, 100);
              }
            };
            
            waitForDimensions();
            
          } catch (playError) {
            console.error("❌ Video play error:", playError);
            // Force ready state even if autoplay fails
            if (mounted) {
              setCameraReady(true);
              setIsLoading(false);
            }
          }
        };

        video.addEventListener('loadedmetadata', setupVideo, { once: true });
        
        // Backup timer - force ready after 3 seconds
        setTimeout(() => {
          if (mounted && !cameraReady) {
            console.log("⏰ Forcing camera ready (timeout)");
            setCameraReady(true);
            setIsLoading(false);
          }
        }, 3000);

        // Video setup is handled above

      } catch (err) {
        console.error("❌ Camera error:", err);
        
        if (!mounted) return;
        
        let message = "Kunne ikke starte kamera. ";
        if (err instanceof Error) {
          if (err.name === "NotAllowedError") {
            message += "Giv tilladelse til kameraet.";
          } else if (err.name === "NotFoundError") {
            message += "Intet kamera fundet.";
          } else {
            message += err.message;
          }
        }
        
        setError(message);
        setIsLoading(false);
        toast.error(message);
      }
    };

    startCamera();

    return () => {
      mounted = false;
      console.log("🧹 Cleaning up camera");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capturePhoto = () => {
    console.log("📸 Capturing photo...");
    
    if (!videoRef.current || !canvasRef.current) {
      console.error("❌ Video or canvas not ready");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      console.error("❌ Canvas context not available");
      return;
    }

    // Set canvas size to video size
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0);
    
    // Convert to image data
    const imageData = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(imageData);

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setCameraReady(false);

    console.log("✅ Photo captured");
  };

  const retakePhoto = () => {
    console.log("🔄 Retaking photo");
    setCapturedImage(null);
    setIsLoading(true);
    setCameraReady(false);
    setError(null);
    
    // Restart camera by re-running the effect
    window.location.reload();
  };

  const confirmCapture = () => {
    console.log("✅ Confirming capture");
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

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

      {/* Loading */}
      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mb-4"></div>
          <p className="text-lg">Starter kamera...</p>
          <p className="text-sm text-white/70 mt-2">Giv tilladelse når browseren spørger</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <X className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-xl font-semibold mb-4">Kamera fejl</h3>
          <p className="text-white/80 mb-6 max-w-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-white text-black px-8 py-3 rounded-full font-semibold"
          >
            Prøv igen
          </button>
        </div>
      )}

      {/* Camera view */}
      {cameraReady && !capturedImage && !error && (
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="bg-green-700/80 backdrop-blur-sm rounded-3xl px-12 py-8 flex flex-col items-center space-y-6 shadow-2xl">
              <h1 className="text-white text-4xl font-light tracking-wide">Take Photo</h1>
              
              <button 
                onClick={capturePhoto}
                className="w-20 h-20 rounded-2xl bg-white/90 flex items-center justify-center shadow-xl hover:bg-white transition-all duration-200 active:scale-95"
              >
                <Camera className="h-10 w-10 text-black" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Captured image */}
      {capturedImage && (
        <div className="flex-1 relative">
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full h-full object-cover"
          />
          
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
            <div className="flex items-center justify-between">
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
                  <span className="text-white text-lg font-bold">✓</span>
                </div>
                <span className="text-white text-sm font-medium">Analyser nu</span>
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
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};