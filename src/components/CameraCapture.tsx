import React, { useRef, useState } from "react";

interface CameraCaptureProps {
  onCapture: (imageData: string) => Promise<void>;
  onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);

  const startCamera = async () => {
    if (!streaming) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreaming(true);
        }
      } catch (err) {
        alert("Kunne ikke få adgang til kameraet.");
      }
    }
  };

  const takePicture = async () => {
    if (videoRef.current && canvasRef.current) {
      const width = videoRef.current.videoWidth;
      const height = videoRef.current.videoHeight;
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, width, height);
        const imageData = canvasRef.current.toDataURL('image/jpeg', 0.8);
        await onCapture(imageData);
      }
    }
  };

  React.useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 400 }}>
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 3,
          padding: "8px 12px",
          fontSize: 14,
          background: "#fff",
          border: "none",
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(15, 81, 2, 0.2)",
          cursor: "pointer"
        }}
      >
        Luk
      </button>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "100%", borderRadius: 8 }}
      />
      <button
        onClick={takePicture}
        style={{
          position: "absolute",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2,
          padding: "12px 24px",
          fontSize: 16,
          background: "#fff",
          border: "none",
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(15, 81, 2, 0.2)",
          cursor: "pointer"
        }}
      >
        Tag billede
      </button>
      <canvas
        ref={canvasRef}
        style={{ display: "none" }}
      />
    </div>
  );
};

export default CameraCapture;