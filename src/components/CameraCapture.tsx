import React, { useRef, useEffect } from "react";

const Kamera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const getCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Kunne ikke åbne kameraet:", err);
      }
    };
    getCamera();
  }, []);

  return (
    <div>
      <video ref={videoRef} autoPlay style={{ width: "100%" }} />
    </div>
  );
};

export default Kamera;