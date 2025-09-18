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
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      console.log("📱 Starting camera...");
      setIsLoading(true);
      setError(null);

      if (!navigator.mediaDevices) {
        throw new Error("Kamera ikke tilgængeligt");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });

      console.log("✅ Got camera stream");
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Force play immediately
        try {
          await videoRef.current.play();
          console.log("✅ Video playing");
          setIsLoading(false);
        } catch (playErr) {
          console.log("⚠️ Auto-play failed, waiting for user interaction");
          setIsLoading(false);
        }
      }

    } catch (err: any) {
      console.error("❌ Camera failed:", err);
      let message = "Kunne ikke starte kamera";
      
      if (err.name === "NotAllowedError") {
        message = "Kamera adgang nægtet. Tillad kamera i browseren.";
      }
      
      setError(message);
      setIsLoading(false);
      toast.error(message);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error("Kamera ikke klar");
      return;
    }

    // Ensure video is playing
    if (videoRef.current.paused) {
      try {
        await videoRef.current.play();
      } catch (err) {
        toast.error("Kan ikke afspille video");
        return;
      }
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      toast.error("Canvas fejl");
      return;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    
    setCapturedImage(imageData);
    
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

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

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Close button */}
      <div className="absolute top-4 right-4 z-10">
        <button onClick={onClose} className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      {error && (
        <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center">
          <h3 className="text-xl font-semibold mb-4">Kamera fejl</h3>
          <p className="mb-6">{error}</p>
          <button onClick={startCamera} className="bg-blue-500 px-6 py-3 rounded-lg">
            Prøv igen
          </button>
        </div>
      )}

      {isLoading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mb-4"></div>
          <p className="text-lg">Starter kamera...</p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            controls={false}
            className="w-full h-full object-cover"
            onClick={async () => {
              // Fallback: if video isn't playing, try to start it on click
              if (videoRef.current?.paused) {
                try {
                  await videoRef.current.play();
                } catch (e) {
                  console.log("Play failed:", e);
                }
              }
            }}
          />
          
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <button 
              onClick={capturePhoto}
              className="w-24 h-24 rounded-full bg-white/90 flex items-center justify-center shadow-xl active:scale-95"
            >
              <Camera className="h-12 w-12 text-black" />
            </button>
          </div>
          
          {/* Manual play button if video is paused */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button 
              onClick={async () => {
                if (videoRef.current) {
                  try {
                    await videoRef.current.play();
                  } catch (e) {
                    console.log("Manual play failed:", e);
                  }
                }
              }}
              className="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center pointer-events-auto"
              style={{ display: videoRef.current?.paused ? 'flex' : 'none' }}
            >
              <span className="text-black text-2xl">▶</span>
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};