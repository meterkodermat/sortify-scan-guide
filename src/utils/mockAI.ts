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
    console.log(`🔍 Database search starting with ${searchTerms.length} terms:`, searchTerms);
    console.log(`🔍 DETAILED SEARCH TERMS:`, searchTerms.map((term, i) => `${i+1}. "${term}"`));
    
    // Create search queries for each term with better SQL patterns
    const allResults = [];
      
    for (const term of searchTerms) {
      const cleanTerm = term.toLowerCase().trim();
      if (cleanTerm.length < 2) {
        console.log(`⚠️ Skipping short term: "${cleanTerm}"`);
        continue;
      }

      // Create normalized version for Danish character matching
      const normalizedTerm = normalizeDanishText(cleanTerm);
      
      // Multi-stage search for maximum sensitivity
      const searchQueries = [
        // Exact match (highest priority)
        `navn.ilike.${cleanTerm},synonymer.ilike.${cleanTerm}`,
        // Partial match with original term  
        `navn.ilike.%${cleanTerm}%,synonymer.ilike.%${cleanTerm}%,variation.ilike.%${cleanTerm}%,materiale.ilike.%${cleanTerm}%`,
        // Normalized Danish character search
        `navn.ilike.%${normalizedTerm}%,synonymer.ilike.%${normalizedTerm}%,variation.ilike.%${normalizedTerm}%`,
        // Core word extraction (remove common prefixes/suffixes)
        `navn.ilike.%${cleanTerm.replace(/affald|genstand|materiale/, '')}%`
      ];

      for (const query of searchQueries) {
        if (query.includes('undefined') || query.includes('%%')) continue;
        
        console.log(`🔍 Executing enhanced query: ${query}`);
        const { data, error } = await supabase
          .from('demo')
          .select('*')
          .or(query)
          .limit(15);

        if (!error && data?.length) {
          console.log(`✅ Found ${data.length} matches for "${cleanTerm}" with query "${query}"`);
          allResults.push(...data);
        }
      }

      // Special fallback searches for tricky items
      if (cleanTerm.includes('tape') || cleanTerm.includes('klæbebånd') || cleanTerm.includes('tejp')) {
        console.log('🔍 Special search for tape/adhesive items');
        const { data } = await supabase
          .from('demo')
          .select('*')
          .or('navn.ilike.%tape%,navn.ilike.%klæbebånd%,navn.ilike.%tejp%,synonymer.ilike.%tape%,synonymer.ilike.%klæbebånd%')
          .limit(10);
        if (data?.length) allResults.push(...data);
      }

      if (cleanTerm.includes('clock') || cleanTerm.includes('ur') || cleanTerm.includes('vækkeur')) {
        console.log('🔍 Special search for clock/timer items');
        const { data } = await supabase
          .from('demo')
          .select('*')
          .or('navn.ilike.%ur%,navn.ilike.%clock%,navn.ilike.%vækkeur%,navn.ilike.%timer%,synonymer.ilike.%clock%,synonymer.ilike.%ur%')
          .limit(10);
        if (data?.length) allResults.push(...data);
      }
    }
    
    // Remove duplicates by id
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    );

    console.log(`🎯 Total unique results: ${uniqueResults.length}`);
    console.log('📋 All unique results:', uniqueResults.map(r => r.navn));

    // Enhanced scoring system for better relevance with improved sensitivity
    return uniqueResults.sort((a, b) => {
      let aScore = 0, bScore = 0;
      
      for (const term of searchTerms) {
        const cleanTerm = term.toLowerCase();
        const normalizedTerm = normalizeDanishText(cleanTerm);
        
        // Exact name match (highest priority)
        if (a.navn?.toLowerCase() === cleanTerm) aScore += 1000;
        if (b.navn?.toLowerCase() === cleanTerm) bScore += 1000;
        
        // Exact name match with normalization
        if (normalizeDanishText(a.navn || '') === normalizedTerm) aScore += 950;
        if (normalizeDanishText(b.navn || '') === normalizedTerm) bScore += 950;
        
        // Core item type match (very high priority)
        const coreItems = ['bjælke', 'plade', 'brædder', 'dør', 'vindue', 'tape', 'klæbebånd', 'ur', 'clock'];
        if (coreItems.includes(cleanTerm)) {
          if (a.navn?.toLowerCase().includes(cleanTerm)) aScore += 900;
          if (b.navn?.toLowerCase().includes(cleanTerm)) bScore += 900;
        }
        
        // Exact synonym match (very high priority)
        const aSynonyms = (a.synonymer || '').toLowerCase();
        const bSynonyms = (b.synonymer || '').toLowerCase();
        
        // Check for exact word match in synonyms (not just substring)
        const aSynonymWords = aSynonyms.split(',').map(s => s.trim());
        const bSynonymWords = bSynonyms.split(',').map(s => s.trim());
        
        if (aSynonymWords.includes(cleanTerm)) aScore += 800;
        if (bSynonymWords.includes(cleanTerm)) bScore += 800;
        
        // Normalized synonym matching 
        if (aSynonymWords.some(syn => normalizeDanishText(syn) === normalizedTerm)) aScore += 750;
        if (bSynonymWords.some(syn => normalizeDanishText(syn) === normalizedTerm)) bScore += 750;
        
        // Partial synonym match
        if (aSynonyms.includes(cleanTerm)) aScore += 600;
        if (bSynonyms.includes(cleanTerm)) bScore += 600;
        
        // Name contains term (increased sensitivity)
        if (a.navn?.toLowerCase().includes(cleanTerm)) aScore += 500;
        if (b.navn?.toLowerCase().includes(cleanTerm)) bScore += 500;
        
        // Name contains normalized term
        if (normalizeDanishText(a.navn || '').includes(normalizedTerm)) aScore += 450;
        if (normalizeDanishText(b.navn || '').includes(normalizedTerm)) bScore += 450;
        
        // Variation match (high priority for treatment/condition)
        if (a.variation?.toLowerCase().includes(cleanTerm)) {
          if (['imprægneret', 'trykimprægneret', 'behandlet'].includes(cleanTerm)) {
            aScore += 700;
          } else {
            aScore += 400;
          }
        }
        if (b.variation?.toLowerCase().includes(cleanTerm)) {
          if (['imprægneret', 'trykimprægneret', 'behandlet'].includes(cleanTerm)) {
            bScore += 700;
          } else {
            bScore += 400;
          }
        }
        
        // Material match (increased from 100 to 200 for better sensitivity)
        if (a.materiale?.toLowerCase().includes(cleanTerm)) aScore += 200;
        if (b.materiale?.toLowerCase().includes(cleanTerm)) bScore += 200;
        
        // Partial word matching for better sensitivity
        if (cleanTerm.length >= 4) {
          const partialTerm = cleanTerm.substring(0, Math.floor(cleanTerm.length * 0.75));
          if (a.navn?.toLowerCase().includes(partialTerm)) aScore += 100;
          if (b.navn?.toLowerCase().includes(partialTerm)) bScore += 100;
        }
      }
      
      console.log(`📊 Enhanced scores: ${a.navn} = ${aScore}, ${b.navn} = ${bScore}`);
      return bScore - aScore;
    }).slice(0, 3); // Keep it simple with fewer results

  } catch (error) {
    console.error('Database search error details:', {
      message: error.message,
      stack: error.stack,
      searchTerms: searchTerms
    });
    return [];
  }
};

// Enhanced search with simpler term extraction
const findBestMatches = async (labels: VisionLabel[]) => {
  console.log('🔍 Processing Gemini labels:', labels);
  
  // Extract main search terms - keep it simple
  const searchTerms = [];
  
  for (const label of labels) {
    // Add main description
    if (label.description) {
      searchTerms.push(label.description);
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

  console.log('🎯 Simplified search terms:', cleanTerms);

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
    
    // Return fallback message - no AI analysis allowed
    console.log('❌ No AI analysis allowed - returning fallback result');
    
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
