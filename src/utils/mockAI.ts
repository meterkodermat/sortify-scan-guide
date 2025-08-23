// AI service for waste identification using Google Vision API with semantic validation
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
  type?: 'label' | 'object';
}

// Semantic category groups for validation
const semanticCategories = {
  animals: ['bird', 'animal', 'mammal', 'wildlife', 'pet', 'cat', 'dog', 'horse', 'cow', 'fish', 'flamingo', 'swan', 'duck'],
  people: ['person', 'human', 'face', 'people', 'man', 'woman', 'child', 'baby'],
  kitchen: ['lid', 'pot', 'pan', 'cookware', 'kitchen', 'utensil', 'bowl', 'plate', 'spoon', 'fork', 'knife'],
  containers: ['box', 'container', 'package', 'packaging', 'bottle', 'jar', 'can', 'bag'],
  materials: ['plastic', 'glass', 'metal', 'paper', 'cardboard', 'wood', 'fabric', 'textile'],
  electronics: ['electronic', 'device', 'phone', 'computer', 'battery', 'cable', 'appliance'],
  organic: ['food', 'fruit', 'vegetable', 'organic', 'plant', 'flower', 'leaf', 'tree']
};

// Incompatible category combinations (animals should never match kitchen items)
const incompatibleCategories = [
  ['animals', 'kitchen'],
  ['animals', 'containers'],
  ['people', 'kitchen'],
  ['people', 'containers'],
  ['people', 'materials']
];

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

// Levenshtein distance for fuzzy matching
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + substitutionCost
      );
    }
  }
  
  return matrix[str2.length][str1.length];
};

// Calculate fuzzy match score (0-1, where 1 is perfect match)
const calculateFuzzyScore = (term1: string, term2: string): number => {
  const maxLength = Math.max(term1.length, term2.length);
  if (maxLength === 0) return 1;
  const distance = levenshteinDistance(term1.toLowerCase(), term2.toLowerCase());
  return 1 - (distance / maxLength);
};

// Determine semantic category of a label
const getSemanticCategory = (label: VisionLabel): string[] => {
  const categories: string[] = [];
  const term = label.description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(semanticCategories)) {
    if (keywords.some(keyword => term.includes(keyword) || keyword.includes(term))) {
      categories.push(category);
    }
  }
  
  return categories;
};

// Semantic validation - check if labels are compatible
const validateSemanticCompatibility = (labels: VisionLabel[]): { compatible: boolean; reason?: string } => {
  const allCategories = new Set<string>();
  
  // Collect all semantic categories from labels
  labels.forEach(label => {
    const categories = getSemanticCategory(label);
    categories.forEach(cat => allCategories.add(cat));
  });
  
  // Check for incompatible combinations
  for (const [cat1, cat2] of incompatibleCategories) {
    if (allCategories.has(cat1) && allCategories.has(cat2)) {
      return { 
        compatible: false, 
        reason: `Konflikt: Fundet både ${cat1} og ${cat2} kategorier i samme billede` 
      };
    }
  }
  
  return { compatible: true };
};

// Enhanced search terms with semantic awareness
const getSearchTerms = (label: VisionLabel, semanticContext: string[]): string[] => {
  const searchTerms: string[] = [];
  
  // Primary: Use Google Cloud Translation API result if available
  if (label.translatedText) {
    searchTerms.push(label.translatedText);
    const words = label.translatedText.split(' ').filter(word => word.length > 2);
    searchTerms.push(...words);
  }
  
  // Secondary: Use category fallbacks, but filter by semantic context
  const englishTerm = label.description.toLowerCase();
  const labelCategories = getSemanticCategory(label);
  
  // Only add fallback terms if they're semantically compatible
  for (const [category, terms] of Object.entries(categoryFallbacks)) {
    if (englishTerm.includes(category)) {
      // Check if this category makes sense given the semantic context
      const isCompatible = labelCategories.length === 0 || 
        labelCategories.some(cat => !incompatibleCategories.some(([c1, c2]) => 
          (cat === c1 && semanticContext.includes(c2)) || 
          (cat === c2 && semanticContext.includes(c1))
        ));
      
      if (isCompatible) {
        searchTerms.push(...terms);
      }
    }
  }
  
  // Tertiary: Add original English term with caution
  searchTerms.push(englishTerm);
  
  return [...new Set(searchTerms.filter(term => term.trim().length > 0))];
};

// Advanced database search with fuzzy matching and scoring
const searchDatabase = async (searchTerms: string[], semanticCategories: string[]) => {
  const allMatches = [];
  
  for (const term of searchTerms) {
    // Strategy 1: Direct name match with fuzzy scoring
    const { data: nameMatches } = await supabase
      .from('demo')
      .select('*')
      .ilike('navn', `%${term}%`);
    
    if (nameMatches?.length) {
      nameMatches.forEach(match => {
        const fuzzyScore = calculateFuzzyScore(term, match.navn);
        allMatches.push({ 
          ...match, 
          matchType: 'name', 
          matchTerm: term,
          fuzzyScore,
          exactMatch: match.navn.toLowerCase().includes(term.toLowerCase())
        });
      });
    }
    
    // Strategy 2: Synonym match with fuzzy scoring
    const { data: synonymMatches } = await supabase
      .from('demo')
      .select('*')
      .ilike('synonymer', `%${term}%`);
    
    if (synonymMatches?.length) {
      synonymMatches.forEach(match => {
        const synonyms = match.synonymer?.split(',') || [];
        const bestSynonymScore = Math.max(...synonyms.map(syn => 
          calculateFuzzyScore(term, syn.trim())
        ));
        allMatches.push({ 
          ...match, 
          matchType: 'synonym', 
          matchTerm: term,
          fuzzyScore: bestSynonymScore,
          exactMatch: synonyms.some(syn => syn.toLowerCase().includes(term.toLowerCase()))
        });
      });
    }
    
    // Strategy 3: Material match (lower priority for semantic conflicts)
    const { data: materialMatches } = await supabase
      .from('demo')
      .select('*')
      .ilike('materiale', `%${term}%`);
    
    if (materialMatches?.length) {
      materialMatches.forEach(match => {
        const fuzzyScore = calculateFuzzyScore(term, match.materiale || '');
        // Penalize material matches if semantic categories conflict
        const semanticPenalty = semanticCategories.includes('animals') || semanticCategories.includes('people') ? 0.3 : 1.0;
        allMatches.push({ 
          ...match, 
          matchType: 'material', 
          matchTerm: term,
          fuzzyScore: fuzzyScore * semanticPenalty,
          exactMatch: match.materiale?.toLowerCase().includes(term.toLowerCase())
        });
      });
    }
    
    // Strategy 4: Variation match
    const { data: variationMatches } = await supabase
      .from('demo')
      .select('*')
      .ilike('variation', `%${term}%`);
    
    if (variationMatches?.length) {
      variationMatches.forEach(match => {
        const fuzzyScore = calculateFuzzyScore(term, match.variation || '');
        allMatches.push({ 
          ...match, 
          matchType: 'variation', 
          matchTerm: term,
          fuzzyScore,
          exactMatch: match.variation?.toLowerCase().includes(term.toLowerCase())
        });
      });
    }
  }
  
  return allMatches;
};

// Multi-criteria scoring for matches
const calculateMatchScore = (match: any, visionScore: number, semanticCategories: string[]): number => {
  let score = visionScore * 100;
  
  // Base match type multipliers
  const typeMultipliers = {
    'name': 1.3,
    'synonym': 1.2,
    'variation': 1.1,
    'material': 0.8
  };
  
  score *= (typeMultipliers[match.matchType] || 1.0);
  
  // Fuzzy match quality bonus
  score *= (0.7 + (match.fuzzyScore * 0.3));
  
  // Exact match bonus
  if (match.exactMatch) {
    score *= 1.2;
  }
  
  // Semantic compatibility penalty
  const matchTermLower = match.matchTerm.toLowerCase();
  if ((semanticCategories.includes('animals') || semanticCategories.includes('people')) && 
      (matchTermLower.includes('lid') || matchTermLower.includes('låg') || matchTermLower.includes('pot'))) {
    score *= 0.1; // Heavy penalty for animal/person -> kitchen item matches
  }
  
  return score;
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

    // STEP 1.5: SEMANTIC VALIDATION
    const semanticValidation = validateSemanticCompatibility(topLabels);
    const globalSemanticContext = topLabels.flatMap(label => getSemanticCategory(label));
    
    let aiThoughtProcess = `Analyse: Identificeret ${topLabels.length} labels fra Vision API. `;
    
    if (!semanticValidation.compatible) {
      aiThoughtProcess += `Semantisk advarsel: ${semanticValidation.reason}. `;
      console.warn('Semantic compatibility issue:', semanticValidation.reason);
    }

    // Prioritize object detection over general labels
    const objectLabels = topLabels.filter(l => l.type === 'object');
    const generalLabels = topLabels.filter(l => l.type !== 'object');
    const prioritizedLabels = [...objectLabels, ...generalLabels];

    // STEP 2: ADVANCED MATCHING - Ensemble voting system
    let bestMatch = null;
    let bestScore = 0;
    const processedLabels = new Set();
    const allMatches = [];

    // Analyze primary object from vision
    const primaryLabel = prioritizedLabels[0];
    const identifiedObject = primaryLabel?.description || 'ukendt genstand';
    const primarySemanticCategories = getSemanticCategory(primaryLabel);
    
    aiThoughtProcess += `Primær genstand: '${identifiedObject}' (kategorier: ${primarySemanticCategories.join(', ')}). `;

    // Process each label with semantic awareness
    for (const label of prioritizedLabels) {
      const englishTerm = label.description.toLowerCase();
      
      if (processedLabels.has(englishTerm)) continue;
      processedLabels.add(englishTerm);
      
      const labelSemanticCategories = getSemanticCategory(label);
      
      // Get search terms with semantic context
      const searchTerms = getSearchTerms(label, globalSemanticContext);
      console.log(`Search terms for "${label.description}" (${labelSemanticCategories.join(', ')}): ${searchTerms.join(', ')}`);
      
      // Enhanced database search with semantic awareness
      const matches = await searchDatabase(searchTerms, globalSemanticContext);
      
      if (matches.length > 0) {
        console.log(`Found ${matches.length} matches for "${label.description}"`);
        
        // Score all matches with advanced algorithm
        for (const match of matches) {
          const matchScore = calculateMatchScore(match, label.score, globalSemanticContext);
          
          match.finalScore = matchScore;
          match.sourceLabel = label.description;
          match.semanticCategories = labelSemanticCategories;
          allMatches.push(match);
          
          if (matchScore > bestScore) {
            bestScore = matchScore;
            bestMatch = match;
          }
        }
      }
    }

    // STEP 3: FINAL VALIDATION AND OUTPUT
    if (bestMatch && bestScore > 30) { // Minimum threshold for acceptance
      console.log(`Best match: "${bestMatch.navn}" (score: ${Math.round(bestScore)}%)`);
      
      aiThoughtProcess += `Match: Fundet '${bestMatch.navn}' via ${bestMatch.matchType} match (score: ${Math.round(bestScore)}%, fuzzy: ${Math.round(bestMatch.fuzzyScore * 100)}%). `;
      
      // Additional semantic check
      if (!semanticValidation.compatible && bestScore < 70) {
        aiThoughtProcess += `Semantisk konflikt detekteret - reducerer confidence. `;
        bestScore *= 0.6;
      }
      
      return {
        id: Date.now().toString(),
        name: bestMatch.navn,
        image: imageData,
        homeCategory: bestMatch.hjem || 'Restaffald',
        recyclingCategory: bestMatch.genbrugsplads || 'Restaffald',
        description: bestMatch.variation || bestMatch.navn,
        confidence: Math.round(Math.min(bestScore, 95)), // Cap at 95%
        timestamp: new Date(),
        aiThoughtProcess: aiThoughtProcess + `Konklusion: Udtrukket sorteringsinfo fra WASTE_DATA med semantisk validering.`
      };
    }

    // STEP 4: HANDLE NO MATCH OR LOW CONFIDENCE
    aiThoughtProcess += `Match: Ingen pålidelig match fundet (bedste score: ${Math.round(bestScore)}%). `;
    
    // Special handling for obvious non-waste items
    if (globalSemanticContext.includes('animals') || globalSemanticContext.includes('people')) {
      aiThoughtProcess += `Konklusion: Genstand er ikke affald (${primarySemanticCategories.join(', ')}).`;
      
      return {
        id: Date.now().toString(),
        name: 'Ikke affald',
        image: imageData,
        homeCategory: 'Ikke relevant',
        recyclingCategory: 'Ikke relevant',
        description: `Identificeret som: ${identifiedObject}. Dette er ikke en affaldsgenstand.`,
        confidence: Math.round((primaryLabel?.score || 0.5) * 100),
        timestamp: new Date(),
        aiThoughtProcess: aiThoughtProcess
      };
    }

    aiThoughtProcess += `Konklusion: Sæt til 'Ukendt' - ingen pålidelig match i WASTE_DATA.`;
    
    return {
      id: Date.now().toString(),
      name: 'Ukendt',
      image: imageData,
      homeCategory: 'Restaffald',
      recyclingCategory: 'Restaffald',
      description: `Identificeret som: ${identifiedObject}. Kunne ikke matches sikkert til WASTE_DATA.`,
      confidence: Math.round((primaryLabel?.score || 0.5) * 100),
      timestamp: new Date(),
      aiThoughtProcess: aiThoughtProcess
    };

  } catch (error) {
    console.error('Error in identifyWaste:', error);
    
    const aiThoughtProcess = `Analyse: Fejl ved billedanalyse (${error.message}). Match: Ingen data tilgængelig. Konklusion: Sæt til 'Ukendt' som fallback.`;
    
    return {
      id: Date.now().toString(),
      name: 'Ukendt',
      image: imageData,
      homeCategory: 'Restaffald',
      recyclingCategory: 'Restaffald',
      description: `Fejl ved analyse: ${error.message}. Genstanden kunne ikke identificeres.`,
      confidence: 50,
      timestamp: new Date(),
      aiThoughtProcess: aiThoughtProcess
    };
  }
};