import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (imageData: string) => Promise<void>;
  onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Kamera-ikon som SVG-komponent
  const CameraIcon = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      style={{ marginRight: 8, verticalAlign: "middle" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="13" r="3.2" stroke="white" strokeWidth="2" />
      <rect x="3" y="7" width="18" height="12" rx="3" stroke="white" strokeWidth="2" />
      <rect x="9" y="3" width="6" height="4" rx="2" stroke="white" strokeWidth="2" />
    </svg>
  );

  useEffect(() => {
    let stream: MediaStream | null = null;

    const getCamera = async () => {
      try {
        const constraints = {
          video: {
            facingMode: { ideal: "environment" }, // Prøv bagkamera på mobil, ellers standard
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints as MediaStreamConstraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Kunne ikke åbne kameraet:", err);
      }
    };

    getCamera();

    // Cleanup: stop camera when component unmounts
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleTakePicture = () => {
    if (videoRef.current) {
      console.log('📸 Taking picture from camera...');
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      console.log('📐 Canvas dimensions:', canvas.width, 'x', canvas.height);
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        console.log('✅ Image captured successfully, data length:', imageData.length);
        onCapture(imageData);
      } else {
        console.error('❌ Could not get canvas context');
      }
    } else {
      console.error('❌ Video element not available');
    }
  };

  return (
    <div className="relative w-full h-screen bg-black">
      {/* Close button */}
      <Button
        onClick={onClose}
        variant="ghost"
        size="icon"
        className="absolute top-4 left-4 z-10 bg-black/20 text-white border-white/20 hover:bg-black/40"
      >
        <X className="h-6 w-6" />
      </Button>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
        muted
      />
      
      <Button
        onClick={handleTakePicture}
        className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground hover:bg-primary/90 h-16 px-8 text-lg font-semibold shadow-lg"
      >
        <CameraIcon />
        Tag billede
      </Button>
    </div>
  );
};

export default CameraCapture;