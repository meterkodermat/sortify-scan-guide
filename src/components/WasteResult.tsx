import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Home, Recycle, Info } from "lucide-react";
import farligtAffaldImg from "@/assets/farligt-affald-official.png";
import glasImg from "@/assets/glas-official.png";
import madDrikkeKartonerImg from "@/assets/mad-drikke-kartoner-official.png";
import madaffalImg from "@/assets/madaffald-official.png";
import metalImg from "@/assets/metal-official.png";
import papImg from "@/assets/pap-official.png";
import papirImg from "@/assets/papir-official.png";
import plastImg from "@/assets/plast-official.png";
import restaffalImg from "@/assets/restaffald-official.png";
import tekstilaffalImg from "@/assets/tekstilaffald-official.png";

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
}

const getSortingPictogram = (category: string) => {
  const imgClass = "w-24 h-24 mx-auto mb-2 object-contain";
  
  // Normalize category for matching
  const normalizedCategory = category.toLowerCase();
  
  // Card/carton categories
  if (normalizedCategory.includes('karton') || normalizedCategory.includes('mad- & drikke-kartoner')) {
    return <img src={madDrikkeKartonerImg} alt="Mad- & drikke-kartoner" className={imgClass} />;
  }
  
  // Paper/cardboard
  if (normalizedCategory.includes('pap') && !normalizedCategory.includes('karton')) {
    return <img src={papImg} alt="Pap" className={imgClass} />;
  }
  if (normalizedCategory.includes('papir')) {
    return <img src={papirImg} alt="Papir" className={imgClass} />;
  }
  
  // Plastic
  if (normalizedCategory.includes('plast') || normalizedCategory.includes('plastic')) {
    return <img src={plastImg} alt="Plast" className={imgClass} />;
  }
  
  // Glass
  if (normalizedCategory.includes('glas')) {
    return <img src={glasImg} alt="Glas" className={imgClass} />;
  }
  
  // Metal
  if (normalizedCategory.includes('metal')) {
    return <img src={metalImg} alt="Metal" className={imgClass} />;
  }
  
  // Food waste
  if (normalizedCategory.includes('mad') || normalizedCategory.includes('organisk') || normalizedCategory.includes('kompost') || normalizedCategory.includes('madaffald')) {
    return <img src={madaffalImg} alt="Madaffald" className={imgClass} />;
  }
  
  // Dangerous waste
  if (normalizedCategory.includes('farligt') || normalizedCategory.includes('elektronik')) {
    return <img src={farligtAffaldImg} alt="Farligt affald" className={imgClass} />;
  }
  
  // Textile waste
  if (normalizedCategory.includes('tekstil')) {
    return <img src={tekstilaffalImg} alt="Tekstilaffald" className={imgClass} />;
  }
  
  // Default for rest/other categories
  return <img src={restaffalImg} alt="Restaffald" className={imgClass} />;
};

export const WasteResult = ({ item, onBack, onHome }: WasteResultProps) => {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-5 w-5 mr-2" />
            Tilbage
          </Button>
          <Button variant="ghost" onClick={onHome}>
            <Home className="h-5 w-5" />
          </Button>
        </div>

        {/* Image */}
        <Card className="overflow-hidden bg-gradient-card shadow-card">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-64 object-cover"
          />
        </Card>

        {/* Identification */}
        <Card className="p-6 bg-gradient-card shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-foreground">
              {item.name || "Ukendt genstand"}
            </h2>
            <Badge variant="secondary" className="bg-success text-success-foreground">
              {Math.round(item.confidence)}% sikker
            </Badge>
          </div>
          <p className="text-muted-foreground">{item.description}</p>
        </Card>

        {/* Individual Components (if multiple found) */}
        {item.components && item.components.length > 1 && (
          <Card className="p-6 bg-gradient-card shadow-card">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Fundne komponenter:</h3>
            <div className="space-y-3">
              {item.components.map((component, index) => {
                const getMaterialCategory = (materiale: string) => {
                  switch (materiale) {
                    case 'pap': return { home: 'Pap', recycling: 'Pap', variant: 'secondary', pictogram: papImg };
                    case 'plastik': return { home: 'Plast', recycling: 'Hård plast', variant: 'outline', pictogram: plastImg };
                    case 'glas': return { home: 'Glas', recycling: 'Glas', variant: 'secondary', pictogram: glasImg };
                    case 'metal': return { home: 'Metal', recycling: 'Metal', variant: 'outline', pictogram: metalImg };
                    case 'madaffald': return { home: 'Madaffald', recycling: 'Ikke muligt', variant: 'destructive', pictogram: madaffalImg };
                    case 'farligt': return { home: 'Farligt affald', recycling: 'Farligt affald', variant: 'destructive', pictogram: farligtAffaldImg };
                    case 'tekstil': return { home: 'Tekstilaffald', recycling: 'Tekstilaffald', variant: 'outline', pictogram: tekstilaffalImg };
                    default: return { home: 'Restaffald', recycling: 'Rest efter sortering', variant: 'outline', pictogram: restaffalImg };
                  }
                };
                
                const category = getMaterialCategory(component.materiale);
                
                return (
                  <div key={index} className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-lg">
                      <img src={category.pictogram} alt={component.materiale} className="w-12 h-12 object-contain" />
                      <div className="flex-1">
                        <div className="font-medium text-foreground">
                          {component.genstand}
                          {component.tilstand && (
                            <span className="text-sm text-muted-foreground ml-2">({component.tilstand})</span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Materiale: {component.materiale}
                        </div>
                      </div>
                    </div>
                    
                    {/* Individual sorting cards for each component */}
                    <div className="grid grid-cols-1 gap-3 ml-4">
                      <Card className="p-4 bg-success text-success-foreground">
                        <div className="flex items-center gap-3">
                          <Home className="h-5 w-5" />
                          <div className="flex-1">
                            <div className="font-semibold">Hjemme sortering</div>
                            <div className="text-sm opacity-90">Sådan sorterer du hjemme</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-center mt-3 p-3 bg-white/10 rounded-lg">
                          <div className="text-center">
                            <img src={category.pictogram} alt={category.home} className="w-16 h-16 mx-auto mb-2 object-contain" />
                            <div className="font-bold">{category.home}</div>
                          </div>
                        </div>
                      </Card>
                      
                      <Card className="p-4 bg-accent text-accent-foreground">
                        <div className="flex items-center gap-3">
                          <Recycle className="h-5 w-5" />
                          <div className="flex-1">
                            <div className="font-semibold">Genbrugsplads</div>
                            <div className="text-sm opacity-90">Sådan afleverer du</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-center mt-3 p-3 bg-white/10 rounded-lg">
                          <div className="text-center">
                            <img src={getSortingPictogram(category.recycling).props.src} alt={category.recycling} className="w-16 h-16 mx-auto mb-2 object-contain" />
                            <div className="font-bold">{category.recycling}</div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Simple Sorting Instructions - Only for single items */}
        {(!item.components || item.components.length <= 1) && (
          <div className="space-y-4">
            {/* Home Sorting */}
            <Card className="p-6 bg-success text-success-foreground shadow-strong">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-white/20 rounded-lg mr-3">
                  <Home className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Hjemme sortering</h3>
                  <p className="text-sm opacity-90">Sådan sorterer du hjemme</p>
                </div>
              </div>
              <div className="flex items-center justify-center p-6 bg-white/10 rounded-lg">
                <div className="text-center">
                  {getSortingPictogram(item.homeCategory)}
                  <div className="mt-2 text-lg font-bold">
                    {item.homeCategory}
                  </div>
                </div>
              </div>
            </Card>

            {/* Recycling Center */}
            <Card className="p-6 bg-accent text-accent-foreground shadow-strong">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-white/20 rounded-lg mr-3">
                  <Recycle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Genbrugsplads</h3>
                  <p className="text-sm opacity-90">Sådan afleverer du</p>
                </div>
              </div>
              <div className="flex items-center justify-center p-6 bg-white/10 rounded-lg">
                <div className="text-center">
                  {getSortingPictogram(item.recyclingCategory)}
                  <div className="mt-2 text-lg font-bold">
                    {item.recyclingCategory}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* AI Analysis Process (if available) */}
        {item.aiThoughtProcess && (
          <Card className="p-4 bg-muted/30 border-dashed">
            <div className="flex items-start">
              <Info className="h-4 w-4 mr-2 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">AI Analyse Process:</p>
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
          <Button variant="outline" onClick={onBack} className="flex-1">
            Scan igen
          </Button>
          <Button variant="default" onClick={onHome} className="flex-1">
            Tilbage til start
          </Button>
        </div>
      </div>
    </div>
  );
};