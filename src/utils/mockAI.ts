// Phase 3: Complete AI Overhaul for Waste Identification with intelligent scoring
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
  degradedScore?: number;
  contextualRelevance?: number;
}

// Phase 3A: Enhanced semantic categories with stricter animal/people detection
const semanticCategories = {
  animals: ['bird', 'animal', 'mammal', 'wildlife', 'pet', 'cat', 'dog', 'horse', 'cow', 'fish', 'flamingo', 'swan', 'duck', 'goose', 'chicken', 'rabbit', 'deer', 'elephant', 'tiger', 'lion', 'fugl', 'dyr', 'pattedyr', 'kæledyr', 'kat', 'hund', 'hest', 'ko', 'fisk', 'flamingo', 'svane', 'and', 'gås', 'kylling', 'kanin', 'hjort'],
  people: ['person', 'human', 'face', 'people', 'man', 'woman', 'child', 'baby', 'boy', 'girl', 'adult', 'menneske', 'ansigt', 'mennesker', 'mand', 'kvinde', 'barn', 'baby', 'dreng', 'pige', 'voksen'],
  kitchen: ['lid', 'pot', 'pan', 'cookware', 'kitchen', 'utensil', 'bowl', 'plate', 'spoon', 'fork', 'knife', 'låg', 'grydelåg', 'gryde', 'pande', 'køkkenting', 'køkken', 'redskab', 'skål', 'tallerken', 'ske', 'gaffel', 'kniv'],
  containers: ['box', 'container', 'package', 'packaging', 'bottle', 'jar', 'can', 'bag', 'kasse', 'beholder', 'pakke', 'emballage', 'flaske', 'krukke', 'dåse', 'pose'],
  materials: ['plastic', 'glass', 'metal', 'paper', 'cardboard', 'wood', 'fabric', 'textile', 'plastik', 'glas', 'metal', 'papir', 'karton', 'træ', 'stof', 'tekstil'],
  electronics: ['electronic', 'device', 'phone', 'computer', 'battery', 'cable', 'appliance', 'elektronik', 'enhed', 'telefon', 'computer', 'batteri', 'kabel', 'apparat'],
  organic: ['food', 'fruit', 'vegetable', 'organic', 'plant', 'flower', 'leaf', 'tree', 'mad', 'frugt', 'grøntsag', 'organisk', 'plante', 'blomst', 'blad', 'træ'],
  // Ultra-generic terms that need confidence degradation
  ultraGeneric: ['lid', 'box', 'container', 'object', 'item', 'thing', 'stuff', 'låg', 'kasse', 'genstand', 'ting', 'noget']
};

// Phase 3A: Critical incompatible combinations with zero tolerance
const incompatibleCategories = [
  ['animals', 'kitchen'],     // Flamingo cannot be a lid
  ['animals', 'containers'],  // Animals cannot be boxes/bottles
  ['people', 'kitchen'],      // People cannot be kitchen items
  ['people', 'containers'],   // People cannot be containers
  ['people', 'materials'],    // People cannot be materials
  ['animals', 'materials']    // Animals cannot be materials
];

// Phase 3B: Translation blacklist - nonsensical translations to block
const translationBlacklist = {
  'flamingo': ['lid', 'låg', 'pot', 'gryde', 'container', 'beholder'],
  'swan': ['lid', 'låg', 'pot', 'gryde'],
  'bird': ['lid', 'låg', 'cookware', 'køkkentøj'],
  'person': ['lid', 'låg', 'box', 'kasse'],
  'human': ['container', 'beholder', 'packaging', 'emballage']
};

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

// Phase 3A: Enhanced semantic categorization with confidence scoring
const getSemanticCategory = (label: VisionLabel): string[] => {
  const categories: string[] = [];
  const term = label.description.toLowerCase();
  const translatedTerm = label.translatedText?.toLowerCase() || '';
  
  for (const [category, keywords] of Object.entries(semanticCategories)) {
    const matchFound = keywords.some(keyword => {
      return term.includes(keyword) || keyword.includes(term) || 
             (translatedTerm && (translatedTerm.includes(keyword) || keyword.includes(translatedTerm)));
    });
    
    if (matchFound) {
      categories.push(category);
    }
  }
  
  return categories;
};

// Phase 3A: Vision confidence degradation for generic terms
const degradeVisionConfidence = (label: VisionLabel): VisionLabel => {
  const term = label.description.toLowerCase();
  const translatedTerm = label.translatedText?.toLowerCase() || '';
  
  let degradedScore = label.score;
  let contextualRelevance = 1.0;
  
  // Ultra-generic terms get heavy degradation
  if (semanticCategories.ultraGeneric.some(generic => 
    term === generic || translatedTerm === generic)) {
    degradedScore *= 0.3; // 70% reduction for ultra-generic terms
    contextualRelevance = 0.3;
  }
  
  // Generic terms with low confidence get degraded further
  if (label.score < 0.8 && (term === 'lid' || translatedTerm === 'låg')) {
    degradedScore *= 0.1; // Massive reduction for low-confidence generic terms
    contextualRelevance = 0.1;
  }
  
  return {
    ...label,
    degradedScore,
    contextualRelevance
  };
};

// Phase 3B: Smart translation validation
const validateTranslation = (original: string, translated: string): boolean => {
  const originalLower = original.toLowerCase();
  const translatedLower = translated.toLowerCase();
  
  // Check translation blacklist
  if (translationBlacklist[originalLower]) {
    return !translationBlacklist[originalLower].includes(translatedLower);
  }
  
  // Additional semantic validation
  const originalCategories = getSemanticCategory({ description: original, score: 1.0 });
  const translatedCategories = getSemanticCategory({ description: translated, score: 1.0 });
  
  // Translation should maintain semantic category consistency
  if (originalCategories.includes('animals') && 
      (translatedCategories.includes('kitchen') || translatedCategories.includes('containers'))) {
    return false;
  }
  
  return true;
};

// Phase 3A: Enhanced semantic compatibility with severity levels
const validateSemanticCompatibility = (labels: VisionLabel[]): { compatible: boolean; severity: 'critical' | 'warning' | 'minor'; reason?: string } => {
  const allCategories = new Set<string>();
  const criticalConflicts: string[] = [];
  
  // Collect all semantic categories from labels
  labels.forEach(label => {
    const categories = getSemanticCategory(label);
    categories.forEach(cat => allCategories.add(cat));
  });
  
  // Check for critical incompatible combinations
  for (const [cat1, cat2] of incompatibleCategories) {
    if (allCategories.has(cat1) && allCategories.has(cat2)) {
      criticalConflicts.push(`${cat1}+${cat2}`);
    }
  }
  
  if (criticalConflicts.length > 0) {
    return { 
      compatible: false, 
      severity: 'critical',
      reason: `KRITISK KONFLIKT: ${criticalConflicts.join(', ')} - kan ikke eksistere i samme billede` 
    };
  }
  
  return { compatible: true, severity: 'minor' };
};

// Phase 3C: Semantic veto system - completely blocks nonsensical matches
const semanticVeto = (originalLabel: string, translatedLabel: string, labelCategories: string[], globalContext: string[]): { vetoed: boolean; reason?: string } => {
  // Absolute veto for animal/people -> kitchen/container
  if ((labelCategories.includes('animals') || labelCategories.includes('people')) && 
      (globalContext.includes('kitchen') || globalContext.includes('containers'))) {
    return { 
      vetoed: true, 
      reason: `🚫 ABSOLUT VETO: ${originalLabel} (${labelCategories.join(',')}) kan ALDRIG være køkkenting eller beholder`
    };
  }
  
  // Translation-specific vetos
  if (!validateTranslation(originalLabel, translatedLabel)) {
    return {
      vetoed: true,
      reason: `🚫 OVERSÆTTELSE VETO: "${originalLabel}" -> "${translatedLabel}" er semantisk umulig`
    };
  }
  
  // Ultra-generic term veto if high-confidence specific terms exist
  const isUltraGeneric = semanticCategories.ultraGeneric.includes(originalLabel.toLowerCase()) ||
                         semanticCategories.ultraGeneric.includes(translatedLabel.toLowerCase());
  
  if (isUltraGeneric && globalContext.includes('animals')) {
    return {
      vetoed: true,
      reason: `🚫 GENERISK VETO: Generisk term "${translatedLabel}" blokeret når dyr er identificeret`
    };
  }
  
  return { vetoed: false };
};

// Phase 3C: Intelligent search term generation with multi-stage filtering
const getSearchTerms = (label: VisionLabel, semanticContext: string[]): { terms: string[]; confidence: number; reasoning: string } => {
  const labelCategories = getSemanticCategory(label);
  let reasoning = `Analyserer "${label.description}" (kategorier: ${labelCategories.join(',')})`;
  
  // STAGE 1: Semantic veto check
  const vetoCheck = semanticVeto(label.description, label.translatedText || '', labelCategories, semanticContext);
  if (vetoCheck.vetoed) {
    return { terms: [], confidence: 0, reasoning: vetoCheck.reason || 'Vetoed' };
  }
  
  const searchTerms: string[] = [];
  let confidenceMultiplier = 1.0;
  
  // STAGE 2: Translation validation and processing
  if (label.translatedText) {
    const translationValid = validateTranslation(label.description, label.translatedText);
    if (translationValid) {
      searchTerms.push(label.translatedText);
      const words = label.translatedText.split(' ').filter(word => word.length > 2);
      searchTerms.push(...words);
      reasoning += `, bruger valideret oversættelse: "${label.translatedText}"`;
    } else {
      confidenceMultiplier *= 0.2; // Heavy penalty for invalid translations
      reasoning += `, oversættelse "${label.translatedText}" er ugyldig`;
    }
  }
  
  // STAGE 3: Semantic similarity threshold check
  const minSemanticSimilarity = 0.7;
  const englishTerm = label.description.toLowerCase();
  
  // Enhanced fallback processing with semantic scoring
  for (const [category, terms] of Object.entries(categoryFallbacks)) {
    if (englishTerm.includes(category)) {
      const categorySemanticScore = labelCategories.includes(category) ? 1.0 : 0.5;
      
      if (categorySemanticScore >= minSemanticSimilarity) {
        searchTerms.push(...terms);
        reasoning += `, tilføjet fallback termer for ${category}`;
      } else {
        reasoning += `, sprang ${category} fallback over (lav semantisk score: ${categorySemanticScore})`;
      }
    }
  }
  
  // Apply confidence degradation if label was processed
  if (label.degradedScore !== undefined) {
    confidenceMultiplier *= label.contextualRelevance || 1.0;
    reasoning += `, degraderet confidence: ${Math.round((label.contextualRelevance || 1) * 100)}%`;
  }
  
  const finalTerms = [...new Set(searchTerms.filter(term => term.trim().length > 0))];
  const finalConfidence = Math.max(0.1, confidenceMultiplier);
  
  return { 
    terms: finalTerms, 
    confidence: finalConfidence,
    reasoning: reasoning + ` -> ${finalTerms.length} søgetermer med confidence ${Math.round(finalConfidence * 100)}%`
  };
};

// Phase 3C: Revolutionary database search with semantic similarity gates
const searchDatabase = async (searchResult: { terms: string[]; confidence: number }, semanticCategories: string[]) => {
  const allMatches = [];
  const searchTerms = searchResult.terms;
  
  // Minimum semantic similarity threshold
  const minSemanticSimilarity = 0.7;
  
  if (searchTerms.length === 0) {
    return { matches: [], searchQuality: 'blocked' };
  }
  
  for (const term of searchTerms) {
    // Enhanced Strategy 1: Direct name match with semantic validation
    const { data: nameMatches } = await supabase
      .from('demo')
      .select('*')
      .ilike('navn', `%${term}%`);
    
    if (nameMatches?.length) {
      nameMatches.forEach(match => {
        const fuzzyScore = calculateFuzzyScore(term, match.navn);
        
        // Semantic coherence check for name matches
        const matchCategories = getSemanticCategory({ description: match.navn, score: 1.0 });
        const semanticCoherence = calculateSemanticCoherence(semanticCategories, matchCategories);
        
        if (semanticCoherence >= minSemanticSimilarity) {
          allMatches.push({ 
            ...match, 
            matchType: 'name', 
            matchTerm: term,
            fuzzyScore,
            semanticCoherence,
            exactMatch: match.navn.toLowerCase().includes(term.toLowerCase()),
            searchConfidence: searchResult.confidence
          });
        }
      });
    }
    
    // Enhanced Strategy 2: Synonym match with semantic validation
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
        
        // Category-locked search for animals/people
        if (semanticCategories.includes('animals') || semanticCategories.includes('people')) {
          const matchIsNonWaste = match.hjem === 'Ikke affald' || match.genbrugsplads === 'Ikke affald';
          if (!matchIsNonWaste) return; // Skip non-matching categories
        }
        
        allMatches.push({ 
          ...match, 
          matchType: 'synonym', 
          matchTerm: term,
          fuzzyScore: bestSynonymScore,
          semanticCoherence: 0.8, // Default for synonym matches
          exactMatch: synonyms.some(syn => syn.toLowerCase().includes(term.toLowerCase())),
          searchConfidence: searchResult.confidence
        });
      });
    }
    
    // Enhanced Strategy 3: Material match with aggressive filtering
    if (!semanticCategories.includes('animals') && !semanticCategories.includes('people')) {
      const { data: materialMatches } = await supabase
        .from('demo')
        .select('*')
        .ilike('materiale', `%${term}%`);
      
      if (materialMatches?.length) {
        materialMatches.forEach(match => {
          const fuzzyScore = calculateFuzzyScore(term, match.materiale || '');
          allMatches.push({ 
            ...match, 
            matchType: 'material', 
            matchTerm: term,
            fuzzyScore,
            semanticCoherence: 0.6, // Lower for material matches
            exactMatch: match.materiale?.toLowerCase().includes(term.toLowerCase()),
            searchConfidence: searchResult.confidence
          });
        });
      }
    }
    
    // Enhanced Strategy 4: Variation match with confidence weighting
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
          semanticCoherence: 0.7, // Medium for variation matches
          exactMatch: match.variation?.toLowerCase().includes(term.toLowerCase()),
          searchConfidence: searchResult.confidence
        });
      });
    }
  }
  
  return { 
    matches: allMatches, 
    searchQuality: allMatches.length > 0 ? 'good' : 'no_matches'
  };
};

// Phase 3C: Semantic coherence scoring between categories
const calculateSemanticCoherence = (sourceCategories: string[], targetCategories: string[]): number => {
  if (sourceCategories.length === 0 || targetCategories.length === 0) return 0.5;
  
  // Perfect match
  const intersection = sourceCategories.filter(cat => targetCategories.includes(cat));
  if (intersection.length > 0) return 1.0;
  
  // Check for critical incompatibilities
  for (const [cat1, cat2] of incompatibleCategories) {
    if ((sourceCategories.includes(cat1) && targetCategories.includes(cat2)) ||
        (sourceCategories.includes(cat2) && targetCategories.includes(cat1))) {
      return 0.0; // Complete incompatibility
    }
  }
  
  // Related categories (materials + containers, organic + food, etc.)
  const relatedPairs = [
    ['materials', 'containers'],
    ['organic', 'containers'],
    ['electronics', 'materials']
  ];
  
  for (const [cat1, cat2] of relatedPairs) {
    if ((sourceCategories.includes(cat1) && targetCategories.includes(cat2)) ||
        (sourceCategories.includes(cat2) && targetCategories.includes(cat1))) {
      return 0.8; // High compatibility
    }
  }
  
  return 0.3; // Neutral/unknown compatibility
};

// Phase 3D: Intelligent ensemble scoring with context awareness
const calculateMatchScore = (match: any, visionLabel: VisionLabel, semanticCategories: string[]): number => {
  // Base score from degraded vision confidence
  const baseVisionScore = visionLabel.degradedScore || visionLabel.score;
  let score = baseVisionScore * 100;
  
  // Apply search confidence from term generation
  score *= (match.searchConfidence || 1.0);
  
  // Enhanced match type multipliers with object detection priority
  const typeMultipliers = {
    'name': visionLabel.type === 'object' ? 2.0 : 1.3,     // 5x boost for object names
    'synonym': visionLabel.type === 'object' ? 1.8 : 1.2,  // Strong boost for object synonyms
    'variation': 1.1,
    'material': 0.6  // Reduced material match weight
  };
  
  score *= (typeMultipliers[match.matchType] || 1.0);
  
  // Semantic coherence is now critical
  const semanticScore = match.semanticCoherence || calculateSemanticCoherence(semanticCategories, []);
  score *= (0.3 + (semanticScore * 0.7)); // 70% weight on semantic coherence
  
  // Fuzzy match quality bonus (reduced weight)
  score *= (0.8 + (match.fuzzyScore * 0.2));
  
  // Exact match bonus
  if (match.exactMatch) {
    score *= 1.15;
  }
  
  // Context-aware penalties
  const contextualRelevance = visionLabel.contextualRelevance || 1.0;
  score *= contextualRelevance;
  
  // Final semantic veto check - completely block impossible matches
  const finalVeto = semanticVeto(visionLabel.description, visionLabel.translatedText || '', semanticCategories, []);
  if (finalVeto.vetoed) {
    score = 0; // Complete elimination
  }
  
  return Math.max(0, score);
};

// Phase 3E: Enhanced match quality metrics
const calculateMatchQuality = (score: number, semanticCoherence: number, searchQuality: string): 'excellent' | 'good' | 'fair' | 'poor' => {
  if (score > 80 && semanticCoherence > 0.8 && searchQuality === 'good') return 'excellent';
  if (score > 60 && semanticCoherence > 0.6) return 'good';
  if (score > 40 && semanticCoherence > 0.4) return 'fair';
  return 'poor';
};

export const identifyWaste = async (imageData: string): Promise<WasteItem> => {
  try {
    // PHASE 3: COMPLETE AI OVERHAUL PIPELINE
    console.log('🚀 Phase 3 AI Pipeline Started');
    
    // STEP 1: VISUAL ANALYSIS with enhanced processing
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

    // STEP 2: VISION CONFIDENCE DEGRADATION (Phase 3A)
    const rawLabels = visionData.labels.slice(0, 5);
    const degradedLabels = rawLabels.map(degradeVisionConfidence);
    
    console.log('🔧 Vision confidence degradation applied:', degradedLabels.map(l => 
      `${l.description}: ${(l.score * 100).toFixed(1)}% -> ${((l.degradedScore || l.score) * 100).toFixed(1)}%`
    ));

    // STEP 3: ENHANCED SEMANTIC VALIDATION (Phase 3A)
    const semanticValidation = validateSemanticCompatibility(degradedLabels);
    const globalSemanticContext = degradedLabels.flatMap(label => getSemanticCategory(label));
    
    let aiThoughtProcess = `🔍 PHASE 3 ANALYSE: Processet ${degradedLabels.length} labels med confidence degradation. `;
    
    if (!semanticValidation.compatible) {
      aiThoughtProcess += `${semanticValidation.reason}. `;
      console.warn(`⚠️ ${semanticValidation.severity.toUpperCase()}: ${semanticValidation.reason}`);
    }

    // STEP 4: OBJECT-CENTRIC PRIORITIZATION (Phase 3A) 
    const objectLabels = degradedLabels.filter(l => l.type === 'object');
    const generalLabels = degradedLabels.filter(l => l.type !== 'object');
    
    // 5x prioritization: objects first, then highest degraded confidence
    const prioritizedLabels = [
      ...objectLabels.sort((a, b) => (b.degradedScore || b.score) - (a.degradedScore || a.score)),
      ...generalLabels.sort((a, b) => (b.degradedScore || b.score) - (a.degradedScore || a.score))
    ];

    // STEP 5: INTELLIGENT MATCHING PIPELINE
    let bestMatch = null;
    let bestScore = 0;
    let bestMatchQuality = 'poor';
    const processedLabels = new Set();
    const allMatches = [];

    const primaryLabel = prioritizedLabels[0];
    const identifiedObject = primaryLabel?.description || 'ukendt genstand';
    const primarySemanticCategories = getSemanticCategory(primaryLabel);
    
    aiThoughtProcess += `Primære objekt: "${identifiedObject}" (type: ${primaryLabel?.type || 'unknown'}, kategorier: ${primarySemanticCategories.join(', ')}, degraderet score: ${((primaryLabel?.degradedScore || primaryLabel?.score || 0) * 100).toFixed(1)}%). `;

    // Process each label through the enhanced pipeline
    for (const label of prioritizedLabels) {
      const englishTerm = label.description.toLowerCase();
      
      if (processedLabels.has(englishTerm)) continue;
      processedLabels.add(englishTerm);
      
      const labelSemanticCategories = getSemanticCategory(label);
      
      // STEP 5A: INTELLIGENT SEARCH TERM GENERATION (Phase 3C)
      const searchResult = getSearchTerms(label, globalSemanticContext);
      
      aiThoughtProcess += searchResult.reasoning + '. ';
      
      if (searchResult.terms.length === 0) {
        console.log(`🚫 Completely blocked: "${label.description}"`);
        continue;
      }
      
      console.log(`🔍 Enhanced search for "${label.description}":`, searchResult);
      
      // STEP 5B: REVOLUTIONARY DATABASE SEARCH (Phase 3C)
      const searchResults = await searchDatabase(searchResult, globalSemanticContext);
      
      if (searchResults.matches.length > 0) {
        console.log(`📊 Found ${searchResults.matches.length} matches with quality: ${searchResults.searchQuality}`);
        
        // STEP 5C: INTELLIGENT SCORING (Phase 3D)
        for (const match of searchResults.matches) {
          const matchScore = calculateMatchScore(match, label, globalSemanticContext);
          const matchQuality = calculateMatchQuality(matchScore, match.semanticCoherence || 0, searchResults.searchQuality);
          
          match.finalScore = matchScore;
          match.sourceLabel = label.description;
          match.semanticCategories = labelSemanticCategories;
          match.matchQuality = matchQuality;
          allMatches.push(match);
          
          console.log(`📈 Match "${match.navn}": score=${Math.round(matchScore)}%, quality=${matchQuality}, coherence=${(match.semanticCoherence || 0).toFixed(2)}`);
          
          // Select best match based on score AND quality
          if (matchScore > bestScore || (matchScore >= bestScore * 0.9 && matchQuality > bestMatchQuality)) {
            bestScore = matchScore;
            bestMatch = match;
            bestMatchQuality = matchQuality;
          }
        }
      } else {
        aiThoughtProcess += `Ingen database matches for "${label.description}". `;
      }
    }

    // STEP 6: FINAL QUALITY CONTROL AND OUTPUT (Phase 3E)
    const minimumThreshold = semanticValidation.severity === 'critical' ? 60 : 35;
    
    if (bestMatch && bestScore > minimumThreshold) {
      console.log(`🎯 FINAL RESULT: "${bestMatch.navn}" (score: ${Math.round(bestScore)}%, quality: ${bestMatchQuality})`);
      
      aiThoughtProcess += `🎯 RESULTAT: Identificeret "${bestMatch.navn}" via ${bestMatch.matchType} match. Score: ${Math.round(bestScore)}% (quality: ${bestMatchQuality}), semantisk coherence: ${((bestMatch.semanticCoherence || 0) * 100).toFixed(1)}%. `;
      
      // Conservative confidence scoring for transparency
      let finalConfidence = Math.min(bestScore, 85); // Lower max confidence
      
      if (semanticValidation.severity === 'critical') {
        finalConfidence *= 0.7; // Reduce confidence for critical semantic issues
        aiThoughtProcess += `Semantisk konflikt detekteret - confidence reduceret til ${Math.round(finalConfidence)}%. `;
      }
      
      if (bestMatchQuality === 'poor' || bestMatchQuality === 'fair') {
        finalConfidence *= 0.8; // Reduce confidence for poor quality matches
        aiThoughtProcess += `Match quality ${bestMatchQuality} - confidence justeret. `;
      }
      
      return {
        id: Date.now().toString(),
        name: bestMatch.navn,
        image: imageData,
        homeCategory: bestMatch.hjem || 'Restaffald',
        recyclingCategory: bestMatch.genbrugsplads || 'Restaffald',
        description: bestMatch.variation || bestMatch.navn,
        confidence: Math.round(Math.max(15, finalConfidence)), // Minimum 15% confidence
        timestamp: new Date(),
        aiThoughtProcess: aiThoughtProcess + `💡 KONKLUSION: Phase 3 pipeline gennemført med multi-stage validering og intelligent scoring.`
      };
    }

    // STEP 7: ENHANCED FALLBACK WITH CONTEXTUAL INTELLIGENCE
    console.log('🔄 No suitable matches found, applying intelligent fallback');
    
    aiThoughtProcess += `❌ Ingen acceptable matches (threshold: ${minimumThreshold}%). `;
    
    // Smart fallback based on semantic analysis
    const isLikelyNonWaste = globalSemanticContext.includes('animals') || globalSemanticContext.includes('people');
    const hasHighConfidenceAnimal = degradedLabels.some(l => 
      getSemanticCategory(l).includes('animals') && (l.degradedScore || l.score) > 0.7
    );
    
    if (isLikelyNonWaste || hasHighConfidenceAnimal) {
      aiThoughtProcess += `🔬 INTELLIGENT FALLBACK: Høj confidence dyr/person detekteret -> "Ikke affald". `;
      
      return {
        id: Date.now().toString(),
        name: 'Ikke affald',
        image: imageData,
        homeCategory: 'Ikke affald',
        recyclingCategory: 'Ikke affald',
        description: 'Dette er ikke affald og skal ikke sorteres. Genstand identificeret som levende væsen eller ikke-affald.',
        confidence: hasHighConfidenceAnimal ? 90 : 75,
        timestamp: new Date(),
        aiThoughtProcess: aiThoughtProcess + `💡 SMART FALLBACK: Semantisk analyse identificerede ikke-affald med høj sikkerhed.`
      };
    }
    
    // Standard fallback for unclear items
    const fallback = fallbackItems[0];
    aiThoughtProcess += `📋 Standard fallback anvendt - ingen klar kategorisering mulig. `;
    
    return {
      id: Date.now().toString(),
      name: fallback.name,
      image: imageData,
      homeCategory: fallback.homeCategory,
      recyclingCategory: fallback.recyclingCategory,
      description: fallback.description + ' Genstanden kunne ikke identificeres præcist af AI-systemet.',
      confidence: 20, // Very low confidence for unclear items
      timestamp: new Date(),
      aiThoughtProcess: aiThoughtProcess + `⚠️ KONSERVATIV FALLBACK: Utilstrækkelig information til sikker klassificering.`
    };

  } catch (error) {
    console.error('💥 Error in Phase 3 AI Pipeline:', error);
    
    return {
      id: Date.now().toString(),
      name: 'Analyse fejl',
      image: imageData,
      homeCategory: 'Restaffald',
      recyclingCategory: 'Restaffald',
      description: 'Der opstod en teknisk fejl under AI-analysen. Prøv at tage et nyt billede eller kontakt support hvis problemet fortsætter.',
      confidence: 0,
      timestamp: new Date(),
      aiThoughtProcess: `🚨 KRITISK FEJL i Phase 3 pipeline: ${error instanceof Error ? error.message : 'Ukendt systemfejl'}`
    };
  }
};