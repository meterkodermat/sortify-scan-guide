import { useState, useRef, useEffect } from "react";
import { Camera, X, RotateCcw, Play } from "lucide-react";
import { toast } from "sonner";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

export const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [needsClick, setNeedsClick] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Wait a bit for the component to render, then initialize camera
    const timer = setTimeout(initCamera, 100);
    return () => {
      clearTimeout(timer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const initCamera = async () => {
    try {
      console.log("🎥 Step 1: Starting camera initialization...");
      
      // Ensure video element exists
      if (!videoRef.current) {
        console.log("⏳ Video element not ready, retrying in 200ms...");
        setTimeout(initCamera, 200);
        return;
      }
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia not supported");
      }
      console.log("✅ Step 2: getUserMedia is available");
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      
      console.log("✅ Step 3: Camera stream obtained", stream);
      console.log("📊 Stream details:", {
        active: stream.active,
        tracks: stream.getVideoTracks().length,
        trackState: stream.getVideoTracks()[0]?.readyState
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        console.log("✅ Step 4: Video element exists");
        
        videoRef.current.srcObject = stream;
        console.log("✅ Step 5: Stream assigned to video element");
        
        // Log video element properties
        console.log("📺 Video element state:", {
          videoWidth: videoRef.current.videoWidth,
          videoHeight: videoRef.current.videoHeight,
          readyState: videoRef.current.readyState,
          paused: videoRef.current.paused,
          muted: videoRef.current.muted
        });
        
        // This is the key fix - wait for loadedmetadata event
        videoRef.current.addEventListener("loadedmetadata", () => {
          console.log("📽️ Step 6: Video metadata loaded!");
          
          if (videoRef.current) {
            console.log("📺 Video dimensions:", {
              videoWidth: videoRef.current.videoWidth,
              videoHeight: videoRef.current.videoHeight,
              readyState: videoRef.current.readyState
            });
            
            videoRef.current.play()
              .then(() => {
                console.log("✅ Step 7: Video playing successfully!");
                setStreamReady(true);
                setNeedsClick(false);
              })
              .catch(err => {
                console.log("⚠️ Step 7 FAILED: Need user interaction:", err);
                setStreamReady(true);
                setNeedsClick(true);
              });
          }
        });

        // Also try immediate play as fallback
        setTimeout(async () => {
          if (videoRef.current && !streamReady) {
            console.log("🔄 Fallback: Trying immediate play...");
            try {
              await videoRef.current.play();
              console.log("✅ Fallback success!");
              setStreamReady(true);
              setNeedsClick(false);
            } catch (err) {
              console.log("⚠️ Fallback failed, user interaction needed");
            }
          }
        }, 1000);
        
      } else {
        console.error("❌ Step 4 FAILED: Video element not found!");
      }
      
    } catch (err: any) {
      console.error("❌ Camera initialization failed at early step:", err);
      console.error("Error details:", {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      setError(err.name === "NotAllowedError" ? 
        "Tillad kamera adgang i browseren" : 
        "Kunne ikke starte kamera");
    }
  };

  const playVideo = async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.play();
        setNeedsClick(false);
        console.log("▶️ Manual play success");
      } catch (err) {
        console.error("❌ Manual play failed:", err);
      }
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) {
      toast.error("Kamera ikke klar");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageData);
    
    // Stop stream
    streamRef.current.getTracks().forEach(track => track.stop());
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setStreamReady(false);
    setNeedsClick(false);
    setError(null);
    initCamera();
  };

  // Show captured image
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

  // Main camera view
  return (
    <div className="fixed inset-0 bg-black z-50">
      <button onClick={onClose} className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
        <X className="h-5 w-5 text-white" />
      </button>

      {error ? (
        <div className="h-full flex flex-col items-center justify-center text-white p-6 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <X className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-xl font-semibold mb-4">Kamera fejl</h3>
          <p className="mb-6 text-white/80">{error}</p>
          <button onClick={() => { setError(null); initCamera(); }} className="bg-blue-500 px-6 py-3 rounded-lg">
            Prøv igen
          </button>
        </div>
      ) : !streamReady ? (
        <div className="h-full flex flex-col items-center justify-center text-white">
          <div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mb-4"></div>
          <p className="text-lg mb-2">Starter kamera...</p>
        </div>
      ) : (
        <div className="relative h-full">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {needsClick && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <button onClick={playVideo} className="w-20 h-20 rounded-full bg-white flex items-center justify-center">
                <Play className="h-10 w-10 text-black ml-1" />
              </button>
            </div>
          )}
          
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <button onClick={capturePhoto} className="w-24 h-24 rounded-full bg-white/90 flex items-center justify-center shadow-xl active:scale-95 transition-transform">
              <Camera className="h-12 w-12 text-black" />
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};