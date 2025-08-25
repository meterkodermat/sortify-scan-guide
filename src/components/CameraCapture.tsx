import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, X, RotateCcw } from "lucide-react";
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
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <Card className="flex-1 bg-gradient-card shadow-strong m-0 rounded-none">
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-4 bg-background/90">
            <h3 className="text-lg font-semibold">Tag et billede</h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 flex flex-col">
            {!isCapturing && !capturedImage && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <Camera className="h-20 w-20 mx-auto mb-6 text-muted-foreground" />
                <p className="text-muted-foreground mb-6 text-lg">
                  Klik for at åbne kameraet og tag et billede af dit affald
                </p>
                <Button onClick={startCamera} variant="scan" size="lg" className="w-full max-w-xs">
                  <Camera className="h-5 w-5 mr-2" />
                  Åbn kamera
                </Button>
                <p className="text-sm text-muted-foreground mt-4">
                  Sørg for at give tilladelse til kameraet når browseren spørger
                </p>
              </div>
            )}

            {isCapturing && !capturedImage && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4 bg-background/90">
                  <Button onClick={capturePhoto} variant="scan" size="lg" className="w-full">
                    <Camera className="h-6 w-6 mr-2" />
                    Tag billede
                  </Button>
                </div>
              </div>
            )}

            {capturedImage && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 relative">
                  <img
                    src={capturedImage}
                    alt="Captured waste item"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4 bg-background/90 flex space-x-3">
                  <Button onClick={retakePhoto} variant="outline" size="lg" className="flex-1">
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Tag igen
                  </Button>
                  <Button onClick={confirmCapture} variant="success" size="lg" className="flex-1">
                    Analyser
                  </Button>
                </div>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      </Card>
    </div>
  );
};