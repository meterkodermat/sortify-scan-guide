import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { identifyWaste } from "@/utils/mockAI";
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

export const SearchMode = ({ onBack, onResult }: SearchModeProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<DatabaseItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

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
    searchDatabase(value);
  };

  const handleSelectItem = (item: DatabaseItem) => {
    const result: WasteItem = {
      id: Date.now().toString(),
      name: item.navn,
      image: '', // No image for database searches
      homeCategory: item.hjem || 'Restaffald',
      recyclingCategory: item.genbrugsplads || 'Restaffald',
      description: item.variation || item.navn,
      confidence: 100, // Database results are 100% certain
      timestamp: new Date(),
    };

    onResult(result);
  };

  const getAiSuggestion = async () => {
    if (!searchTerm || searchTerm.length < 2) {
      toast.error('Indtast mindst 2 tegn for AI-forslag');
      return;
    }

    setIsAiSuggesting(true);
    try {
      // Create a mock image data URL for the AI to work with text
      const mockImageData = `data:text/plain;base64,${btoa(searchTerm)}`;
      const result = await identifyWaste(mockImageData);
      
      // Update the result to indicate it's an AI suggestion
      result.name = `AI forslag: ${result.name}`;
      result.confidence = Math.max(50, result.confidence); // AI suggestions are less certain
      
      onResult(result);
      toast.success('AI forslag genereret!');
    } catch (error) {
      console.error('AI suggestion error:', error);
      toast.error('Kunne ikke generere AI forslag. Prøv igen.');
    } finally {
      setIsAiSuggesting(false);
    }
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
                disabled={isSearching || isAiSuggesting}
              />
            </div>
            
            {/* AI Suggestion Button */}
            <Button 
              onClick={getAiSuggestion}
              disabled={!searchTerm || searchTerm.length < 2 || isAiSuggesting || isSearching}
              variant="outline"
              className="w-full"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {isAiSuggesting ? 'Genererer AI forslag...' : 'Få AI forslag'}
            </Button>
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
              <p className="text-sm mt-1">Prøv AI forslag eller søg efter andre termer</p>
            </div>
          </Card>
        )}

        {/* Instructions */}
        <Card className="p-4 bg-muted/30 border-dashed">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">Sådan bruger du søgning:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Standard søgning viser kun resultater fra databasen</li>
              <li>Klik "AI forslag" for at få AI's bud på sortering</li>
              <li>Søg efter genstandens navn eller materiale</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};