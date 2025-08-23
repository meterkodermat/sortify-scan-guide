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
}

interface VisionLabel {
  description: string;
  score: number;
}

interface VisionResponse {
  success: boolean;
  labels?: VisionLabel[];
  error?: string;
}

// English to Danish translation dictionary for Vision API results
const englishToDanish = {
  // Fruits and food
  'apple': ['æble', 'frugt'],
  'fruit': ['frugt'],
  'banana': ['banan', 'frugt'],
  'orange': ['appelsin', 'citrus', 'frugt'],
  'food': ['mad', 'fødevarer', 'organisk'],
  'vegetable': ['grøntsag', 'organisk'],
  'bread': ['brød', 'organisk'],
  'meat': ['kød', 'organisk'],
  
  // Containers and packaging
  'bottle': ['flaske', 'emballage'],
  'plastic bottle': ['plastflaske', 'plastik', 'emballage'],
  'glass bottle': ['glasflaske', 'glas', 'emballage'],
  'can': ['dåse', 'metal', 'emballage'],
  'tin can': ['dåse', 'metal', 'emballage'],
  'aluminum can': ['aluminiumsdåse', 'aluminium', 'metal'],
  'jar': ['glas', 'emballage'],
  'container': ['beholder', 'emballage'],
  'box': ['kasse', 'karton', 'papir'],
  'carton': ['karton', 'papir', 'emballage'],
  'packaging': ['emballage', 'indpakning'],
  'bag': ['pose', 'plastik'],
  'plastic bag': ['plastpose', 'plastik'],
  'paper bag': ['papirpose', 'papir'],
  
  // Materials
  'plastic': ['plastik'],
  'glass': ['glas'],
  'metal': ['metal'],
  'aluminum': ['aluminium', 'metal'],
  'steel': ['stål', 'metal'],
  'paper': ['papir'],
  'cardboard': ['karton', 'papir'],
  'wood': ['træ'],
  'fabric': ['tekstil', 'stof'],
  'cotton': ['bomuld', 'tekstil'],
  
  // Electronics
  'phone': ['telefon', 'elektronik'],
  'computer': ['computer', 'elektronik'],
  'battery': ['batteri', 'elektronik'],
  'cable': ['kabel', 'elektronik'],
  'electronics': ['elektronik'],
  
  // Common items
  'newspaper': ['avis', 'papir'],
  'magazine': ['blad', 'papir'],
  'book': ['bog', 'papir'],
  'cup': ['kop', 'emballage'],
  'plate': ['tallerken'],
  'cutlery': ['bestik', 'metal'],
  'fork': ['gaffel', 'metal'],
  'knife': ['kniv', 'metal'],
  'spoon': ['ske', 'metal'],
  'tool': ['værktøj', 'metal'],
  'toy': ['legetøj'],
  'clothing': ['tøj', 'tekstil'],
  'shoe': ['sko', 'tekstil'],
  
  // Categories
  'waste': ['affald'],
  'trash': ['affald', 'skrald'],
  'garbage': ['affald', 'skrald'],
  'recycling': ['genbrug'],
  'organic': ['organisk', 'kompost'],
  'compost': ['kompost', 'organisk']
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

// Function to translate English terms to Danish search terms
const translateTodanish = (englishTerm: string): string[] => {
  const lowercaseTerm = englishTerm.toLowerCase();
  const danishTerms = englishToDanish[lowercaseTerm] || [];
  
  // Also include partial matches
  const partialMatches: string[] = [];
  Object.keys(englishToDanish).forEach(key => {
    if (key.includes(lowercaseTerm) || lowercaseTerm.includes(key)) {
      partialMatches.push(...englishToDanish[key]);
    }
  });
  
  return [...new Set([...danishTerms, ...partialMatches, lowercaseTerm])];
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
    // Call vision-proxy edge function
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

    // Get the top labels from Vision API
    const topLabels = visionData.labels.slice(0, 5);
    console.log('Vision API labels:', topLabels);

    // Translate English Vision labels to Danish and search database
    let bestMatch = null;
    let bestScore = 0;
    const processedLabels = new Set(); // Avoid duplicate processing

    for (const label of topLabels) {
      const englishTerm = label.description.toLowerCase();
      
      // Skip if we already processed this term
      if (processedLabels.has(englishTerm)) continue;
      processedLabels.add(englishTerm);
      
      console.log(`Processing Vision label: "${label.description}" (confidence: ${Math.round(label.score * 100)}%)`);
      
      // Translate English term to Danish search terms
      const danishSearchTerms = translateTodanish(englishTerm);
      console.log(`Danish search terms: ${danishSearchTerms.join(', ')}`);
      
      // Search database with multiple strategies
      const matches = await searchDatabase(danishSearchTerms);
      
      if (matches.length > 0) {
        console.log(`Found ${matches.length} matches for "${label.description}"`);
        
        // Score matches based on match type and Vision confidence
        for (const match of matches) {
          let matchScore = label.score * 100; // Base Vision confidence
          
          // Boost score based on match type (name matches are most reliable)
          if (match.matchType === 'name') matchScore *= 1.2;
          else if (match.matchType === 'synonym') matchScore *= 1.1;
          else if (match.matchType === 'variation') matchScore *= 1.0;
          else if (match.matchType === 'material') matchScore *= 0.8;
          
          // Avoid duplicate matches from same database entry
          const uniqueKey = `${match.id}-${match.matchType}`;
          
          if (matchScore > bestScore) {
            console.log(`New best match: "${match.navn}" (type: ${match.matchType}, term: ${match.matchTerm}, score: ${Math.round(matchScore)}%)`);
            
            bestMatch = {
              id: Date.now().toString(),
              name: match.navn || 'Ukendt genstand',
              image: imageData,
              homeCategory: match.hjem || 'Restaffald',
              recyclingCategory: match.genbrugsplads || 'Restaffald',
              description: `${match.variation || match.navn || 'Ukendt genstand'}. ${match.materiale ? `Materiale: ${match.materiale}. ` : ''}Identificeret som: ${label.description} → ${match.matchTerm}.`,
              confidence: Math.round(matchScore),
              timestamp: new Date()
            };
            bestScore = matchScore;
          }
        }
      } else {
        console.log(`No matches found for "${label.description}" with Danish terms: ${danishSearchTerms.join(', ')}`);
      }
    }

    // If no match found, use fallback
    if (!bestMatch) {
      const fallback = fallbackItems[0];
      const topLabel = topLabels[0];
      
      bestMatch = {
        id: Date.now().toString(),
        name: topLabel?.description || fallback.name,
        image: imageData,
        homeCategory: fallback.homeCategory,
        recyclingCategory: fallback.recyclingCategory,
        description: `Identificeret som: ${topLabel?.description || 'ukendt genstand'}. ${fallback.description}`,
        confidence: Math.round((topLabel?.score || 0.5) * 100),
        timestamp: new Date()
      };
    }

    return bestMatch;

  } catch (error) {
    console.error('Error in identifyWaste:', error);
    
    // Return fallback item on error
    const fallback = fallbackItems[0];
    return {
      id: Date.now().toString(),
      name: fallback.name,
      image: imageData,
      homeCategory: fallback.homeCategory,
      recyclingCategory: fallback.recyclingCategory,
      description: `Fejl ved analyse: ${error.message}. ${fallback.description}`,
      confidence: 50,
      timestamp: new Date()
    };
  }
};