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
}

const getSortingPictogram = (category: string) => {
  const imgClass = "w-16 h-16 object-contain";
  
  const normalizedCategory = category.toLowerCase();
  
  // Handle pant (deposit bottles/cans) - very important category
  if (normalizedCategory.includes('pant')) {
    return <img src={plastImg} alt="Pant" className={imgClass} />;
  }
  
  if (normalizedCategory.includes('karton') || normalizedCategory.includes('mad- & drikke-kartoner')) {
    return <img src={madDrikkeKartonerImg} alt="Mad- & drikke-kartoner" className={imgClass} />;
  }
  
  if (normalizedCategory.includes('pap') && !normalizedCategory.includes('karton')) {
    return <img src={papImg} alt="Pap" className={imgClass} />;
  }
  if (normalizedCategory.includes('papir')) {
    return <img src={papirImg} alt="Papir" className={imgClass} />;
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

export const WasteResult = ({ item, onBack, onHome }: WasteResultProps) => {
  console.log('WasteResult received item:', item);
  console.log('WasteResult received components:', item.components);
  
  // Group identical components to avoid repetition
  const groupedComponents = item.components ? 
    item.components.reduce((groups, component) => {
      const key = `${component.genstand}-${component.materiale}`;
      if (!groups[key]) {
        groups[key] = { ...component, count: 0 };
      }
      groups[key].count++;
      return groups;
    }, {} as Record<string, any>) : {};

  console.log('Grouped components:', groupedComponents);

  const uniqueComponents = Object.values(groupedComponents).filter(
    (component: any) => component.genstand.toLowerCase() !== item.name.toLowerCase()
  );
  
  console.log('After filtering (removed main item):', uniqueComponents);
  console.log('Main item name for comparison:', item.name.toLowerCase());
  
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-start">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        {/* Main Item - Top Section */}
        <Card className="p-8 bg-gradient-card shadow-card text-center border-2 border-primary/20">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-foreground">
              {item.name}
            </h1>
          </div>
        </Card>


        {/* Main Item Sorting Instructions - Only show for single items */}
        {uniqueComponents.length === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Sortering:</h2>
            
            {/* Home Sorting */}
            <Card className="p-4 bg-card border-2 border-muted/50">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-muted/20 rounded-lg">
                  <Home className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Hjemme sortering</h3>
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
        )}

        {/* Individual Components - Only if they exist and are different from main item */}
        {uniqueComponents.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Individuelle komponenter:</h2>
            
            {uniqueComponents.map((component: any, index) => {
              const getMaterialSorting = (materiale: string, genstand: string) => {
                const itemName = genstand.toLowerCase();
                
                // Handle pant (deposit bottles/cans) first - very important category
                if (materiale.toLowerCase() === 'pant' || itemName.includes('pant')) {
                  return { home: 'Pant (returneres i butik)', recycling: 'Pant (returneres i butik)' };
                }
                
                // Special handling for tools and industrial items
                if (itemName.includes('saks') || 
                    itemName.includes('hækkesaks') ||
                    itemName.includes('værktøj') ||
                    itemName.includes('skruetrækker') ||
                    itemName.includes('hammer') ||
                    itemName.includes('tang') ||
                    itemName.includes('kniv') ||
                    itemName.includes('file') ||
                    itemName.includes('save')) {
                  return { home: 'Metal', recycling: 'Metal' };
                }
                
                switch (materiale.toLowerCase()) {
                  case 'pap': return { home: 'Pap', recycling: 'Pap' };
                  case 'plastik': 
                    // Distinguish between hard and soft plastic based on item type
                    if (itemName.includes('net') || 
                        itemName.includes('pose') || 
                        itemName.includes('folie') ||
                        itemName.includes('film') ||
                        itemName.includes('sæk') ||
                        itemName.includes('indpakning') ||
                        itemName.includes('emballage')) {
                      return { home: 'Plast', recycling: 'Blød plast' };
                    } else {
                      return { home: 'Plast', recycling: 'Hård plast' };
                    }
                  case 'glas': return { home: 'Glas', recycling: 'Glas' };
                  case 'metal': return { home: 'Metal', recycling: 'Metal' };
                  case 'organisk':
                  case 'madaffald': return { home: 'Madaffald', recycling: 'Ikke muligt' };
                  case 'farligt': return { home: 'Farligt affald', recycling: 'Farligt affald' };
                  case 'tekstil': return { home: 'Tekstilaffald', recycling: 'Tekstilaffald' };
                  default: return { home: 'Restaffald', recycling: 'Rest efter sortering' };
                }
              };
              
              const sorting = getMaterialSorting(component.materiale, component.genstand);
              const displayName = component.count > 1 ? 
                `${component.genstand} (${component.count} stk.)` : 
                component.genstand;
              
              return (
                <Card key={index} className="p-4 bg-card border border-muted/30">
                  <div className="space-y-3">
                    {/* Component Header */}
                    <div className="text-center pb-2 border-b border-muted/30">
                      <h3 className="text-lg font-semibold text-foreground">
                        {displayName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Materiale: {component.materiale}
                      </p>
                    </div>
                    
                    {/* Component Sorting */}
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3 bg-muted/20 rounded-lg">
                        <Home className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <div className="text-xs text-muted-foreground mb-1">Hjemme</div>
                        <div className="flex flex-col items-center gap-2">
                          {getSortingPictogram(sorting.home)}
                          <span className="text-xs font-medium text-center">{sorting.home}</span>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-muted/20 rounded-lg">
                        <Recycle className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <div className="text-xs text-muted-foreground mb-1">Genbrugsplads</div>
                        <div className="text-sm font-semibold">{sorting.recycling}</div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

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