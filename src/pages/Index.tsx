import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CameraCapture } from "@/components/CameraCapture";
import { WasteResult } from "@/components/WasteResult";
import { RecentScans } from "@/components/RecentScans";
import { identifyWaste } from "@/utils/mockAI";
import { Camera, Upload, Leaf, Recycle } from "lucide-react";
import { toast } from "sonner";
import heroImage from "@/assets/hero-image.jpg";

interface WasteItem {
  id: string;
  name: string;
  image: string;
  homeCategory: string;
  recyclingCategory: string;
  description: string;
  confidence: number;
  timestamp: Date;
}

type ViewState = 'home' | 'camera' | 'result' | 'analyzing';

const Index = () => {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [currentResult, setCurrentResult] = useState<WasteItem | null>(null);
  const [recentScans, setRecentScans] = useState<WasteItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Debug current view state
  console.log("🏠 Current view state:", currentView);

  const handleImageCapture = async (imageData: string) => {
    setCurrentView('analyzing');
    setIsAnalyzing(true);
    
    try {
      const result = await identifyWaste(imageData);
      setCurrentResult(result);
      
      // Add to recent scans (keep only last 10)
      setRecentScans(prev => [result, ...prev.slice(0, 9)]);
      
      setCurrentView('result');
      toast.success("Affald identificeret!");
    } catch (error) {
      toast.error("Kunne ikke analysere billedet. Prøv igen.");
      setCurrentView('home');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        handleImageCapture(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectRecentScan = (scan: WasteItem) => {
    setCurrentResult(scan);
    setCurrentView('result');
  };

  if (currentView === 'camera') {
    console.log("🎬 Rendering CameraCapture component");
    return (
      <CameraCapture
        onCapture={handleImageCapture}
        onClose={() => {
          console.log("🔒 Camera closed by user");
          setCurrentView('home');
        }}
      />
    );
  }

  if (currentView === 'analyzing') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center bg-gradient-card shadow-strong">
          <div className="space-y-6">
            <div className="relative">
              <div className="w-16 h-16 mx-auto bg-gradient-primary rounded-full flex items-center justify-center animate-pulse">
                <Recycle className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Analyserer billede...</h2>
              <p className="text-muted-foreground">
                Vores AI identificerer dit affald og finder den bedste sorteringsmetode
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (currentView === 'result' && currentResult) {
    return (
      <WasteResult
        item={currentResult}
        onBack={() => setCurrentView('home')}
        onHome={() => setCurrentView('home')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative h-64 bg-gradient-primary overflow-hidden">
        <img
          src={heroImage}
          alt="Sortify - Affaldssortering"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 flex items-center justify-center text-center p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <Leaf className="h-8 w-8 text-primary-foreground" />
              <h1 className="text-3xl font-bold text-primary-foreground">Sortify</h1>
            </div>
            <p className="text-primary-foreground/90 max-w-md">
              Din intelligente guide til korrekt affaldssortering
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 max-w-md mx-auto space-y-8">
        {/* Action Buttons */}
        <div className="space-y-4">
          <Button
            onClick={() => {
              console.log("🔘 Scan button clicked");
              setCurrentView('camera');
              console.log("📷 Setting view to camera");
            }}
            variant="scan"
            size="lg"
            className="w-full h-16 text-lg"
            disabled={isAnalyzing}
          >
            <Camera className="h-6 w-6 mr-3" />
            Start scanning
          </Button>

          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isAnalyzing}
            />
            <Button
              variant="upload"
              size="lg"
              className="w-full h-16 text-lg"
              disabled={isAnalyzing}
            >
              <Upload className="h-6 w-6 mr-3" />
              Upload billede
            </Button>
          </div>
        </div>


        {/* Recent Scans */}
        {recentScans.length > 0 && (
          <RecentScans
            scans={recentScans}
            onSelectScan={handleSelectRecentScan}
            onClearHistory={() => setRecentScans([])}
          />
        )}

      </div>
    </div>
  );
};

export default Index;
