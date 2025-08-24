import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

export const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    console.log("🎥 Starting camera...");
    try {
      console.log("📱 Requesting camera permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } // Use back camera on mobile
      });
      console.log("✅ Camera permission granted");
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
        console.log("🎬 Camera started successfully");
      }
    } catch (error) {
      console.error("❌ Error accessing camera:", error);
      toast.error("Kunne ikke få adgang til kameraet. Tjek at du har givet tilladelse.");
    }
  };

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
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-card shadow-strong">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Tag et billede</h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-4">
            {!isCapturing && !capturedImage && (
              <div className="text-center">
                <Camera className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Klik for at åbne kameraet og tag et billede af dit affald
                </p>
                <Button onClick={startCamera} variant="scan" className="w-full">
                  <Camera className="h-5 w-5 mr-2" />
                  Åbn kamera
                </Button>
              </div>
            )}

            {isCapturing && !capturedImage && (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-64 object-cover"
                  />
                </div>
                <Button onClick={capturePhoto} variant="scan" className="w-full">
                  <Camera className="h-5 w-5 mr-2" />
                  Tag billede
                </Button>
              </div>
            )}

            {capturedImage && (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden">
                  <img
                    src={capturedImage}
                    alt="Captured waste item"
                    className="w-full h-64 object-cover"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={retakePhoto} variant="outline" className="flex-1">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Tag igen
                  </Button>
                  <Button onClick={confirmCapture} variant="success" className="flex-1">
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