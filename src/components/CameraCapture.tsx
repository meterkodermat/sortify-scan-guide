import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, X, RotateCcw } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initCamera = async () => {
    console.log('🔄 Attempting to initialize camera...');
    
    if (!videoRef.current) {
      console.error('❌ Video element not found, retrying in 200ms...');
      setTimeout(initCamera, 200);
      return;
    }

    try {
      console.log('📱 Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      console.log('✅ Camera stream obtained:', stream);
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      videoRef.current.onloadedmetadata = () => {
        console.log('📺 Video metadata loaded, starting playback...');
        videoRef.current?.play().then(() => {
          console.log('▶️ Video is now playing');
          setIsLoading(false);
        }).catch(err => {
          console.error('❌ Failed to play video:', err);
          setError('Failed to start video playback');
          setIsLoading(false);
        });
      };
      
    } catch (err) {
      console.error('❌ Camera initialization failed:', err);
      setError('Could not access camera. Please check permissions.');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('🚀 CameraCapture component mounted');
    
    // Add small delay to ensure video element is rendered
    setTimeout(() => {
      initCamera();
    }, 100);

    return () => {
      console.log('🧹 Cleaning up camera stream...');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('❌ Video or canvas element not found');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      console.error('❌ Could not get canvas context');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    console.log('📸 Image captured, data length:', imageData.length);
    onCapture(imageData);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <div className="space-y-4">
            <div className="text-destructive">
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h2 className="text-lg font-semibold mb-2">Camera Error</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={onClose} variant="outline" className="w-full">
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-black/50 backdrop-blur-sm z-10">
        <Button 
          onClick={onClose}
          variant="ghost" 
          size="sm"
          className="text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </Button>
        <h1 className="text-white font-medium">Tag billede</h1>
        <div className="w-9"></div>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-black flex items-center justify-center z-20">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Starting camera...</p>
            </div>
          </div>
        )}
        
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="p-6 bg-black/50 backdrop-blur-sm">
        <div className="flex justify-center">
          <Button
            onClick={captureImage}
            disabled={isLoading}
            className="w-16 h-16 rounded-full bg-white hover:bg-gray-200 text-black"
          >
            <Camera className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;