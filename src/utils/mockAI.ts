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

// Search database for waste item matches with comprehensive search
const searchWasteInDatabase = async (searchTerms: string[]): Promise<any[]> => {
  if (!searchTerms.length) return [];

  try {
    // Search for each term across all relevant fields
    const searchPromises = searchTerms.map(async (term) => {
      const cleanTerm = term.toLowerCase().trim();
      if (cleanTerm.length < 2) return [];

      const { data, error } = await supabase
        .from('demo')
        .select('*')
        .or(`navn.ilike.%${cleanTerm}%,synonymer.ilike.%${cleanTerm}%,variation.ilike.%${cleanTerm}%,materiale.ilike.%${cleanTerm}%`)
        .limit(20);

      if (error) {
        console.error('Database search error for term:', cleanTerm, error);
        return [];
      }

      return data || [];
    });

    const allResults = await Promise.all(searchPromises);
    const flatResults = allResults.flat();
    
    // Remove duplicates and score results
    const uniqueResults = Array.from(
      new Map(flatResults.map(item => [item.id, item])).values()
    );

    // Sort by relevance - exact name matches first, then synonyms, then variations
    return uniqueResults.sort((a, b) => {
      const aExactMatch = searchTerms.some(term => 
        term && a.navn && a.navn.toLowerCase().includes(term.toLowerCase())
      );
      const bExactMatch = searchTerms.some(term => 
        term && b.navn && b.navn.toLowerCase().includes(term.toLowerCase())
      );

      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;
      return 0;
    }).slice(0, 5); // Top 5 results

  } catch (error) {
    console.error('Database search error:', error);
    return [];
  }
};

// Enhanced search with multiple terms
const findBestMatches = async (labels: VisionLabel[]) => {
  console.log('Labels from Gemini:', labels);
  
  const allSearchTerms = labels.flatMap(label => {
    const terms = [];
    if (label.description) terms.push(label.description);
    if (label.translatedText) terms.push(label.translatedText);
    
    // Don't search by material type alone as it's too broad
    // Only use material if we have a specific object name
    if (label.materiale && label.description) {
      terms.push(`${label.description} ${label.materiale}`);
    }
    return terms;
  });

  console.log('Search terms:', allSearchTerms);

  // Remove duplicates and clean terms
  const uniqueTerms = [...new Set(allSearchTerms)]
    .filter(term => term && typeof term === 'string')
    .map(term => term.toLowerCase().trim())
    .filter(term => term.length > 2);

  const matches = await searchWasteInDatabase(uniqueTerms);
  return matches;
};

export const identifyWaste = async (imageData: string): Promise<WasteItem> => {
  try {
    console.log('Starting waste identification...');
    
    // Step 1: Get vision analysis
    const { data: visionData, error: visionError } = await supabase.functions.invoke('vision-proxy', {
      body: { image: imageData }
    });

    console.log('Vision data received:', visionData);
    console.log('Vision error:', visionError);

    if (visionError) {
      throw new Error(`Gemini API fejl: ${visionError.message || 'Ukendt fejl'}`);
    }

    if (!visionData?.success) {
      throw new Error(`Analyse fejlede: ${visionData?.error || 'Ukendt fejl'}`);
    }

    const labels = visionData.labels || [];
    console.log('Parsed labels:', labels);
    
    if (!labels.length) {
      throw new Error('Ingen komponenter fundet i billedet');
    }

    // Step 2: Search database for matches
    const dbMatches = await findBestMatches(labels);
    console.log('Database matches found:', dbMatches.length);
    
    let bestMatch = null;
    let confidence = 0;

    if (dbMatches.length > 0) {
      // Find best match based on label confidence and database relevance
      bestMatch = dbMatches[0];
      confidence = Math.round(labels[0].score * 100);
      console.log('Using database match:', bestMatch.navn);
    } else {
      console.log('No database matches found, using AI categorization');
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
