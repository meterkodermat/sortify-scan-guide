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
    hjem: string;
    genbrugsplads: string;
  }>;
}

interface VisionLabel {
  description: string;
  score: number;
  translatedText?: string;
  materiale?: string;
  tilstand?: string;
  navne?: string[];
  confidence?: number;
}

interface VisionResponse {
  success: boolean;
  labels?: VisionLabel[];
  error?: string;
}

// Enhanced database search with better Danish character handling and sensitivity
const searchWasteInDatabase = async (searchTerms: string[]): Promise<any[]> => {
  console.log('🔍 searchWasteInDatabase called with terms:', searchTerms);
  
  if (!searchTerms.length) {
    console.log('❌ No search terms provided');
    return [];
  }

  try {
    console.log(`🔍 Database search with ${searchTerms.length} terms`);
    
    // Limit search terms to most relevant ones to improve performance
    const limitedTerms = searchTerms.slice(0, 3);
    const allResults = [];
      
    for (const term of limitedTerms) {
      const cleanTerm = term.toLowerCase().trim();
      if (cleanTerm.length < 2) continue;

      console.log(`🔍 Searching database for term: "${cleanTerm}"`);

      // Prioritize exact matches first for better performance
      const { data, error } = await supabase
        .from('demo')
        .select('*')
        .or(`navn.ilike.${cleanTerm},navn.ilike.%${cleanTerm}%,synonymer.ilike.%${cleanTerm}%`)
        .limit(10);

      if (error) {
        console.error(`❌ Database error for term "${cleanTerm}":`, error);
        continue;
      }

      if (data?.length) {
        console.log(`✅ Found ${data.length} matches for "${cleanTerm}":`, data.map(d => `${d.navn} (${d.hjem})`));
        allResults.push(...data);
      } else {
        console.log(`❌ No matches found for term: "${cleanTerm}"`);
      }
    }
    
    // Remove duplicates by id and limit total results
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    ).slice(0, 15); // Limit to 15 results max for performance

    console.log(`🎯 Total unique results: ${uniqueResults.length}`);

    // Simplified scoring for better performance
    return uniqueResults.sort((a, b) => {
      let aScore = 0, bScore = 0;
      
      // Only use first search term for scoring to improve performance
      const primaryTerm = searchTerms[0]?.toLowerCase() || '';
      if (!primaryTerm) return 0;
      
      console.log(`🎯 Scoring results for primary term: "${primaryTerm}"`);
      
      // Exact name match (highest priority)
      if (a.navn?.toLowerCase() === primaryTerm) aScore += 1000;
      if (b.navn?.toLowerCase() === primaryTerm) bScore += 1000;
      
      // Name contains term (lower priority for partial matches)
      if (a.navn?.toLowerCase().includes(primaryTerm)) aScore += 300;
      if (b.navn?.toLowerCase().includes(primaryTerm)) bScore += 300;
      
      // Synonym match
      if (a.synonymer?.toLowerCase().includes(primaryTerm)) aScore += 300;
      if (b.synonymer?.toLowerCase().includes(primaryTerm)) bScore += 300;
      
      const finalScore = bScore - aScore;
      console.log(`📊 Final scores: ${a.navn}: ${aScore}, ${b.navn}: ${bScore} (diff: ${finalScore})`);
      return finalScore;
    }).slice(0, 8); // Limit to 8 results for better performance

  } catch (error) {
    console.error('Database search error:', error.message);
    return [];
  }
};

// Function to map material to sorting categories
const getMaterialSorting = (materiale: string, description?: string): { hjem: string; genbrugsplads: string } => {
  const material = materiale.toLowerCase();
  const desc = description?.toLowerCase() || '';
  
  console.log('getMaterialSorting called with:', { materiale, description, material, desc });
  
  if (material.includes('elektronik') || material.includes('elektronisk')) {
    console.log('✅ Matched electronic material, returning Farligt affald');
    return { hjem: 'Farligt affald', genbrugsplads: 'Genbrugsstation - elektronik' };
  } else if (material.includes('plastik') || material.includes('plast')) {
    console.log('✅ Matched plastic material, returning Plast');
    return { hjem: 'Plast', genbrugsplads: 'Genbrugsstation - hård plast' };
  } else if (material.includes('metal') || material.includes('stål') || material.includes('aluminium')) {
    console.log('✅ Matched metal material, returning Metal');
    return { hjem: 'Metal', genbrugsplads: 'Genbrugsstation - metal' };
  } else if (material.includes('glas')) {
    console.log('✅ Matched glass material, returning Glas');
    return { hjem: 'Glas', genbrugsplads: 'Genbrugsstation - glas' };
  } else if (material.includes('papir')) {
    console.log('✅ Matched papir material, returning Papir');
    return { hjem: 'Papir', genbrugsplads: 'Genbrugsstation - pap og papir' };  
  } else if (material.includes('pap') || material.includes('karton')) {
    console.log('✅ Matched pap/karton material, returning Pap');
    return { hjem: 'Pap', genbrugsplads: 'Genbrugsstation - pap og papir' };
  } else if (material.includes('tekstil') || material.includes('tøj')) {
    console.log('✅ Matched textile material, returning Tekstilaffald');
    return { hjem: 'Tekstilaffald', genbrugsplads: 'Genbrugsstation - tekstil' };
  } else if (material.includes('organisk') || material.includes('mad')) {
    console.log('✅ Matched organic material, returning Madaffald');
    return { hjem: 'Madaffald', genbrugsplads: 'Genbrugsstation - organisk affald' };
  } else {
    console.log('❌ No match found, returning Restaffald');
    return { hjem: 'Restaffald', genbrugsplads: 'Genbrugsstation - restaffald' };
  }
};

// Get icon for waste category
const getIconForCategory = (category: string): string => {
  const categoryMap: { [key: string]: string } = {
    "Pap": "/src/assets/pap.png",
    "Papir": "/src/assets/papir.png", 
    "Plast": "/src/assets/plast.png",
    "Metal": "/src/assets/metal.png",
    "Glas": "/src/assets/glas.png",
    "Madaffald": "/src/assets/madaffald.png",
    "Tekstilaffald": "/src/assets/tekstilaftald.png",
    "Farligt affald": "/src/assets/farligtaffald.png",
    "Restaffald": "/src/assets/restaffald.png"
  };

  return categoryMap[category] || "/src/assets/restaffald.png";
};

export const identifyWaste = async (imageData: string): Promise<WasteItem> => {
  try {
    console.log('🚀 Starting simple waste identification...');
    
    // Call the vision-proxy edge function for AI analysis
    const { data, error } = await supabase.functions.invoke('vision-proxy', {
      body: { image: imageData }
    });

    if (error) {
      console.error('❌ Vision proxy error:', error);
      throw error;
    }

    console.log('✅ Gemini labels:', data.labels);

    if (data?.labels && data.labels.length > 0) {
      // Simple approach: take top labels and search database directly
      const searchTerms = data.labels
        .slice(0, 3) // Top 3 labels
        .map(label => label.description)
        .filter(desc => desc && desc.length > 1);
      
      console.log('🔍 Searching database with terms:', searchTerms);
      
      const matches = await searchWasteInDatabase(searchTerms);
      
      if (matches.length > 0) {
        const bestMatch = matches[0];
        console.log('✅ Using database result:', bestMatch.navn, '->', bestMatch.hjem);
        
        // Filter out generic/broad matches when we have more specific alternatives
        if (bestMatch.navn.toLowerCase() === 'bonpapir' && searchTerms.some(term => 
          term.toLowerCase().includes('gave') || 
          term.toLowerCase().includes('gift') || 
          term.toLowerCase().includes('wrapping')
        )) {
          console.log('🔍 Bonpapir detected, looking for more specific match...');
          const specificMatch = matches.find(match => 
            match.navn.toLowerCase().includes('gave') ||
            match.navn.toLowerCase().includes('papir') && match.navn.toLowerCase() !== 'bonpapir'
          );
          if (specificMatch) {
            console.log('✅ Found more specific match:', specificMatch.navn);
            return {
              id: Math.random().toString(),
              name: specificMatch.navn,
              image: getIconForCategory(specificMatch.hjem || ""),
              homeCategory: specificMatch.hjem || "Restaffald",
              recyclingCategory: specificMatch.genbrugsplads || "Genbrugsstation - generelt affald",
              description: `Identificeret ved hjælp af AI-analyse. ${specificMatch.variation ? `Variation: ${specificMatch.variation}. ` : ''}${specificMatch.tilstand ? `Tilstand: ${specificMatch.tilstand}. ` : ''}Sortér som angivet eller kontakt din lokale genbrugsstation for specifik vejledning.`,
              confidence: data.labels[0]?.score || 0.8,
              timestamp: new Date(),
              aiThoughtProcess: data.thoughtProcess
            };
          }
        }
        
        return {
          id: Math.random().toString(),
          name: bestMatch.navn,
          image: getIconForCategory(bestMatch.hjem || ""),
          homeCategory: bestMatch.hjem || "Restaffald",
          recyclingCategory: bestMatch.genbrugsplads || "Genbrugsstation - generelt affald",
          description: `Identificeret ved hjælp af AI-analyse. ${bestMatch.variation ? `Variation: ${bestMatch.variation}. ` : ''}${bestMatch.tilstand ? `Tilstand: ${bestMatch.tilstand}. ` : ''}Sortér som angivet eller kontakt din lokale genbrugsstation for specifik vejledning.`,
          confidence: data.labels[0]?.score || 0.8,
          timestamp: new Date(),
          aiThoughtProcess: data.thoughtProcess
        };
      }
    }
    
    // Fallback if no matches found
    console.log('❌ No database matches found - returning fallback result');
    
    return {
      id: Math.random().toString(),
      name: "Genstand ikke fundet i database", 
      image: getIconForCategory("Restaffald"),
      homeCategory: "Restaffald",
      recyclingCategory: "Genbrugsstation - generelt affald",
      description: "Genstanden kunne ikke identificeres i vores database. Sortér som restaffald eller kontakt din lokale genbrugsstation for vejledning.",
      confidence: 0,
      timestamp: new Date(),
    };

  } catch (error) {
    console.error('❌ Error in identifyWaste:', error);
    return {
      id: Math.random().toString(),
      name: "Genstand ikke fundet i database",
      image: getIconForCategory("Restaffald"),
      homeCategory: "Restaffald",  
      recyclingCategory: "Genbrugsstation - generelt affald",
      description: "Der opstod en fejl under analysen. Sortér som restaffald eller kontakt din lokale genbrugsstation for vejledning.",
      confidence: 0,
      timestamp: new Date(),
    };
  }
};