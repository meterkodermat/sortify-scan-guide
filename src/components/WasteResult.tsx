import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Home, Recycle, Info, Trash2, Package, Zap, Droplets, Leaf } from "lucide-react";

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

const getSortingIcon = (category: string) => {
  const iconClass = "h-12 w-12 mx-auto mb-2";
  
  // Normalize category for matching
  const normalizedCategory = category.toLowerCase();
  
  if (normalizedCategory.includes('pap') || normalizedCategory.includes('karton')) {
    return <Package className={iconClass} />;
  }
  if (normalizedCategory.includes('plast') || normalizedCategory.includes('plastic')) {
    return <Droplets className={iconClass} />;
  }
  if (normalizedCategory.includes('glas')) {
    return <Zap className={iconClass} />;
  }
  if (normalizedCategory.includes('metal')) {
    return <Package className={iconClass} />;
  }
  if (normalizedCategory.includes('mad') || normalizedCategory.includes('organisk') || normalizedCategory.includes('kompost')) {
    return <Leaf className={iconClass} />;
  }
  if (normalizedCategory.includes('farligt') || normalizedCategory.includes('elektronik')) {
    return <Zap className={iconClass} />;
  }
  
  // Default icon for rest/other categories
  return <Trash2 className={iconClass} />;
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
            <h2 className="text-2xl font-bold text-foreground">{item.name}</h2>
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
                    case 'pap': return { home: 'Pap', recycling: 'Pap', variant: 'secondary' };
                    case 'plastik': return { home: 'Plast', recycling: 'Hård plast', variant: 'outline' };
                    case 'glas': return { home: 'Glas', recycling: 'Glas', variant: 'secondary' };
                    case 'metal': return { home: 'Metal', recycling: 'Metal', variant: 'outline' };
                    case 'organisk': return { home: 'Madaffald', recycling: 'Ikke muligt', variant: 'destructive' };
                    case 'farligt': return { home: 'Farligt affald', recycling: 'Farligt affald', variant: 'destructive' };
                    default: return { home: 'Restaffald', recycling: 'Rest efter sortering', variant: 'outline' };
                  }
                };
                
                const category = getMaterialCategory(component.materiale);
                
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {component.genstand}
                        {component.tilstand && (
                          <span className="text-sm text-muted-foreground ml-2">({component.tilstand})</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Hjemme: {category.home} • Genbrugsplads: {category.recycling}
                      </div>
                    </div>
                    <Badge variant={category.variant as any} className="ml-3">
                      {component.materiale}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Sorting Instructions */}
        <div className="space-y-4">
          {/* Home Sorting */}
          <Card className="p-6 bg-gradient-primary text-primary-foreground shadow-strong">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-white/20 rounded-lg mr-3">
                <Home className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Hjemme sortering</h3>
                <p className="text-sm opacity-90">Sådan sorterer du hjemme</p>
              </div>
            </div>
            <div className="flex items-center justify-center p-4 bg-white/10 rounded-lg">
              <div className="text-center">
                {getSortingIcon(item.homeCategory)}
                <div className="mt-2 text-lg font-bold">
                  {item.homeCategory}
                </div>
              </div>
            </div>
          </Card>

          {/* Recycling Center */}
          <Card className="p-6 bg-gradient-accent text-accent-foreground shadow-strong">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-white/20 rounded-lg mr-3">
                <Recycle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Genbrugsplads</h3>
                <p className="text-sm opacity-90">Sådan afleverer du</p>
              </div>
            </div>
            <div className="flex items-center justify-center p-4 bg-white/10 rounded-lg">
              <div className="text-center">
                {getSortingIcon(item.recyclingCategory)}
                <div className="mt-2 text-lg font-bold">
                  {item.recyclingCategory}
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