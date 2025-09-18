import { useState, useRef, useEffect } from "react";
import { Camera, X, RotateCcw, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useCamera } from "@/hooks/useCamera";
import { Button } from "@/components/ui/button";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

export const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWebCamera, setShowWebCamera] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { capturePhoto: captureNativePhoto, isNative } = useCamera();

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      console.log("🎥 Camera component initializing...", { isNative });
      
      // On mobile devices, show camera options
      if (isNative) {
        setShowOptions(true);
        setIsLoading(false);
      } else {
        // On web, go straight to web camera
        setShowWebCamera(true);
        await initWebCamera(isMounted);
      }
    };

    init();

    return () => {
      isMounted = false;
      // Cleanup camera stream
      if (streamRef.current) {
        console.log("🧹 Cleaning up camera stream");
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isNative]);

  const handleNativeCameraCapture = async () => {
    try {
      setIsLoading(true);
      const imageData = await captureNativePhoto();
      
      if (imageData) {
        setCapturedImage(imageData);
        setIsLoading(false);
      } else {
        setIsLoading(false);
        setShowOptions(true);
      }
    } catch (error) {
      console.error('Native camera failed:', error);
      setIsLoading(false);
      setShowOptions(true);
    }
  };

  const initWebCamera = async (isMounted = true) => {
    try {
      console.log("📱 Starting web camera...");
      setIsLoading(true);
      setError(null);
      
      // Check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Kamera ikke tilgængeligt på denne enhed");
      }

      // Request camera access with better settings
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (!isMounted) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      console.log("✅ Camera stream obtained");
      streamRef.current = stream;

      // Set up video element
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        
        // Handle video loading
        const handleLoadedMetadata = () => {
          console.log("✅ Video metadata loaded");
          if (isMounted) {
            video.play()
              .then(() => {
                console.log("✅ Video playing");
                setIsLoading(false);
                setError(null);
              })
              .catch((playError) => {
                console.error("❌ Video play error:", playError);
                if (isMounted) {
                  setError("Kunne ikke starte video");
                  setIsLoading(false);
                }
              });
          }
        };

        const handleVideoError = (e: Event) => {
          console.error("❌ Video error:", e);
          if (isMounted) {
            setError("Kunne ikke afspille kamera");
            setIsLoading(false);
          }
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('error', handleVideoError);
      }

    } catch (err: any) {
      console.error("❌ Camera error:", err);
      
      if (!isMounted) return;
      
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

  const capturePhoto = () => {
    console.log('📸 Capturing photo...');
    if (!videoRef.current || !canvasRef.current) {
      console.log('❌ Camera not ready');
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

    // Set canvas size to match video
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
    
    if (isNative) {
      setShowOptions(true);
    } else {
      setIsLoading(true);
      setError(null);
      setShowWebCamera(true);
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        initWebCamera(true);
      }, 100);
    }
  };

  const confirmCapture = () => {
    console.log('✅ Confirming capture, sending to analysis...');
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  // Camera options screen for mobile
  if (showOptions && !showWebCamera && !capturedImage) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Vælg kamera</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Options */}
        <div className="flex-1 p-6 space-y-4">
          <Button
            onClick={handleNativeCameraCapture}
            variant="default"
            size="lg"
            className="w-full h-20 text-lg font-semibold"
          >
            <div className="flex flex-col items-center space-y-2">
              <Camera className="h-8 w-8" />
              <span>Åbn kamera app</span>
              <span className="text-xs opacity-90">Anbefalet til mobil</span>
            </div>
          </Button>

          <Button
            onClick={() => {
              setShowWebCamera(true);
              setShowOptions(false);
              setIsLoading(true);
              setTimeout(() => {
                initWebCamera(true);
              }, 100);
            }}
            variant="outline"
            size="lg"
            className="w-full h-20 text-lg font-semibold"
          >
            <div className="flex flex-col items-center space-y-2">
              <ImageIcon className="h-8 w-8" />
              <span>Brug browser kamera</span>
              <span className="text-xs opacity-70">Avanceret</span>
            </div>
          </Button>
        </div>
      </div>
    );
  }

  // Captured image review
  if (capturedImage) {
    return (
      <div className="fixed inset-0 bg-black z-50">
        <img
          src={capturedImage}
          alt="Captured"
          className="w-full h-full object-contain"
        />
        
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
              onClick={onClose}
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

  // Web camera view
  if (showWebCamera) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        {/* Header controls */}
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-between p-4">
          {/* Back to options (if native available) */}
          {isNative && (
            <button 
              onClick={() => {
                if (streamRef.current) {
                  streamRef.current.getTracks().forEach(track => track.stop());
                  streamRef.current = null;
                }
                setShowWebCamera(false);
                setShowOptions(true);
              }}
              className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center touch-manipulation"
            >
              <span className="text-white text-lg">←</span>
            </button>
          )}
          
          {/* Close button */}
          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center touch-manipulation ml-auto"
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
            <Button 
              onClick={() => {
                setError(null);
                setIsLoading(true);
                setTimeout(() => {
                  initWebCamera(true);
                }, 100);
              }}
              variant="secondary"
              className="mb-4"
            >
              Prøv igen
            </Button>
            <Button 
              onClick={onClose}
              variant="outline"
            >
              Tilbage
            </Button>
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
                className="w-24 h-24 rounded-full bg-white/90 flex items-center justify-center shadow-xl hover:bg-white transition-all duration-200 active:scale-95 touch-manipulation"
              >
                <Camera className="h-12 w-12 text-black" />
              </button>
            </div>
            
            {/* Camera instructions */}
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
  }

  // Default loading state
  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mb-4 mx-auto"></div>
        <p className="text-lg">Forbereder kamera...</p>
      </div>
    </div>
  );
};