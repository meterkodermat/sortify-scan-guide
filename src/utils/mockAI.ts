// AI service for waste identification using Google Vision API
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

// Fallback terms for common categories when translation fails
const categoryFallbacks: { [key: string]: string[] } = {
  'food': ['mad', 'fødevarer', 'spiserester', 'organisk', 'kompost'],
  'fruit': ['frugt', 'æble', 'pære', 'banan', 'citrus'],
  'bottle': ['flaske', 'plastflaske', 'glasflaske', 'drikkedunk'],
  'bag': ['pose', 'plastpose', 'indkøbspose', 'affaldssæk'],
  'paper': ['papir', 'karton', 'avis', 'tidsskrift'],
  'plastic': ['plast', 'plastik', 'emballage'],
  'metal': ['metal', 'aluminium', 'stål', 'dåse'],
  'glass': ['glas', 'flaske', 'krukke'],
  'electronic': ['elektronik', 'batteri', 'ledning', 'computer'],
  'textile': ['tekstil', 'tøj', 'stof', 'sko']
};

// Fallback database for unknown items
const fallbackItems = [
  {
    name: 'Ukendt genstand',
    homeCategory: 'Restaffald',
    recyclingCategory: 'Restaffald',
    description: 'Genstanden kunne ikke identificeres. Sortér som restaffald eller kontakt din lokale genbrugsplads for vejledning.'
  }
];

// Function to get search terms from Vision label (prioritizes Google Translation API results)
const getSearchTerms = (label: VisionLabel): string[] => {
  const searchTerms: string[] = [];
  
  // Primary: Use Google Cloud Translation API result if available
  if (label.translatedText) {
    searchTerms.push(label.translatedText);
    // Add individual words from translated text
    const words = label.translatedText.split(' ').filter(word => word.length > 2);
    searchTerms.push(...words);
  }
  
  // Secondary: Use category fallbacks for common English terms
  const englishTerm = label.description.toLowerCase();
  for (const [category, terms] of Object.entries(categoryFallbacks)) {
    if (englishTerm.includes(category)) {
      searchTerms.push(...terms);
    }
  }
  
  // Tertiary: Add the original English term as fallback
  searchTerms.push(englishTerm);
  
  // Remove duplicates and empty strings
  return [...new Set(searchTerms.filter(term => term.trim().length > 0))];
};

// Function to search database with multiple strategies
const searchDatabase = async (searchTerms: string[]) => {
  const allMatches = [];
  
  for (const term of searchTerms) {
    // Strategy 1: Direct name match
    const { data: nameMatches } = await supabase
      .from('demo')
      .select('*')
      .ilike('navn', `%${term}%`);
    
    if (nameMatches?.length) {
      allMatches.push(...nameMatches.map(match => ({ ...match, matchType: 'name', matchTerm: term })));
    }
    
    // Strategy 2: Synonym match
    const { data: synonymMatches } = await supabase
      .from('demo')
      .select('*')
      .ilike('synonymer', `%${term}%`);
    
    if (synonymMatches?.length) {
      allMatches.push(...synonymMatches.map(match => ({ ...match, matchType: 'synonym', matchTerm: term })));
    }
    
    // Strategy 3: Material match
    const { data: materialMatches } = await supabase
      .from('demo')
      .select('*')
      .ilike('materiale', `%${term}%`);
    
    if (materialMatches?.length) {
      allMatches.push(...materialMatches.map(match => ({ ...match, matchType: 'material', matchTerm: term })));
    }
    
    // Strategy 4: Variation match
    const { data: variationMatches } = await supabase
      .from('demo')
      .select('*')
      .ilike('variation', `%${term}%`);
    
    if (variationMatches?.length) {
      allMatches.push(...variationMatches.map(match => ({ ...match, matchType: 'variation', matchTerm: term })));
    }
  }
  
  return allMatches;
};

export const identifyWaste = async (imageData: string): Promise<WasteItem> => {
  try {
    // STEP 1: VISUAL ANALYSIS - Call vision-proxy edge function
    const { data: visionData, error: visionError } = await supabase.functions.invoke('vision-proxy', {
      body: { image: imageData }
    });

    if (visionError) {
      console.error('Vision proxy error:', visionError);
      throw new Error('Kunne ikke analysere billedet');
    }

    if (!visionData?.success || !visionData?.labels?.length) {
      console.error('No labels returned from vision API');
      throw new Error('Ingen objekter fundet i billedet');
    }

    // Get the top labels from Vision API for analysis
    const topLabels = visionData.labels.slice(0, 5);
    console.log('Vision API labels:', topLabels);

    // STEP 2: DATA LOOKUP - Systematic search through WASTE_DATA (demo table)
    let bestMatch = null;
    let bestScore = 0;
    let aiThoughtProcess = '';
    const processedLabels = new Set();

    // Analyze primary object from vision
    const primaryLabel = topLabels[0];
    const identifiedObject = primaryLabel?.description || 'ukendt genstand';
    const identifiedMaterial = topLabels.find(l => 
      categoryFallbacks.plastic?.some(term => l.translatedText?.includes(term)) ||
      categoryFallbacks.paper?.some(term => l.translatedText?.includes(term)) ||
      categoryFallbacks.glass?.some(term => l.translatedText?.includes(term)) ||
      categoryFallbacks.metal?.some(term => l.translatedText?.includes(term))
    )?.translatedText || 'ukendt materiale';

    aiThoughtProcess = `Analyse: Identificeret primær genstand som '${identifiedObject}', materiale: '${identifiedMaterial}'. `;

    for (const label of topLabels) {
      const englishTerm = label.description.toLowerCase();
      
      if (processedLabels.has(englishTerm)) continue;
      processedLabels.add(englishTerm);
      
      // Get search terms prioritizing Google Translation API results
      const searchTerms = getSearchTerms(label);
      console.log(`Search terms for "${label.description}": ${searchTerms.join(', ')}`);
      
      // Systematic database search limited to WASTE_DATA only
      const matches = await searchDatabase(searchTerms);
      
      if (matches.length > 0) {
        console.log(`Found ${matches.length} matches in WASTE_DATA for "${label.description}"`);
        
        // Find single best match based on scoring
        for (const match of matches) {
          let matchScore = label.score * 100;
          
          // Scoring system for match quality
          if (match.matchType === 'name') matchScore *= 1.2;
          else if (match.matchType === 'synonym') matchScore *= 1.1;
          else if (match.matchType === 'variation') matchScore *= 1.0;
          else if (match.matchType === 'material') matchScore *= 0.8;
          
          if (matchScore > bestScore) {
            console.log(`Best match found: "${match.navn}" (confidence: ${Math.round(matchScore)}%)`);
            
            // STEP 3: REASONING - Document the matching process
            aiThoughtProcess += `Match: Fundet '${match.navn}' i WASTE_DATA via ${match.matchType} match. `;
            
            bestMatch = {
              id: Date.now().toString(),
              name: match.navn,
              image: imageData,
              homeCategory: match.hjem || 'Restaffald',
              recyclingCategory: match.genbrugsplads || 'Restaffald',
              description: match.variation || match.navn,
              confidence: Math.round(matchScore),
              timestamp: new Date(),
              aiThoughtProcess: aiThoughtProcess + `Konklusion: Udtrukket sorteringsinfo fra WASTE_DATA.`
            };
            bestScore = matchScore;
          }
        }
      }
    }

    // STEP 4: CONSTRUCT OUTPUT - Handle no match case
    if (!bestMatch) {
      aiThoughtProcess += `Match: Ingen præcist match fundet i WASTE_DATA. Konklusion: Sæt til 'Ukendt'.`;
      
      bestMatch = {
        id: Date.now().toString(),
        name: 'Ukendt',
        image: imageData,
        homeCategory: 'Restaffald',
        recyclingCategory: 'Restaffald',
        description: `Identificeret som: ${identifiedObject}. Kunne ikke matches til WASTE_DATA.`,
        confidence: Math.round((primaryLabel?.score || 0.5) * 100),
        timestamp: new Date(),
        aiThoughtProcess: aiThoughtProcess
      };
    }

    return bestMatch;

  } catch (error) {
    console.error('Error in identifyWaste:', error);
    
    // ERROR HANDLING: Follow structured rules even on error
    const aiThoughtProcess = `Analyse: Fejl ved billedanalyse (${error.message}). Match: Ingen data tilgængelig. Konklusion: Sæt til 'Ukendt' som fallback.`;
    
    return {
      id: Date.now().toString(),
      name: 'Ukendt',
      image: imageData,
      homeCategory: 'Restaffald',
      recyclingCategory: 'Restaffald',
      description: `Fejl ved analyse: ${error.message}. Genstanden kunne ikke identificeres. Sortér som restaffald eller kontakt din lokale genbrugsplads.`,
      confidence: 50,
      timestamp: new Date(),
      aiThoughtProcess: aiThoughtProcess
    };
  }
};