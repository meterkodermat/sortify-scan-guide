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
  navne?: string[];
  confidence?: number;
}

interface VisionResponse {
  success: boolean;
  labels?: VisionLabel[];
  error?: string;
}

// Normalize Danish characters for better search matching
const normalizeDanishText = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/å/g, 'aa')
    .replace(/ø/g, 'oe') 
    .replace(/æ/g, 'ae')
    .trim();
};

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

      // Prioritize exact matches first for better performance
      const { data, error } = await supabase
        .from('demo')
        .select('*')
        .or(`navn.ilike.${cleanTerm},navn.ilike.%${cleanTerm}%,synonymer.ilike.%${cleanTerm}%`)
        .limit(10);

      if (!error && data?.length) {
        console.log(`✅ Found ${data.length} matches for "${cleanTerm}"`);
        allResults.push(...data);
      }
    }
    
    // Remove duplicates by id and limit total results
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    ).slice(0, 15); // Limit to 15 results max for performance

    console.log(`🎯 Total results: ${uniqueResults.length}`);

    // Simplified scoring for better performance
    return uniqueResults.sort((a, b) => {
      let aScore = 0, bScore = 0;
      
      // Only use first search term for scoring to improve performance
      const primaryTerm = searchTerms[0]?.toLowerCase() || '';
      if (!primaryTerm) return 0;
      
      // Exact name match (highest priority)
      if (a.navn?.toLowerCase() === primaryTerm) aScore += 1000;
      if (b.navn?.toLowerCase() === primaryTerm) bScore += 1000;
      
      // Name contains term
      if (a.navn?.toLowerCase().includes(primaryTerm)) aScore += 500;
      if (b.navn?.toLowerCase().includes(primaryTerm)) bScore += 500;
      
      // Synonym match
      if (a.synonymer?.toLowerCase().includes(primaryTerm)) aScore += 300;
      if (b.synonymer?.toLowerCase().includes(primaryTerm)) bScore += 300;
      
      return bScore - aScore;
    }).slice(0, 8); // Limit to 8 results for better performance

  } catch (error) {
    console.error('Database search error:', error.message);
    return [];
  }
};

// Enhanced search with smarter term extraction and filtering
const findBestMatches = async (labels: VisionLabel[]) => {
  console.log('🔍 Processing Gemini labels:', labels);
  
  // Filter out liquid contents and focus on physical items
  const filteredLabels = labels.filter(label => {
    const desc = label.description?.toLowerCase() || '';
    // Skip liquid contents like juice, milk, etc.
    if (desc.includes('juice') && !desc.includes('karton') && !desc.includes('beholder')) {
      console.log('⚠️ Skipping liquid content:', label.description);
      return false;
    }
    if (['mælk', 'vand', 'øl', 'sodavand'].some(liquid => desc.includes(liquid)) && 
        !desc.includes('karton') && !desc.includes('flaske') && !desc.includes('dåse')) {
      console.log('⚠️ Skipping liquid content:', label.description);
      return false;
    }
    return true;
  });

  console.log('🎯 Filtered labels (excluding liquids):', filteredLabels.map(l => l.description));
  
  // Extract main search terms with smart mapping
  const searchTerms = [];
  
  for (const label of filteredLabels) {
    let searchTerm = label.description;
    
    // Smart mapping for common items
    if (searchTerm?.toLowerCase().includes('juicekarton')) {
      searchTerms.push('juicekarton');
      searchTerms.push('drikkekarton');
      searchTerms.push('kartoner');
    } else if (searchTerm) {
      searchTerms.push(searchTerm);
    }
    
    // Add translated text if different
    if (label.translatedText && label.translatedText !== label.description) {
      searchTerms.push(label.translatedText);
    }
    
    // Add material only for specific cases
    if (label.materiale && ['plastik', 'pap', 'glas', 'metal'].includes(label.materiale)) {
      searchTerms.push(label.materiale);
    }
  }

  // Clean and deduplicate terms
  const cleanTerms = [...new Set(searchTerms)]
    .filter(term => {
      if (!term || typeof term !== 'string') return false;
      const cleaned = term.toLowerCase().trim();
      if (cleaned.length < 2) return false;
      return true;
    })
    .map(term => term.toLowerCase().trim());

  console.log('🎯 Smart search terms:', cleanTerms);

  if (cleanTerms.length === 0) {
    console.log('❌ No valid search terms found');
    return [];
  }

  const matches = await searchWasteInDatabase(cleanTerms);
  console.log(`✅ Found ${matches.length} database matches`);
  
  return matches;
};

export const identifyWaste = async (imageData: string): Promise<WasteItem> => {
  try {
    console.log('🚀 Starting waste identification process...');
    
    // Call the vision-proxy edge function for AI analysis
    console.log('🤖 Calling vision-proxy for AI analysis...');
    
    const { data, error } = await supabase.functions.invoke('vision-proxy', {
      body: { image: imageData }
    });

    if (error) {
      console.error('❌ Vision proxy error:', error);
      throw error;
    }

    console.log('✅ Vision proxy response:', data);

    if (data?.labels && data.labels.length > 0) {
      console.log('🔍 Processing AI labels:', data.labels);
      
      // Find matches in database
      const matches = await findBestMatches(data.labels);
      
      if (matches.length > 0) {
        const bestMatch = matches[0];
        console.log('✅ Found database match:', bestMatch.navn);
        
        // Count physical items (excluding liquids)
        const physicalItems = data.labels.filter(label => {
          const desc = label.description?.toLowerCase() || '';
          return !(['juice', 'mælk', 'vand', 'øl', 'sodavand'].some(liquid => 
            desc.includes(liquid) && !desc.includes('karton') && !desc.includes('flaske') && !desc.includes('dåse')
          ));
        });

        const itemName = physicalItems.length > 1 ? 
          `Flere elementer fundet - primært ${bestMatch.navn}` : 
          bestMatch.navn;
        
        return {
          id: Math.random().toString(),
          name: itemName,
          image: "",
          homeCategory: bestMatch.hjem || "Restaffald",
          recyclingCategory: bestMatch.genbrugsplads || "Genbrugsstation - generelt affald",
          description: `Identificeret ved hjælp af AI-analyse. ${bestMatch.variation ? `Variation: ${bestMatch.variation}. ` : ''}Sortér som angivet eller kontakt din lokale genbrugsstation for specifik vejledning.`,
          confidence: data.labels[0]?.score || 0.8,
          timestamp: new Date(),
          aiThoughtProcess: data.thoughtProcess,
          components: physicalItems.map((label: VisionLabel) => ({
            genstand: label.description,
            materiale: label.materiale || '',
            tilstand: label.tilstand || ''
          }))
        };
      } else {
        // No database match found, try simpler analysis
        console.log('🔄 No database match found, trying simpler analysis...');
        
        const { data: simpleData, error: simpleError } = await supabase.functions.invoke('vision-proxy', {
          body: { image: imageData, simple: true }
        });

        if (!simpleError && simpleData?.labels && simpleData.labels.length > 0) {
          console.log('🔍 Processing simple AI labels:', simpleData.labels);
          
          const simpleMatches = await findBestMatches(simpleData.labels);
          
          if (simpleMatches.length > 0) {
            const bestMatch = simpleMatches[0];
            console.log('✅ Found database match with simple analysis:', bestMatch.navn);
            
            // Count physical items (excluding liquids)
            const physicalItems = simpleData.labels.filter(label => {
              const desc = label.description?.toLowerCase() || '';
              return !(['juice', 'mælk', 'vand', 'øl', 'sodavand'].some(liquid => 
                desc.includes(liquid) && !desc.includes('karton') && !desc.includes('flaske') && !desc.includes('dåse')
              ));
            });

            const itemName = physicalItems.length > 1 ? 
              `Flere elementer fundet - primært ${bestMatch.navn}` : 
              bestMatch.navn;
            
            return {
              id: Math.random().toString(),
              name: itemName,
              image: "",
              homeCategory: bestMatch.hjem || "Restaffald",
              recyclingCategory: bestMatch.genbrugsplads || "Genbrugsstation - generelt affald",
              description: `Identificeret ved hjælp af forenklet AI-analyse. ${bestMatch.variation ? `Variation: ${bestMatch.variation}. ` : ''}Sortér som angivet eller kontakt din lokale genbrugsstation for specifik vejledning.`,
              confidence: (simpleData.labels[0]?.score || 0.6) * 0.9, // Slightly lower confidence for simple analysis
              timestamp: new Date(),
              aiThoughtProcess: simpleData.thoughtProcess,
              components: physicalItems.map((label: VisionLabel) => ({
                genstand: label.description,
                materiale: label.materiale || '',
                tilstand: label.tilstand || ''
              }))
            };
          }
        }

        // Still no match, return original AI result
        const primaryLabel = data.labels[0];
        console.log('🤖 No database match found with simple analysis either, returning AI detection:', primaryLabel.description);
        
        return {
          id: Math.random().toString(),
          name: primaryLabel.description,
          image: "",
          homeCategory: "Restaffald",
          recyclingCategory: "Genbrugsstation - generelt affald",
          description: `Genstanden "${primaryLabel.description}" kunne ikke identificeres i vores database. Sortér som restaffald eller kontakt din lokale genbrugsstation for vejledning.`,
          confidence: 0.3,
          timestamp: new Date(),
          aiThoughtProcess: data.thoughtProcess,
          components: data.labels.map((label: VisionLabel) => ({
            genstand: label.description,
            materiale: label.materiale || '',
            tilstand: label.tilstand || ''
          }))
        };
      }
    }
    
    // Fallback if no matches found
    console.log('❌ No database matches found - returning fallback result');
    
    return {
      id: Math.random().toString(),
      name: "Genstand ikke fundet i database", 
      image: "",
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
      image: "",
      homeCategory: "Restaffald",  
      recyclingCategory: "Genbrugsstation - generelt affald",
      description: "Der opstod en fejl under analysen. Sortér som restaffald eller kontakt din lokale genbrugsstation for vejledning.",
      confidence: 0,
      timestamp: new Date(),
    };
  }
};
