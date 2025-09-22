import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import CameraCapture from "@/components/CameraCapture";
import { WasteResult } from "@/components/WasteResult";
import { RecentScans } from "@/components/RecentScans";
import { SearchMode } from "@/components/SearchMode";
import { AreaSelector } from "@/components/AreaSelector";
import { identifyWaste } from "@/utils/mockAI";
import { Camera, Upload, Leaf, Recycle, Search, Settings } from "lucide-react";
import { toast } from "sonner";


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

type ViewState = 'area-select' | 'home' | 'search' | 'camera' | 'result' | 'analyzing';

const Index = () => {
  const [currentView, setCurrentView] = useState<ViewState>('area-select');
  const [currentResult, setCurrentResult] = useState<WasteItem | null>(null);
  const [recentScans, setRecentScans] = useState<WasteItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [scannedImageUrl, setScannedImageUrl] = useState<string | null>(null);


  const handleImageCapture = async (imageData: string) => {
    console.log('📸 Image captured, starting analysis...');
    setCurrentView('analyzing');
    setIsAnalyzing(true);
    
    try {
      const result = await identifyWaste(imageData);
      console.log('Identified waste result:', result);
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
      // Create URL for the uploaded image
      const imageUrl = URL.createObjectURL(file);
      setScannedImageUrl(imageUrl);
      
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

  const handleAreaSelected = (area: string) => {
    setSelectedArea(area);
    setCurrentView('home');
  };

  const handleSearchResult = (result: WasteItem) => {
    setCurrentResult(result);
    setScannedImageUrl(null); // Clear scanned image for search results
    // Add to recent scans (keep only last 10)
    setRecentScans(prev => [result, ...prev.slice(0, 9)]);
    setCurrentView('result');
  };

  if (currentView === 'area-select') {
    return (
      <AreaSelector onAreaSelected={handleAreaSelected} />
    );
  }

  if (currentView === 'search') {
    return (
      <SearchMode
        onBack={() => setCurrentView('home')}
        onResult={handleSearchResult}
      />
    );
  }

  if (currentView === 'camera') {
    return (
      <CameraCapture
        onCapture={handleImageCapture}
        onClose={() => setCurrentView('home')}
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
    console.log('Rendering WasteResult with item:', currentResult);
    return (
      <WasteResult
        item={currentResult}
        onBack={() => setCurrentView('home')}
        onHome={() => setCurrentView('home')}
        scannedImage={scannedImageUrl || undefined}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Hero Section */}
      <div className="relative h-72 sm:h-80 bg-gradient-hero overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
        
        {/* Demo Button in corner */}
        <div className="absolute top-4 right-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentView('area-select')}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 touch-manipulation"
          >
            <Settings className="h-4 w-4 mr-2" />
            Demo
          </Button>
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center text-center p-4 sm:p-6">
          <div className="space-y-4 sm:space-y-6 max-w-lg">
            <div className="flex items-center justify-center space-x-3">
              <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm shadow-glow">
                <Leaf className="h-8 w-8 sm:h-10 sm:w-10 text-primary-foreground" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-primary-foreground tracking-tight">Sortify</h1>
            </div>
            <p className="text-primary-foreground/95 text-base sm:text-lg font-medium leading-relaxed px-4">
              Din intelligente guide til korrekt affaldssortering
            </p>
            {selectedArea && (
              <p className="text-primary-foreground/80 text-xs sm:text-sm px-4">
                Område: {selectedArea === 'demo' ? 'Demo Database' : selectedArea}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 sm:p-8 max-w-lg mx-auto space-y-8 sm:space-y-10">
        {/* Action Buttons */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground">Find dit affald</h2>
            <p className="text-sm sm:text-base text-muted-foreground px-4">Vælg hvordan du vil identificere dit affald</p>
          </div>
          
          <div className="grid gap-3 sm:gap-4">
            <Button
              onClick={() => setCurrentView('search')}
              variant="default"
              size="lg"
              className="w-full h-16 sm:h-20 text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 touch-manipulation"
            >
              <div className="flex flex-col items-center space-y-1">
                <Search className="h-6 w-6 sm:h-8 sm:w-8" />
                <span className="font-semibold">Søg i database</span>
                <span className="text-xs opacity-90">Manual søgning</span>
              </div>
            </Button>

            <Button
              onClick={() => setCurrentView('camera')}
              variant="scan"
              size="lg"
              className="w-full h-16 sm:h-20 text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 touch-manipulation"
              disabled={isAnalyzing}
            >
              <div className="flex flex-col items-center space-y-1">
                <Camera className="h-6 w-6 sm:h-8 sm:w-8" />
                <span className="font-semibold">Start Kamera</span>
                <span className="text-xs opacity-90">Tag et billede nu</span>
              </div>
            </Button>

            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 touch-manipulation"
                disabled={isAnalyzing}
              />
              <Button
                variant="upload"
                size="lg"
                className="w-full h-16 sm:h-20 text-base sm:text-lg hover:shadow-card touch-manipulation"
                disabled={isAnalyzing}
              >
                <div className="flex flex-col items-center space-y-1">
                  <Upload className="h-6 w-6 sm:h-8 sm:w-8" />
                  <span className="font-semibold">Upload Billede</span>
                  <span className="text-xs opacity-70">Vælg fra galleri</span>
                </div>
              </Button>
            </div>
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
