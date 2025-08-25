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
  
  const [isCapturing, setIsCapturing] = useState(true); // Start with true to show video immediately
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  console.log("📊 CameraCapture state - isCapturing:", isCapturing, "capturedImage:", !!capturedImage);

  const startCamera = async () => {
    console.log("🎥 Starting camera...");
    console.log("🌐 User Agent:", navigator.userAgent);
    console.log("🔒 Page Protocol:", window.location.protocol);
    console.log("🔍 MediaDevices available:", !!navigator.mediaDevices);
    console.log("🎦 getUserMedia available:", !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
    
    try {
      console.log("📱 Requesting camera permission...");
      
      // Check if navigator.mediaDevices exists
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("💥 Camera API not supported");
        throw new Error("Camera API not supported");
      }
      
      console.log("⚙️ Calling getUserMedia with constraints:", {
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      console.log("✅ Camera permission granted, stream:", stream);
      console.log("📹 Stream tracks:", stream.getTracks().length);
      
      if (videoRef.current) {
        console.log("🎬 Setting video srcObject");
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
        console.log("🎬 Camera started successfully, isCapturing set to true");
        
        // Wait for video to load before showing it
        videoRef.current.onloadedmetadata = () => {
          console.log("📹 Video metadata loaded");
        };
      } else {
        console.error("❌ videoRef.current is null");
      }
    } catch (error) {
      console.error("❌ Error accessing camera:", error);
      console.error("❌ Error name:", error instanceof Error ? error.name : 'Unknown');
      console.error("❌ Error message:", error instanceof Error ? error.message : 'Unknown');
      
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
      
      toast.error(errorMessage);
    }
  };

  // Auto-start camera when component mounts
  useEffect(() => {
    console.log("🚀 CameraCapture component mounted");
    
    // Small delay to ensure video element is rendered
    const timer = setTimeout(() => {
      console.log("⏰ Starting camera after delay");
      startCamera();
    }, 100);
    
    // Cleanup function to stop camera when component unmounts
    return () => {
      clearTimeout(timer);
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
      {/* Camera View */}
      {isCapturing && !capturedImage && (
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Camera Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-8 pb-12">
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center"
            >
              <X className="h-6 w-6 text-white" />
            </button>
            
            {/* Capture Button */}
            <button 
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg"
            >
              <div className="w-16 h-16 rounded-full border-2 border-black"></div>
            </button>
            
            {/* Rotate Camera Button */}
            <button 
              className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center"
            >
              <RotateCw className="h-6 w-6 text-white" />
            </button>
          </div>
          
          {/* PHOTO Text */}
          <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2">
            <span className="text-yellow-400 text-lg font-semibold tracking-wider">PHOTO</span>
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
          
          {/* Controls for captured image */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-8 pb-12">
            {/* Retake Button */}
            <button 
              onClick={retakePhoto}
              className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center"
            >
              <RotateCcw className="h-6 w-6 text-white" />
            </button>
            
            {/* Confirm Button */}
            <button 
              onClick={confirmCapture}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg"
            >
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-sm font-semibold">OK</span>
              </div>
            </button>
            
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Initial Camera Start View */}
      {!isCapturing && !capturedImage && (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-white bg-black">
          <Camera className="h-20 w-20 mx-auto mb-6 text-white/70" />
          <p className="text-white/70 mb-6 text-lg">
            Klik for at åbne kameraet og tag et billede af dit affald
          </p>
          <button 
            onClick={startCamera}
            className="bg-white text-black px-8 py-4 rounded-full text-lg font-semibold"
          >
            Åbn kamera
          </button>
          <p className="text-sm text-white/50 mt-4">
            Sørg for at give tilladelse til kameraet når browseren spørger
          </p>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};