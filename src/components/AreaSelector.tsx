import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Database, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AreaSelectorProps {
  onAreaSelected: (area: string) => void;
}

export const AreaSelector = ({ onAreaSelected }: AreaSelectorProps) => {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Potential area configurations - only shown if database exists
  const potentialAreas = [
    {
      id: 'copenhagen',
      tableName: 'copenhagen',
      name: 'København',
      description: 'Københavns Kommune - Database tilgængelig',
      icon: MapPin,
      color: 'bg-green-500',
      isDemo: false
    },
    {
      id: 'aarhus',
      tableName: 'aarhus',
      name: 'Aarhus',
      description: 'Aarhus Kommune - Database tilgængelig',
      icon: MapPin,
      color: 'bg-purple-500',
      isDemo: false
    },
    {
      id: 'odense',
      tableName: 'odense',
      name: 'Odense',
      description: 'Odense Kommune - Database tilgængelig',
      icon: MapPin,
      color: 'bg-orange-500',
      isDemo: false
    }
  ];

  useEffect(() => {
    checkAvailableTables();
  }, []);

  const checkAvailableTables = async () => {
    const availableAreas = [];
    
    // Check if demo table exists (we know it does from the schema)
    try {
      const { data, error } = await supabase
        .from('demo')
        .select('id')
        .limit(1);
      
      if (!error) {
        // Since only demo table exists, we don't show any city areas
        // All areas will be shown via the Demo button only
      }
    } catch (err) {
      console.log('Demo table check failed');
    }
    
    // No city areas have databases yet, so areas array stays empty
    setAreas([]);
    setIsLoading(false);
  };

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
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Tjekker tilgængelige databaser...</span>
            </div>
          ) : areas.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto bg-muted/20 rounded-full flex items-center justify-center mb-4">
                <Database className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Ingen bydatabaser tilgængelige endnu</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Der er ingen kommunale databaser tilgængelige i øjeblikket. 
                Brug Demo-knappen for at teste systemet.
              </p>
            </div>
          ) : (
            areas.map((area) => {
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
            })
          )}
        </div>

        <Button 
          onClick={handleConfirm}
          disabled={!selectedArea || isLoading}
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