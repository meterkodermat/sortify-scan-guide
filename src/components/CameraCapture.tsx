import React, { useRef, useEffect } from "react";

interface CameraCaptureProps {
  onCapture: (imageData: string) => Promise<void>;
  onClose: () => void;
}

const Kamera: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

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

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "100%" }}
        muted // Muted for at undgå autoplay-blokering i nogle browsere
      ></video>
    </div>
  );
};

export default Kamera;