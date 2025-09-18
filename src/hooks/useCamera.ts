import { useState, useCallback } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

export const useCamera = () => {
  const [isNative] = useState(() => Capacitor.isNativePlatform());

  const capturePhoto = useCallback(async (): Promise<string | null> => {
    try {
      if (isNative) {
        // Use native camera on mobile devices
        console.log('📱 Using native camera');
        
        const photo = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
        });

        if (photo.dataUrl) {
          console.log('✅ Native photo captured');
          return photo.dataUrl;
        }
      } else {
        // Fallback to web camera
        console.log('🌐 Native camera not available, using web camera');
        return null; // Will trigger web camera component
      }
    } catch (error: any) {
      console.error('❌ Camera error:', error);
      
      let message = 'Kunne ikke starte kamera';
      if (error.message?.includes('cancelled')) {
        message = 'Kamera blev annulleret';
      } else if (error.message?.includes('permission')) {
        message = 'Kamera adgang blev nægtet. Gå til indstillinger for at give tilladelse.';
      }
      
      toast.error(message);
    }
    
    return null;
  }, [isNative]);

  return {
    capturePhoto,
    isNative,
  };
};