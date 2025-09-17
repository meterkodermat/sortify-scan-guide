import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Import pictograms
import farligtAffaldIcon from "@/assets/farligtaffald.png";
import glasIcon from "@/assets/glas.png";
import madDrikkeKartonerIcon from "@/assets/mad-drikke-kartoner.png";
import madaffaldsIcon from "@/assets/madaffald.png";
import metalIcon from "@/assets/metal.png";
import papIcon from "@/assets/pap.png";
import papirIcon from "@/assets/papir.png";
import plastIcon from "@/assets/plast.png";
import restaffaldsIcon from "@/assets/restaffald.png";
import tekstilaffaldsIcon from "@/assets/tekstilaftald.png";

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

interface DatabaseItem {
  id: number;
  navn: string;
  synonymer?: string;
  variation?: string;
  materiale?: string;
  hjem?: string;
  genbrugsplads?: string;
}

interface SearchModeProps {
  onBack: () => void;
  onResult: (item: WasteItem) => void;
}

const getIconForCategory = (category: string): string => {
  const categoryLower = category?.toLowerCase() || '';
  
  if (categoryLower.includes('farligt')) return farligtAffaldIcon;
  if (categoryLower.includes('glas')) return glasIcon;
  if (categoryLower.includes('mad') && categoryLower.includes('kartoner')) return madDrikkeKartonerIcon;
  if (categoryLower.includes('madaffald') || categoryLower.includes('organisk')) return madaffaldsIcon;
  if (categoryLower.includes('metal')) return metalIcon;
  if (categoryLower.includes('pap') && !categoryLower.includes('papir')) return papIcon;
  if (categoryLower.includes('papir')) return papirIcon;
  if (categoryLower.includes('plast')) return plastIcon;
  if (categoryLower.includes('tekstil')) return tekstilaffaldsIcon;
  return restaffaldsIcon; // Default to restaffald
};

export const SearchMode = ({ onBack, onResult }: SearchModeProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<DatabaseItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const searchDatabase = async (term: string) => {
    if (!term || term.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('demo')
        .select('*')
        .or(`navn.ilike.%${term}%,synonymer.ilike.%${term}%,variation.ilike.%${term}%,materiale.ilike.%${term}%`)
        .limit(10);

      if (error) {
        console.error('Database search error:', error);
        toast.error('Søgefejl. Prøv igen.');
        return;
      }

      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Søgefejl. Prøv igen.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Debounce search to avoid excessive database calls
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchDatabase(value);
    }, 300);
  };

  const handleSelectItem = (item: DatabaseItem) => {
    // Fix orange categorization - oranges should go in food waste
    let homeCategory = item.hjem || 'Restaffald';
    let recyclingCategory = item.genbrugsplads || 'Restaffald';
    
    // Special handling for oranges and other organic items
    const itemName = item.navn?.toLowerCase() || '';
    if (itemName.includes('appelsin') || itemName.includes('citrus') || itemName.includes('frugt')) {
      homeCategory = 'Madaffald';
      recyclingCategory = 'Ikke muligt';
    }

    const result: WasteItem = {
      id: Date.now().toString(),
      name: item.navn,
      image: getIconForCategory(homeCategory),
      homeCategory,
      recyclingCategory,
      description: item.variation || item.navn,
      confidence: 100, // Database results are 100% certain
      timestamp: new Date(),
    };

    // Stay in search mode, don't navigate away
    onResult(result);
  };


  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-5 w-5 mr-2" />
            Tilbage
          </Button>
        </div>

        {/* Search Input */}
        <Card className="p-6 bg-gradient-card shadow-card">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Søg efter affald</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="F.eks. plastikflaske, æg, mobiltelefon..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-10"
                disabled={isSearching}
              />
            </div>
          </div>
        </Card>

        {/* Search Results */}
        {isSearching && (
          <Card className="p-6 bg-gradient-card shadow-card">
            <div className="text-center text-muted-foreground">
              Søger...
            </div>
          </Card>
        )}

        {searchResults.length > 0 && (
          <Card className="p-6 bg-gradient-card shadow-card">
            <h3 className="font-semibold mb-4">Søgeresultater ({searchResults.length})</h3>
            <div className="space-y-3">
              {searchResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className="p-4 border rounded-lg cursor-pointer hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <img 
                          src={getIconForCategory(item.hjem || 'Restaffald')} 
                          alt={item.hjem || 'Restaffald'} 
                          className="w-10 h-10 object-contain"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{item.navn}</h4>
                          {item.variation && item.variation !== item.navn && (
                            <p className="text-sm text-muted-foreground">{item.variation}</p>
                          )}
                          {item.materiale && (
                            <Badge variant="secondary" className="mt-1">
                              {item.materiale}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div>{item.hjem || 'Restaffald'}</div>
                      </div>
                    </div>
                  </div>
              ))}
            </div>
          </Card>
        )}

        {!isSearching && searchTerm && searchResults.length === 0 && searchTerm.length >= 2 && (
          <Card className="p-6 bg-gradient-card shadow-card">
            <div className="text-center text-muted-foreground">
              <p>Ingen resultater fundet for "{searchTerm}"</p>
              <p className="text-sm mt-1">Prøv andre søgetermer</p>
            </div>
          </Card>
        )}

        {/* Instructions */}
        <Card className="p-4 bg-muted/30 border-dashed">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">Sådan bruger du søgning:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Søg efter genstandens navn eller materiale</li>
              <li>Vælg det rigtige resultat fra listen</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};