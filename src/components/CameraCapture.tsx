import { useState, useRef, useEffect } from "react";
import { Camera, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

export const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize camera
  useEffect(() => {
    let mounted = true;

    const initCamera = async () => {
      try {
        console.log("📱 Initializing camera...");
        
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Kamera API understøttes ikke");
        }

        if (!window.isSecureContext) {
          throw new Error("HTTPS kræves for kamera adgang");
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        if (!mounted) return;

        console.log("✅ Camera stream obtained");
        setStream(mediaStream);

        // Set up video element
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            if (mounted) {
              console.log("✅ Video ready");
              setIsLoading(false);
              setError(null);
            }
          };
        }

      } catch (err) {
        if (!mounted) return;
        
        console.error("❌ Camera error:", err);
        
        let errorMessage = "Kunne ikke få adgang til kameraet. ";
        if (err instanceof Error) {
          if (err.name === "NotAllowedError") {
            errorMessage += "Giv tilladelse til kameraet.";
          } else if (err.name === "NotFoundError") {
            errorMessage += "Intet kamera fundet.";
          } else {
            errorMessage += err.message;
          }
        }
        
        setError(errorMessage);
        setIsLoading(false);
        toast.error(errorMessage);
      }
    };

    initCamera();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context?.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(imageData);

    // Stop stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setIsLoading(true);
    setError(null);
    
    // Re-initialize camera
    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    }).then(mediaStream => {
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          setIsLoading(false);
        };
      }
    }).catch(err => {
      setError("Kunne ikke genstarte kameraet");
      setIsLoading(false);
    });
  };

  const confirmCapture = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

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

      {/* Loading State */}
      {isLoading && !error && !capturedImage && (
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mb-4"></div>
          <p className="text-lg">Starter kamera...</p>
        </div>
      )}

      {/* Error State */}
      {error && !capturedImage && (
        <div className="flex-1 flex flex-col items-center justify-center text-white p-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <X className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-xl font-semibold mb-4">Kamera fejl</h3>
          <p className="text-center text-white/80 mb-6 max-w-sm">
            {error}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-white text-black px-8 py-3 rounded-full font-semibold"
          >
            Genindlæs siden
          </button>
        </div>
      )}

      {/* Camera View */}
      {!isLoading && !error && !capturedImage && (
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Take Photo Interface */}
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

      {/* Captured Image View */}
      {capturedImage && (
        <div className="flex-1 relative">
          <img
            src={capturedImage}
            alt="Captured waste item"
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