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
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      
      console.log("✅ Got camera stream");
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          console.log("📺 Video loaded, starting playback");
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                console.log("▶️ Video playing successfully");
                setIsLoading(false);
              })
              .catch(err => {
                console.log("⚠️ Autoplay failed, adding click handler:", err);
                setIsLoading(false);
              });
          }
        };
      }
      
    } catch (err: any) {
      console.error("❌ Camera error:", err);
      let message = "Kunne ikke starte kamera";
      
      if (err.name === "NotAllowedError") {
        message = "Kamera adgang nægtet. Tillad kamera adgang og prøv igen.";
      } else if (err.name === "NotFoundError") {
        message = "Ingen kamera fundet.";
      }
      
      setError(message);
      setIsLoading(false);
      toast.error(message);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
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

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Close button */}
      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center"
      >
        <X className="h-5 w-5 text-white" />
      </button>

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center h-full">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <X className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-xl font-semibold mb-4">Kamera fejl</h3>
          <p className="mb-6 text-white/80 leading-relaxed max-w-sm">{error}</p>
          <button 
            onClick={() => {
              setError(null);
              startCamera();
            }}
            className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Prøv igen
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white h-full">
          <div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mb-4"></div>
          <p className="text-lg mb-2">Starter kamera...</p>
          <p className="text-sm text-white/70 text-center px-4">
            Tillad kamera adgang når browseren spørger
          </p>
        </div>
      ) : (
        <div className="relative h-full">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            onClick={() => videoRef.current?.play()}
          />
          
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <button 
              onClick={capturePhoto}
              className="w-24 h-24 rounded-full bg-white/90 flex items-center justify-center shadow-xl active:scale-95 transition-transform"
            >
              <Camera className="h-12 w-12 text-black" />
            </button>
          </div>
          
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