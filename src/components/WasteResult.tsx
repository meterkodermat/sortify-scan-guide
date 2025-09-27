import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Home, Recycle, Info } from "lucide-react";
import farligtAffaldImg from "@/assets/farligtaffald.png";
import glasImg from "@/assets/glas.png";
import madDrikkeKartonerImg from "@/assets/mad-drikke-kartoner.png";
import madaffalImg from "@/assets/madaffald.png";
import metalImg from "@/assets/metal.png";
import papImg from "@/assets/pap.png";
import papirImg from "@/assets/papir.png";
import plastImg from "@/assets/plast.png";
import restaffalImg from "@/assets/restaffald.png";
import tekstilaffalImg from "@/assets/tekstilaftald.png";

interface WasteItem {
  id: string;
  name: string;
  image: string;
  homeCategory: string;
  recyclingCategory: string;
  description: string;
  confidence: number;
  timestamp: Date;
  aiThoughtProcess?: string;
  components?: Array<{
    genstand: string;
    materiale: string;
    tilstand?: string;
  }>;
}

interface WasteResultProps {
  item: WasteItem;
  onBack: () => void;
  onHome: () => void;
  scannedImage?: string;
}

const getSortingPictogram = (category: string) => {
  const imgClass = "w-16 h-16 object-contain";
  
  console.log('getSortingPictogram - Original category:', category);
  const normalizedCategory = category.toLowerCase();
  console.log('getSortingPictogram - Normalized category:', normalizedCategory);
  
  // Handle bonpapir (receipt paper) specifically
  if (normalizedCategory.includes('bonpapir')) {
    return <img src={papirImg} alt="Bonpapir" className={imgClass} />;
  }
  
  // Handle pant (deposit bottles/cans) - very important category
  if (normalizedCategory.includes('pant')) {
    return <img src={plastImg} alt="Pant" className={imgClass} />;
  }
  
  if (normalizedCategory.includes('karton') || normalizedCategory.includes('mad- & drikke-kartoner')) {
    return <img src={madDrikkeKartonerImg} alt="Mad- & drikke-kartoner" className={imgClass} />;
  }
  
  if (normalizedCategory.includes('papir')) {
    return <img src={papirImg} alt="Papir" className={imgClass} />;
  }
  if (normalizedCategory.includes('pap') && !normalizedCategory.includes('karton')) {
    return <img src={papImg} alt="Pap" className={imgClass} />;
  }
  
  if (normalizedCategory.includes('plast') || normalizedCategory.includes('plastic')) {
    return <img src={plastImg} alt="Plast" className={imgClass} />;
  }
  
  if (normalizedCategory.includes('glas')) {
    return <img src={glasImg} alt="Glas" className={imgClass} />;
  }
  
  if (normalizedCategory.includes('metal')) {
    return <img src={metalImg} alt="Metal" className={imgClass} />;
  }
  
  if (normalizedCategory.includes('mad') || normalizedCategory.includes('organisk') || normalizedCategory.includes('kompost') || normalizedCategory.includes('madaffald')) {
    return <img src={madaffalImg} alt="Madaffald" className={imgClass} />;
  }
  
  if (normalizedCategory.includes('farligt') || normalizedCategory.includes('elektronik')) {
    return <img src={farligtAffaldImg} alt="Farligt affald" className={imgClass} />;
  }
  
  if (normalizedCategory.includes('tekstil')) {
    return <img src={tekstilaffalImg} alt="Tekstilaffald" className={imgClass} />;
  }
  
  return <img src={restaffalImg} alt="Restaffald" className={imgClass} />;
};

export const WasteResult = ({ item, onBack, onHome, scannedImage }: WasteResultProps) => {
  // Find the component with highest score to show as main title
  const componentCount = item.components ? item.components.length : 0;
  let showTitle = item.name || "Ukendt genstand";
  
  if (item.components && item.components.length > 0) {
    // Sort by material type - elektronik gets highest priority
    const sortedComponents = [...item.components].sort((a, b) => {
      const aScore = a.materiale === 'elektronik' ? 100 : 50;
      const bScore = b.materiale === 'elektronik' ? 100 : 50;
      return bScore - aScore;
    });
    
    // Use genstand property or fallback to description (for compatibility)
    const bestComponent = sortedComponents[0];
    showTitle = bestComponent.genstand || (bestComponent as any).description || item.name || "Ukendt genstand";
  }
  
  console.log('WasteResult - Component count:', componentCount);
  console.log('WasteResult - Show title:', showTitle);
  
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
        </div>


        {/* Main Item - Top Section */}
        <Card className="p-8 bg-gradient-card shadow-card text-center border-2 border-primary/20">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-foreground">
              {showTitle}
            </h1>
            {scannedImage && (
              <div className="mt-4">
                <img 
                  src={scannedImage} 
                  alt="Scannet billede" 
                  className="mx-auto max-w-xs h-32 object-cover rounded-lg border-2 border-gray-200"
                />
              </div>
            )}
          </div>
        </Card>


        {/* Sorting Instructions - Always show main item sorting */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Sortering:</h2>
          
          {/* Home Sorting */}
          <Card className="p-4 bg-card border-2 border-muted/50">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-muted/20 rounded-lg">
                <Home className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Hjemmesortering</h3>
                <div className="flex items-center gap-3 mt-2">
                  {getSortingPictogram(item.homeCategory)}
                  <span className="font-semibold text-lg">{item.homeCategory}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Recycling Center */}
          <Card className="p-4 bg-card border-2 border-muted/50">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-muted/20 rounded-lg">
                <Recycle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Genbrugsplads</h3>
                <div className="mt-2">
                  <span className="font-semibold text-lg">{item.recyclingCategory}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* AI Analysis Process (if available) */}
        {item.aiThoughtProcess && (
          <Card className="p-4 bg-muted/30 border-dashed">
            <div className="flex items-start">
              <Info className="h-4 w-4 mr-2 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="italic">{item.aiThoughtProcess}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Additional Info */}
        <Card className="p-4 bg-muted/50">
          <div className="flex items-start">
            <Info className="h-5 w-5 mr-2 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Vigtigt at vide:</p>
              <p>Sørg for at emnet er rent før sortering. Hvis du er i tvivl, kan du altid kontakte din kommune.</p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex space-x-3">
          <Button variant="default" onClick={onHome} className="flex-1">
            Hjem
          </Button>
        </div>
      </div>
    </div>
  );
};