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

  console.log("🎥 CameraCapture component rendered", {
    isLoading,
    error,
    capturedImage: !!capturedImage,
    stream: !!stream
  });

  // Initialize camera
  useEffect(() => {
    let mounted = true;

    const initCamera = async () => {
      console.log("📱 Starting camera initialization...");
      
      try {
        // Check basic support
        console.log("🔍 Checking browser capabilities:", {
          navigator: typeof navigator !== 'undefined',
          mediaDevices: !!navigator?.mediaDevices,
          getUserMedia: !!navigator?.mediaDevices?.getUserMedia,
          isSecureContext: window?.isSecureContext,
          userAgent: navigator?.userAgent,
          protocol: window?.location?.protocol
        });

        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error("getUserMedia ikke understøttet");
        }

        if (!window.isSecureContext) {
          throw new Error("Kræver HTTPS for kamera adgang");
        }

        console.log("📞 getUserMedia request starting...");
        
        // Try with basic constraints first
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: { ideal: "environment" }
          }
        });

        console.log("✅ getUserMedia success:", {
          stream: !!mediaStream,
          tracks: mediaStream?.getTracks?.()?.length || 0,
          videoTracks: mediaStream?.getVideoTracks?.()?.length || 0
        });

        if (!mounted) {
          console.log("⚠️ Component unmounted, stopping stream");
          mediaStream?.getTracks?.()?.forEach?.(track => track.stop());
          return;
        }

        setStream(mediaStream);

        // Wait for video element and setup
        let attempts = 0;
        const setupVideo = () => {
          attempts++;
          console.log(`🎬 Setting up video element (attempt ${attempts})`);
          
          if (!videoRef.current) {
            console.log("⚠️ Video element not ready, retrying...");
            if (attempts < 10) {
              setTimeout(setupVideo, 100);
            } else {
              throw new Error("Video element aldrig blevet klar");
            }
            return;
          }

          const video = videoRef.current;
          video.srcObject = mediaStream;
          video.muted = true;
          video.playsInline = true;
          
          console.log("📺 Video srcObject set, waiting for metadata...");

          const onLoadedMetadata = () => {
            console.log("✅ Video metadata loaded:", {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState
            });
            
            if (mounted) {
              setIsLoading(false);
              setError(null);
            }
          };

          const onError = (e: Event) => {
            console.error("❌ Video error:", e);
            if (mounted) {
              setError("Video fejl - kan ikke afspille kamera feed");
              setIsLoading(false);
            }
          };

          video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
          video.addEventListener('error', onError);

          // Fallback - if metadata doesn't load within 5 seconds
          setTimeout(() => {
            if (mounted && isLoading) {
              console.log("⏰ Metadata timeout, trying to play anyway");
              setIsLoading(false);
              setError(null);
            }
          }, 5000);
        };

        setupVideo();

      } catch (err) {
        console.error("❌ Camera initialization failed:", err);
        
        if (!mounted) return;
        
        let errorMessage = "Kunne ikke få adgang til kameraet. ";
        if (err instanceof Error) {
          console.error("❌ Error details:", {
            name: err.name,
            message: err.message,
            stack: err.stack
          });
          
          if (err.name === "NotAllowedError") {
            errorMessage += "Du skal give tilladelse til kameraet. Tryk på 'Tillad' når browseren spørger.";
          } else if (err.name === "NotFoundError") {
            errorMessage += "Intet kamera fundet på denne enhed.";
          } else if (err.name === "NotSupportedError") {
            errorMessage += "Kameraet understøttes ikke i denne browser.";
          } else if (err.name === "NotReadableError") {
            errorMessage += "Kameraet er i brug af et andet program.";
          } else if (err.name === "OverconstrainedError") {
            errorMessage += "Kamera indstillinger ikke understøttet.";
          } else {
            errorMessage += err.message;
          }
        }
        
        setError(errorMessage);
        setIsLoading(false);
        toast.error(errorMessage);
      }
    };

    // Small delay to ensure component is fully mounted
    const timer = setTimeout(initCamera, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      console.log("🧹 Cleaning up camera component");
      if (stream) {
        stream.getTracks().forEach(track => {
          console.log("🛑 Stopping track:", track.kind);
          track.stop();
        });
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