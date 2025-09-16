import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, RotateCcw, RotateCw } from "lucide-react";
import { toast } from "sonner";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

export const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  console.log("🎥 CameraCapture component initialized");
  
  const [isCapturing, setIsCapturing] = useState(false); // Start with false for clearer flow
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  console.log("📊 CameraCapture state - isCapturing:", isCapturing, "capturedImage:", !!capturedImage);

  const startCamera = async () => {
    console.log("🎥 Starting camera...");
    setIsLoading(true);
    setCameraError(null);
    
    try {
      // Check if navigator.mediaDevices exists
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("❌ Camera API not supported");
        throw new Error("Camera API not supported");
      }
      
      console.log("📱 Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      console.log("✅ Camera stream obtained:", !!stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log("📺 Video element srcObject set");
        setIsCapturing(true);
        setIsLoading(false);
        console.log("✅ Camera started successfully");
      } else {
        console.error("❌ Video ref not available");
        throw new Error("Video element not ready");
      }
    } catch (error) {
      console.error("❌ Error accessing camera:", error);
      setIsLoading(false);
      
      let errorMessage = "Kunne ikke få adgang til kameraet. ";
      
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          errorMessage += "Giv tilladelse til kameraet i browserindstillingerne.";
        } else if (error.name === "NotFoundError") {
          errorMessage += "Intet kamera fundet på enheden.";
        } else if (error.name === "NotSupportedError") {
          errorMessage += "Kamera understøttes ikke i denne browser.";
        } else {
          errorMessage += error.message;
        }
      }
      
      console.error("🚨 Final error message:", errorMessage);
      setCameraError(errorMessage);
      toast.error(errorMessage);
    }
  };

  // Auto-start camera when component mounts
  useEffect(() => {
    console.log("🚀 CameraCapture component mounted - starting camera automatically");
    startCamera();
    
    // Cleanup function to stop camera when component unmounts
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          console.log("🛑 Stopping camera track");
          track.stop();
        });
      }
    };
  }, []);

  const capturePhoto = () => {
    console.log("📸 Taking photo...");
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      context?.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedImage(imageData);
      console.log("✅ Photo captured successfully");
      
      // Stop the camera stream
      const stream = video.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    } else {
      console.error("❌ Video or canvas ref not available");
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const confirmCapture = () => {
    console.log("🔄 Confirming capture...");
    if (capturedImage) {
      console.log("📤 Sending image for analysis");
      onCapture(capturedImage);
    } else {
      console.error("❌ No captured image available");
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

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mb-4"></div>
          <p className="text-lg">Starter kamera...</p>
        </div>
      )}

      {/* Error State */}
      {cameraError && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-white p-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <X className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-xl font-semibold mb-4">Kamera fejl</h3>
          <p className="text-center text-white/80 mb-6 max-w-sm">
            {cameraError}
          </p>
          <button 
            onClick={startCamera}
            className="bg-white text-black px-8 py-3 rounded-full font-semibold"
          >
            Prøv igen
          </button>
        </div>
      )}

      {/* Camera View */}
      {isCapturing && !capturedImage && (
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Take Photo Interface - centered */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Green background similar to the uploaded image */}
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
          
          {/* Image Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
            <div className="flex items-center justify-between">
              {/* Retake */}
              <button 
                onClick={retakePhoto}
                className="flex flex-col items-center space-y-2 text-white"
              >
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <RotateCcw className="h-6 w-6" />
                </div>
                <span className="text-sm">Tag igen</span>
              </button>
              
              {/* Confirm */}
              <button 
                onClick={confirmCapture}
                className="flex flex-col items-center space-y-2"
              >
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-xl">
                  <span className="text-white text-lg font-bold">✓</span>
                </div>
                <span className="text-white text-sm font-medium">Analyser nu</span>
              </button>
              
              {/* Close */}
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