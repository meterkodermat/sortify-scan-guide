import { supabase } from "@/integrations/supabase/client";

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

interface VisionLabel {
  description: string;
  score: number;
  translatedText?: string;
  materiale?: string;
  tilstand?: string;
}

interface VisionResponse {
  success: boolean;
  labels?: VisionLabel[];
  error?: string;
}

// Search database for waste item matches
const searchWasteInDatabase = async (searchTerms: string[]): Promise<any[]> => {
  // Create search query for multiple terms
  const searchQuery = searchTerms.join(' | ');
  
  const { data, error } = await supabase
    .from('demo')
    .select('*')
    .or(`navn.ilike.%${searchTerms[0]}%,synonymer.ilike.%${searchTerms[0]}%,variation.ilike.%${searchTerms[0]}%,materiale.ilike.%${searchTerms[0]}%`)
    .limit(10);

  if (error) {
    console.error('Database search error:', error);
    return [];
  }

  return data || [];
};

// Enhanced search with multiple terms
const findBestMatches = async (labels: VisionLabel[]) => {
  const allSearchTerms = labels.flatMap(label => {
    const terms = [label.description];
    if (label.translatedText) terms.push(label.translatedText);
    if (label.materiale) terms.push(label.materiale);
    return terms;
  });

  // Remove duplicates and clean terms
  const uniqueTerms = [...new Set(allSearchTerms)]
    .map(term => term.toLowerCase().trim())
    .filter(term => term.length > 2);

  const matches = await searchWasteInDatabase(uniqueTerms);
  return matches;
};

export const identifyWaste = async (imageData: string): Promise<WasteItem> => {
  try {
    // Step 1: Get vision analysis
    const { data: visionData, error: visionError } = await supabase.functions.invoke('vision-proxy', {
      body: { image: imageData }
    });

    if (visionError || !visionData?.success || !visionData?.labels?.length) {
      throw new Error('Kunne ikke analysere billedet');
    }

    const labels = visionData.labels || [];
    
    if (!labels.length) {
      throw new Error('Ingen komponenter fundet i billedet');
    }

    // Step 2: Search database for matches
    const dbMatches = await findBestMatches(labels);
    
    let bestMatch = null;
    let confidence = 0;

    if (dbMatches.length > 0) {
      // Find best match based on label confidence and database relevance
      bestMatch = dbMatches[0];
      confidence = Math.round(labels[0].score * 100);
    }

    // Step 3: Build result from database or fallback to vision data
    if (bestMatch) {
      // Use database data
      return {
        id: Date.now().toString(),
        name: bestMatch.navn || labels[0].description,
        image: imageData,
        homeCategory: bestMatch.hjem || 'Restaffald',
        recyclingCategory: bestMatch.genbrugsplads || 'Restaffald',
        description: `${bestMatch.variation || bestMatch.navn || labels[0].description}${bestMatch.tilstand ? ` - ${bestMatch.tilstand}` : ''}`,
        confidence: confidence,
        timestamp: new Date(),
        aiThoughtProcess: `Fundet i database: ${bestMatch.navn}. Materiale: ${bestMatch.materiale || 'Ukendt'}`,
        components: labels.length > 1 ? labels.map(label => ({
          genstand: label.description,
          materiale: label.materiale || bestMatch.materiale || 'Ukendt',
          tilstand: label.tilstand
        })) : []
      };
    } else {
      // Fallback to basic categorization from vision data
      const primaryLabel = labels[0];
      const homeCategory = primaryLabel.materiale === 'pap' ? 'Pap' : 
                          primaryLabel.materiale === 'plastik' ? 'Plast' : 
                          primaryLabel.materiale === 'glas' ? 'Glas' : 
                          primaryLabel.materiale === 'metal' ? 'Metal' : 
                          primaryLabel.materiale === 'elektronik' ? 'Restaffald' : 
                          primaryLabel.materiale === 'farligt' ? 'Farligt affald' : 
                          primaryLabel.materiale === 'organisk' ? 'Madaffald' : 
                          primaryLabel.materiale === 'tekstil' ? 'Tekstilaffald' : 'Restaffald';

      const recyclingCategory = primaryLabel.materiale === 'pap' ? 'Pap' : 
                               primaryLabel.materiale === 'plastik' ? 'Hård plast' : 
                               primaryLabel.materiale === 'glas' ? 'Glas' : 
                               primaryLabel.materiale === 'metal' ? 'Metal' : 
                               primaryLabel.materiale === 'elektronik' ? 'Genbrugsstation' : 
                               primaryLabel.materiale === 'farligt' ? 'Farligt affald' : 
                               primaryLabel.materiale === 'organisk' ? 'Ikke muligt' : 
                               primaryLabel.materiale === 'tekstil' ? 'Tekstilaffald' : 'Restaffald';

      return {
        id: Date.now().toString(),
        name: primaryLabel.description,
        image: imageData,
        homeCategory: homeCategory,
        recyclingCategory: recyclingCategory,
        description: primaryLabel.description,
        confidence: Math.round(primaryLabel.score * 100),
        timestamp: new Date(),
        aiThoughtProcess: 'Ikke fundet i database - bruger AI-kategorisering',
        components: labels.length > 1 ? labels.map(label => ({
          genstand: label.description,
          materiale: label.materiale || 'Ukendt',
          tilstand: label.tilstand
        })) : []
      };
    }

  } catch (error) {
    console.error('Waste identification error:', error);
    return {
      id: Date.now().toString(),
      name: 'Analyse fejl',
      image: imageData,
      homeCategory: 'Restaffald',
      recyclingCategory: 'Restaffald',
      description: 'Der opstod en teknisk fejl under analysen.',
      confidence: 0,
      timestamp: new Date(),
      aiThoughtProcess: `Fejl: ${error instanceof Error ? error.message : 'Ukendt fejl'}`
    };
  }
};
