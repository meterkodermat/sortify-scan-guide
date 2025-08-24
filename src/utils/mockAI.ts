// Phase 4: One Word Strategy - Radical Simplification
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
}

interface VisionLabel {
  description: string;
  score: number;
  translatedText?: string;
}

interface VisionResponse {
  success: boolean;
  labels?: VisionLabel[];
  error?: string;
}

// Hardcoded rules for obvious non-waste items (ONE WORD STRATEGY)
const nonWasteRules: { [key: string]: string } = {
  'flamingo': 'Ikke affald',
  'bird': 'Ikke affald',
  'swan': 'Ikke affald',
  'duck': 'Ikke affald',
  'goose': 'Ikke affald',
  'animal': 'Ikke affald',
  'mammal': 'Ikke affald',
  'wildlife': 'Ikke affald',
  'pet': 'Ikke affald',
  'cat': 'Ikke affald',
  'dog': 'Ikke affald',
  'horse': 'Ikke affald',
  'cow': 'Ikke affald',
  'fish': 'Ikke affald',
  'person': 'Ikke affald',
  'human': 'Ikke affald',
  'face': 'Ikke affald',
  'people': 'Ikke affald',
  'man': 'Ikke affald',
  'woman': 'Ikke affald',
  'child': 'Ikke affald',
  'baby': 'Ikke affald',
  'boy': 'Ikke affald',
  'girl': 'Ikke affald',
  'adult': 'Ikke affald'
};

// Simple fuzzy matching (keep only this utility)
const calculateFuzzyScore = (term1: string, term2: string): number => {
  const maxLength = Math.max(term1.length, term2.length);
  if (maxLength === 0) return 1;
  
  // Simple character overlap scoring
  const term1Lower = term1.toLowerCase();
  const term2Lower = term2.toLowerCase();
  
  if (term1Lower === term2Lower) return 1;
  if (term1Lower.includes(term2Lower) || term2Lower.includes(term1Lower)) return 0.8;
  
  let matches = 0;
  for (let char of term1Lower) {
    if (term2Lower.includes(char)) matches++;
  }
  
  return matches / maxLength;
};

// Simple database search (ONE TERM ONLY)
const searchDatabase = async (searchTerm: string) => {
  // Search only in 'navn' field with exact matching
  const { data: matches } = await supabase
    .from('demo')
    .select('*')
    .ilike('navn', `%${searchTerm}%`);
  
  if (!matches?.length) {
    return null;
  }
  
  // Return best match based on simple fuzzy score
  let bestMatch = matches[0];
  let bestScore = calculateFuzzyScore(searchTerm, bestMatch.navn);
  
  for (const match of matches) {
    const score = calculateFuzzyScore(searchTerm, match.navn);
    if (score > bestScore) {
      bestMatch = match;
      bestScore = score;
    }
  }
  
  return bestMatch;
};

export const identifyWaste = async (imageData: string): Promise<WasteItem> => {
  try {
    console.log('🚀 One Word Strategy Pipeline Started');
    
    // STEP 1: Get vision data
    const { data: visionData, error: visionError } = await supabase.functions.invoke('vision-proxy', {
      body: { image: imageData }
    });

    if (visionError || !visionData?.success || !visionData?.labels?.length) {
      throw new Error('Kunne ikke analysere billedet');
    }

    // STEP 2: Take ONLY the highest confidence result (ONE WORD STRATEGY)
    const topLabel = visionData.labels[0];
    const keyword = topLabel.description.toLowerCase();
    
    let aiThoughtProcess = `🎯 ONE WORD: "${keyword}" (confidence: ${(topLabel.score * 100).toFixed(1)}%). `;

    // STEP 3: Check hardcoded non-waste rules FIRST
    if (nonWasteRules[keyword]) {
      aiThoughtProcess += `✅ REGEL MATCH: ${keyword} -> ${nonWasteRules[keyword]}. `;
      
      return {
        id: Date.now().toString(),
        name: nonWasteRules[keyword],
        image: imageData,
        homeCategory: 'Ikke affald',
        recyclingCategory: 'Ikke affald',
        description: 'Dette er ikke affald og skal ikke sorteres.',
        confidence: 70, // Conservative confidence
        timestamp: new Date(),
        aiThoughtProcess: aiThoughtProcess + `💡 KONKLUSION: Hardcodet regel anvendt.`
      };
    }

    // STEP 4: Search database with the ONE WORD (English only - no translation)
    const databaseMatch = await searchDatabase(keyword);
    
    if (databaseMatch) {
      const fuzzyScore = calculateFuzzyScore(keyword, databaseMatch.navn);
      const confidence = Math.min(70, fuzzyScore * 80); // Max 70% confidence
      
      aiThoughtProcess += `📊 DATABASE MATCH: "${databaseMatch.navn}" (fuzzy: ${(fuzzyScore * 100).toFixed(1)}%). `;
      
      return {
        id: Date.now().toString(),
        name: databaseMatch.navn,
        image: imageData,
        homeCategory: databaseMatch.hjem || 'Restaffald',
        recyclingCategory: databaseMatch.genbrugsplads || 'Restaffald',
        description: databaseMatch.variation || databaseMatch.navn,
        confidence: Math.max(30, Math.round(confidence)), // Min 30% confidence
        timestamp: new Date(),
        aiThoughtProcess: aiThoughtProcess + `💡 KONKLUSION: Database match fundet.`
      };
    }

    // STEP 5: Fallback for unknown items
    aiThoughtProcess += `❌ INGEN MATCH for "${keyword}". `;
    
    return {
      id: Date.now().toString(),
      name: 'Ukendt genstand',
      image: imageData,
      homeCategory: 'Restaffald',
      recyclingCategory: 'Restaffald',
      description: 'Genstanden kunne ikke identificeres. Sortér som restaffald eller kontakt din lokale genbrugsplads for vejledning.',
      confidence: 25, // Low but consistent
      timestamp: new Date(),
      aiThoughtProcess: aiThoughtProcess + `⚠️ FALLBACK: Ukendt genstand.`
    };

  } catch (error) {
    console.error('💥 Error in One Word Strategy:', error);
    
    return {
      id: Date.now().toString(),
      name: 'Analyse fejl',
      image: imageData,
      homeCategory: 'Restaffald',
      recyclingCategory: 'Restaffald',
      description: 'Der opstod en teknisk fejl under AI-analysen. Prøv at tage et nyt billede.',
      confidence: 0,
      timestamp: new Date(),
      aiThoughtProcess: `🚨 FEJL: ${error instanceof Error ? error.message : 'Ukendt fejl'}`
    };
  }
};
