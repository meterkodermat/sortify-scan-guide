import React, { useRef, useEffect } from "react";

const Kamera: React.FC = () => {
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

  // Dummy-funktion til knappen (kan udvides til at tage billede)
  const handleTakePicture = () => {
    alert("Tag billede-funktionen er ikke implementeret endnu.");
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "100%", display: "block" }}
        muted // Muted for at undgå autoplay-blokering i nogle browsere
      />
      <button
        onClick={handleTakePicture}
        style={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#025222",
          color: "white",
          border: "none",
          borderRadius: 8,
          padding: "12px 24px",
          fontSize: 18,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }}
      >
        <CameraIcon />
        Tag billede
      </button>
    </div>
  );
};

export default Kamera;