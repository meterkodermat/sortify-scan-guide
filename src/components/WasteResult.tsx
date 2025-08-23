import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Home, Recycle, Info } from "lucide-react";

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
}

interface WasteResultProps {
  item: WasteItem;
  onBack: () => void;
  onHome: () => void;
}

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

        {/* Sorting Instructions */}
        <div className="space-y-4">
          {/* Home Sorting */}
          <Card className="p-6 bg-gradient-card shadow-soft">
            <div className="flex items-center mb-3">
              <Home className="h-5 w-5 mr-2 text-primary" />
              <h3 className="font-semibold">Hjemme sortering</h3>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Kategori:</span>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {item.homeCategory}
              </Badge>
            </div>
          </Card>

          {/* Recycling Center */}
          <Card className="p-6 bg-gradient-card shadow-soft">
            <div className="flex items-center mb-3">
              <Recycle className="h-5 w-5 mr-2 text-accent" />
              <h3 className="font-semibold">Genbrugsplads</h3>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Kategori:</span>
              <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
                {item.recyclingCategory}
              </Badge>
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