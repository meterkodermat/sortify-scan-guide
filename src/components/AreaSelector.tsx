import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Database, Users } from "lucide-react";

interface AreaSelectorProps {
  onAreaSelected: (area: string) => void;
}

export const AreaSelector = ({ onAreaSelected }: AreaSelectorProps) => {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  // Only areas with supporting databases
  const areas = [
    {
      id: 'copenhagen',
      name: 'København',
      description: 'Københavns Kommune - Database tilgængelig',
      icon: MapPin,
      color: 'bg-green-500',
      isDemo: false
    }
  ];

  const handleAreaSelect = (areaId: string) => {
    setSelectedArea(areaId);
  };

  const handleConfirm = () => {
    if (selectedArea) {
      onAreaSelected(selectedArea);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4 relative">
      {/* Demo button in corner */}
      <Button
        variant="outline"
        onClick={() => onAreaSelected('demo')}
        className="absolute top-4 right-4 flex items-center gap-2"
      >
        <Database className="h-4 w-4" />
        Demo
      </Button>

      <Card className="w-full max-w-md p-8 bg-gradient-card shadow-strong">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gradient-primary rounded-full flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Vælg område</h1>
          <p className="text-muted-foreground">
            Vælg dit lokalområde for at få korrekte sorteringsregler
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {areas.map((area) => {
            const IconComponent = area.icon;
            const isSelected = selectedArea === area.id;
            
            return (
              <div
                key={area.id}
                onClick={() => handleAreaSelect(area.id)}
                className={`
                  p-4 border-2 rounded-lg cursor-pointer transition-all duration-200
                  ${isSelected 
                    ? 'border-primary bg-primary/10 shadow-md' 
                    : 'border-border hover:border-primary/50 hover:bg-muted/20'
                  }
                `}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full ${area.color} flex items-center justify-center`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-foreground">{area.name}</h3>
                      {area.isDemo && (
                        <Badge variant="secondary" className="text-xs">
                          Demo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{area.description}</p>
                  </div>
                  {isSelected && (
                    <div className="text-primary">
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Button 
          onClick={handleConfirm}
          disabled={!selectedArea}
          className="w-full"
          size="lg"
        >
          Fortsæt til Sortify
        </Button>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Du kan altid ændre område senere i indstillinger
          </p>
        </div>
      </Card>
    </div>
  );
};