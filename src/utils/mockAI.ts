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
    
    // Step 1: Get vision analysis with detailed logging
    console.log('📸 Calling vision-proxy edge function...');
    const { data: visionData, error: visionError } = await supabase.functions.invoke('vision-proxy', {
      body: { image: imageData }
    });

    console.log('📡 Vision response received:', {
      hasData: !!visionData,
      hasError: !!visionError,
      success: visionData?.success,
      labelsCount: visionData?.labels?.length || 0
    });

    if (visionError) {
      console.error('❌ Vision error:', visionError);
      throw new Error(`Gemini API fejl: ${visionError.message || 'Ukendt fejl'}`);
    }

    if (!visionData?.success) {
      console.error('❌ Vision data unsuccessful:', visionData);
      throw new Error(`Analyse fejlede: ${visionData?.error || 'Ukendt fejl'}`);
    }

    const labels = visionData.labels || [];
    console.log('🏷️ Vision labels extracted:', labels.map(l => ({
      description: l.description,
      materiale: l.materiale,
      score: l.score
    })));
    
    if (!labels.length) {
      console.error('❌ No labels found in vision response');
      throw new Error('Ingen komponenter fundet i billedet');
    }

    // Step 2: Search database for matches with enhanced logging
    console.log('🔍 About to search database with labels:', labels.map(l => `${l.description} (${l.materiale})`));
    const dbMatches = await findBestMatches(labels);
    console.log('✅ Database search completed. Matches found:', dbMatches.length);
    console.log('📋 RAW GEMINI LABELS:', JSON.stringify(labels, null, 2));
    
    if (dbMatches.length > 0) {
      console.log('📊 Database matches details:', dbMatches.map(m => ({
        id: m.id,
        navn: m.navn,
        synonymer: m.synonymer?.substring(0, 100) + '...',
        materiale: m.materiale
      })));
    } else {
      console.log('❌ No database matches found - will use AI categorization');
    }
    
    let bestMatch = null;
    let confidence = 0;
    let primaryLabel = labels[0];

    // Smart logic to determine the main item vs components - IMPROVED MIXED ITEM HANDLING
    console.log('🔍 ANALYZING MIXED ITEMS - All labels:', labels.map(l => `${l.description} (${l.materiale})`));
    
    if (labels.length > 1) {
      // Group items by type for better analysis
      const organicItems = labels.filter(label => 
        label.materiale === 'organisk' || 
        (label.description && (
          label.description.toLowerCase().includes('appelsin') ||
          label.description.toLowerCase().includes('frugt') ||
          label.description.toLowerCase().includes('grøntsag') ||
          label.description.toLowerCase().includes('mad')
        ))
      );
      
      const packagingItems = labels.filter(label => 
        label.materiale === 'plastik' || 
        (label.description && (
          label.description.toLowerCase().includes('plastik') ||
          label.description.toLowerCase().includes('folie') ||
          label.description.toLowerCase().includes('pose') ||
          label.description.toLowerCase().includes('net')
        ))
      );

      console.log(`📊 ITEM ANALYSIS: ${organicItems.length} organic items, ${packagingItems.length} packaging items`);
      console.log('🍊 Organic items:', organicItems.map(i => i.description));
      console.log('📦 Packaging items:', packagingItems.map(i => i.description));

      // Determine primary item based on context
      if (organicItems.length > 0 && packagingItems.length > 0) {
        // Mixed scenario: food with packaging
        console.log('🥡 MIXED SCENARIO: Food with packaging detected');
        primaryLabel = organicItems[0]; // Prioritize food as primary
        
        // But we should note that there are multiple item types
        console.log(`🎯 PRIMARY ITEM: ${primaryLabel.description} (${primaryLabel.materiale})`);
      }
      else if (organicItems.length > 1) {
        // Multiple food items, take the highest confidence one
        primaryLabel = organicItems.reduce((highest, current) => 
          current.score > highest.score ? current : highest
        );
        console.log('🍎 MULTIPLE FOOD ITEMS: Using highest confidence:', primaryLabel.description);
      }
      else if (packagingItems.length > 1) {
        // Multiple packaging items
        primaryLabel = packagingItems.reduce((highest, current) => 
          current.score > highest.score ? current : highest
        );
        console.log('📦 MULTIPLE PACKAGING ITEMS: Using highest confidence:', primaryLabel.description);
      }
      else {
      // General case: multiple items, none are food/packaging combinations
      console.log('🔧 GENERAL MULTIPLE ITEMS: Selecting best primary item');
      
      // Simplified logic: just pick the highest confidence item
      const sortedByConfidence = [...labels].sort((a, b) => b.score - a.score);
      console.log('📊 Items by confidence:', sortedByConfidence.map(l => `${l.description} (${l.score})`));
      
      // Special rule: for electronic items, prefer the main device over accessories
      const mainDevices = sortedByConfidence.filter(label => {
        const desc = label.description.toLowerCase();
        return !desc.includes('etui') && !desc.includes('oplader') && !desc.includes('kabel') && !desc.includes('stik') && !desc.includes('case') && !desc.includes('holder');
      });
      
      console.log('🎯 Main devices found:', mainDevices.map(d => d.description));
      console.log('🎯 Accessories found:', sortedByConfidence.filter(label => {
        const desc = label.description.toLowerCase();
        return desc.includes('etui') || desc.includes('oplader') || desc.includes('kabel') || desc.includes('stik') || desc.includes('case') || desc.includes('holder');
      }).map(d => d.description));
      
      if (mainDevices.length > 0) {
        primaryLabel = mainDevices[0];
        console.log('🎯 SELECTED MAIN DEVICE as primary:', primaryLabel.description);
      } else {
        primaryLabel = sortedByConfidence[0];
        console.log('🎯 SELECTED HIGHEST CONFIDENCE as primary:', primaryLabel.description);
      }
      }
    } else {
      console.log('📝 SINGLE ITEM DETECTED:', primaryLabel.description);
    }

    console.log(`🎯 PRIMARY ITEM SELECTED: "${primaryLabel.description}" (material: ${primaryLabel.materiale}, score: ${primaryLabel.score})`);
    console.log(`📊 ALL ITEMS FOR CONTEXT:`, labels.map(l => `${l.description} (${l.materiale}, score: ${l.score})`));

    if (dbMatches.length > 0) {
      // Find best match that corresponds to our primary label, including synonym matching
      console.log('🔍 SEARCHING FOR BEST DB MATCH for primary item:', primaryLabel.description);
      console.log('🔍 Available database matches:', dbMatches.map(m => `${m.navn} (variation: ${m.variation}, id: ${m.id})`));
      
      bestMatch = dbMatches.find(match => {
        const matchName = match.navn.toLowerCase();
        const labelDesc = primaryLabel.description.toLowerCase();
        const matchSynonyms = (match.synonymer || '').toLowerCase();
        
        console.log(`🔍 MATCHING: Comparing "${labelDesc}" against "${matchName}" (synonyms: "${matchSynonyms.substring(0, 50)}...", variation: "${match.variation || ''}")`);
        
        // Special matching for compound terms (e.g., "trykimprægneret træbjælke")
        if (labelDesc.includes('trykimprægneret') || labelDesc.includes('imprægneret')) {
          const coreItem = labelDesc.replace(/trykimprægneret\s*træ?/, '').replace(/imprægneret\s*træ?/, '').replace(/træ/, '').trim();
          console.log(`🔍 COMPOUND ANALYSIS: Core item extracted: "${coreItem}" from "${labelDesc}"`);
          console.log(`🔍 COMPOUND CHECK: Does "${matchName}" match core "${coreItem}"? ${matchName === coreItem || matchName.includes(coreItem)}`);
          console.log(`🔍 COMPOUND CHECK: Does variation contain "imprægneret"? ${match.variation?.toLowerCase().includes('imprægneret')}`);
          
          if ((matchName === coreItem || matchName.includes(coreItem)) && 
              match.variation?.toLowerCase().includes('imprægneret')) {
            console.log(`✅ COMPOUND TREATMENT MATCH: "${labelDesc}" matches ${matchName} with ${match.variation}`);
            return true;
          }
        }
        
        // Special case for scissors - exact match only to prevent hedge scissors confusion
        if (labelDesc === 'saks') {
          if (matchName === 'saks') {
            console.log(`✅ SCISSORS EXACT MATCH: "${labelDesc}" matches "${matchName}"`);
            return true;
          } else {
            console.log(`🚫 SCISSORS MISMATCH: "${labelDesc}" does not match "${matchName}"`);
            return false;
          }
        }
        
        // Generic matching - no special item logic
        
        // Direct name match
        if (matchName === labelDesc) {
          console.log(`✅ EXACT NAME MATCH: ${matchName} === ${labelDesc}`);
          return true;
        }
        
        // Check if label description is in synonyms (exact match)
        const synonymWords = matchSynonyms.split(',').map(s => s.trim().toLowerCase());
        if (synonymWords.includes(labelDesc)) {
          console.log(`✅ EXACT SYNONYM MATCH: Found "${labelDesc}" in synonyms of ${matchName}`);
          return true;
        }
        
        // Partial synonym match
        if (matchSynonyms.includes(labelDesc)) {
          console.log(`✅ PARTIAL SYNONYM MATCH: Found "${labelDesc}" in synonyms of ${matchName}`);
          return true;
        }
        
        // Intelligent partial matching - avoid substring issues
        const isPartialMatch = matchName.includes(labelDesc) || labelDesc.includes(matchName);
        if (isPartialMatch) {
          // For short words (≤4 chars), require exact word boundary matches to prevent substring issues
          if (labelDesc.length <= 4 || matchName.length <= 4) {
            const labelWords = labelDesc.split(/\s+/);
            const matchWords = matchName.split(/\s+/);
            const hasExactWordMatch = labelWords.some(word => matchWords.includes(word)) || 
                                    matchWords.some(word => labelWords.includes(word));
            
            if (!hasExactWordMatch) {
              console.log(`🚫 BLOCKED SUBSTRING MATCH: "${labelDesc}" vs "${matchName}" (short word requires exact word match)`);
              return false;
            }
          }
          
          console.log(`✅ PARTIAL NAME MATCH: ${matchName} <-> ${labelDesc}`);
          return true;
        }
        
        console.log(`❌ NO MATCH: ${matchName} vs ${labelDesc}`);
        return false;
      });
      
      // CRITICAL FIX: Don't use generic material matches if the specific item wasn't found
      if (!bestMatch) {
        console.log(`❌ NO SPECIFIC MATCH FOUND for "${primaryLabel.description}" in database matches`);
        console.log('🚫 Will NOT use generic material-based fallback - using AI detection instead');
        bestMatch = null; // Explicitly set to null to force AI categorization
      }
      
      if (bestMatch) {
        confidence = Math.round(primaryLabel.score * 100);
        console.log('Using database match:', bestMatch.navn);
      }
    } else {
      console.log('❌ Ingen database matches fundet - bruger AI kategorisering');
    }

    // Step 3: Build result from database or fallback to vision data
    if (bestMatch) {
      // Count identical items and create description - IMPROVED FOR MIXED ITEMS
      const primaryItemCount = labels.filter(label => label.description === primaryLabel.description).length;
      const hasMultipleItemTypes = new Set(labels.map(l => l.description)).size > 1;
      
      console.log(`📊 ITEM COUNT ANALYSIS: ${primaryItemCount} of "${primaryLabel.description}", ${hasMultipleItemTypes ? 'HAS' : 'NO'} mixed types`);
      
      let itemName;
      let itemDescription;
      
      if (hasMultipleItemTypes) {
        // Mixed items - describe the primary item but note there are components
        const uniqueItems = [...new Set(labels.map(l => l.description))];
        itemName = `${bestMatch.navn || primaryLabel.description} med emballage`;
        itemDescription = `${bestMatch.variation || bestMatch.navn || primaryLabel.description}${bestMatch.tilstand ? ` - ${bestMatch.tilstand}` : ''}. Indeholder: ${uniqueItems.join(', ')}.`;
        console.log(`🥡 MIXED ITEM DESCRIPTION: ${itemName}`);
      } else {
        // Single item type - use existing logic
        itemName = primaryItemCount > 1 ? `${bestMatch.navn || primaryLabel.description} (${primaryItemCount} stk.)` : bestMatch.navn || primaryLabel.description;
        itemDescription = `${bestMatch.variation || bestMatch.navn || primaryLabel.description}${bestMatch.tilstand ? ` - ${bestMatch.tilstand}` : ''}${primaryItemCount > 1 ? `. Indeholder ${primaryItemCount} styk.` : ''}`;
        console.log(`🍊 SINGLE ITEM DESCRIPTION: ${itemName}`);
      }
      
      // Get unique components - ENHANCED with individual database lookups
      const uniqueComponents = [];
      const componentMap = new Map();
      
      // First, search for database matches for each unique component
      const uniqueDescriptions = [...new Set(labels.map(l => l.description))];
      const componentSearchPromises = uniqueDescriptions.map(async (description: string) => {
        const componentMatches = await searchWasteInDatabase([description]);
        return { 
          description, 
          match: componentMatches.length > 0 ? (componentMatches[0] as any) : null 
        };
      });
      
      const componentMatches = await Promise.all(componentSearchPromises);
      const componentMatchMap = new Map<string, any>(componentMatches.map(cm => [cm.description, cm.match]));
      
      labels.forEach(label => {
        const key = `${label.description}-${label.materiale || ''}`;
        console.log(`🔧 PROCESSING LABEL: "${label.description}" with material "${label.materiale}" -> key: "${key}"`);
        
        if (!componentMap.has(key)) {
          const componentMatch = componentMatchMap.get(label.description);
          console.log(`🔍 DB MATCH for "${label.description}":`, componentMatch ? `Found: ${componentMatch.materiale}` : 'Not found');
          
          const finalMaterial = label.materiale || (componentMatch ? (componentMatch.materiale || 'Ukendt') : 'Ukendt');
          console.log(`🎯 FINAL MATERIAL for "${label.description}": "${finalMaterial}" (Gemini: "${label.materiale}", DB: "${componentMatch?.materiale || 'none'}")`);
          
          componentMap.set(key, {
            genstand: label.description,
            materiale: finalMaterial,
            tilstand: componentMatch ? (componentMatch.tilstand || '') : (label.tilstand || ''),
            count: 1,
            hasDbMatch: !!componentMatch
          });
        } else {
          componentMap.get(key).count++;
        }
      });
      
      console.log('🔍 DEBUG: ComponentMap keys:', [...componentMap.keys()]);
      
      uniqueComponents.push(...componentMap.values());
      
      console.log('🔧 COMPONENT BREAKDOWN:', uniqueComponents.map(c => `${c.genstand} x${c.count} (${c.materiale})`));

      console.log('🎯 FINAL COMPONENTS BEING SENT:', uniqueComponents.map(comp => ({
        genstand: comp.count > 1 ? `${comp.genstand} (${comp.count} stk.)` : comp.genstand,
        materiale: comp.materiale,
        tilstand: comp.tilstand
      })));

      // Use database data
      return {
        id: Date.now().toString(),
        name: itemName,
        image: imageData,
        homeCategory: bestMatch.hjem || 'Restaffald',
        recyclingCategory: bestMatch.genbrugsplads || 'Restaffald',
        description: itemDescription,
        confidence: confidence,
        timestamp: new Date(),
        aiThoughtProcess: `Database match: ${bestMatch.navn} identificeret med ${Math.round(confidence)}% sikkerhed${hasMultipleItemTypes ? '. Blandet indhold detekteret.' : primaryItemCount > 1 ? `. Detekteret ${primaryItemCount} identiske genstande.` : ''}`,
        components: uniqueComponents.map(comp => ({
          genstand: comp.count > 1 ? `${comp.genstand} (${comp.count} stk.)` : comp.genstand,
          materiale: comp.materiale,
          tilstand: comp.tilstand
        }))
      };
    } else {
      // Fallback to basic categorization from vision data
      console.log('🔧 FALLBACK MODE: Ikke fundet i databasen - bruger AI kategorisering');
      
      // Enhanced material-based categorization with special item handling
      
      // Special handling for optical items (glasses, etc.)
      const isOpticalItem = primaryLabel.description?.toLowerCase().includes('brille') ||
                           primaryLabel.description?.toLowerCase().includes('linse') ||
                           primaryLabel.description?.toLowerCase().includes('optisk');
      
      let homeCategory, recyclingCategory;
      
      if (isOpticalItem) {
        // Glasses frames are typically metal or plastic - determine material
        if (primaryLabel.materiale === 'metal' || 
            primaryLabel.description?.toLowerCase().includes('metal') ||
            primaryLabel.description?.toLowerCase().includes('stål') ||
            primaryLabel.description?.toLowerCase().includes('titanium')) {
          homeCategory = 'Metal';
          recyclingCategory = 'Metal';
        } else {
          // Default to plastic for glasses frames if material uncertain
          homeCategory = 'Plast';
          recyclingCategory = 'Hård plast';
        }
      } else if (primaryLabel.materiale === 'pant' || 
                 primaryLabel.description?.toLowerCase().includes('pant') ||
                 (primaryLabel.description?.toLowerCase().includes('flaske') && 
                  (primaryLabel.description?.toLowerCase().includes('coca') || 
                   primaryLabel.description?.toLowerCase().includes('øl') ||
                   primaryLabel.description?.toLowerCase().includes('vand'))) ||
                 (primaryLabel.description?.toLowerCase().includes('dåse') && 
                  (primaryLabel.description?.toLowerCase().includes('øl') || 
                   primaryLabel.description?.toLowerCase().includes('cola')))) {
        // Pant (deposit bottles/cans) - very important category
        homeCategory = 'Pant (returneres i butik)';
        recyclingCategory = 'Pant (returneres i butik)';
      } else {
        // When not found in database, don't provide AI sorting suggestions
        homeCategory = 'Ikke fundet i databasen';
        recyclingCategory = 'Ikke fundet i databasen';
      }

      // Count identical items and create description
      const itemCount = labels.filter(label => label.description === primaryLabel.description).length;
      const itemName = itemCount > 1 ? `${primaryLabel.description} (${itemCount} stk.)` : primaryLabel.description;
      
      // Get all unique components for detailed sorting instructions
      const uniqueComponents = [];
      const componentMap = new Map();
      
      labels.forEach(label => {
        const key = `${label.description}-${label.materiale || 'ukendt'}`;
        console.log(`🔧 CREATING COMPONENT: "${label.description}" with material "${label.materiale}" -> key: "${key}"`);
        
        if (!componentMap.has(key)) {
          componentMap.set(key, {
            genstand: label.description,
            materiale: label.materiale || 'Ukendt',
            tilstand: label.tilstand,
            count: 1
          });
        } else {
          componentMap.get(key).count++;
        }
      });
      
      uniqueComponents.push(...componentMap.values());

      console.log('🔧 FALLBACK COMPONENT BREAKDOWN:', uniqueComponents.map(c => `${c.genstand} x${c.count} (${c.materiale})`));
      
      console.log('🎯 FALLBACK FINAL COMPONENTS BEING SENT:', uniqueComponents.map(comp => ({
        genstand: comp.count > 1 ? `${comp.genstand} (${comp.count} stk.)` : comp.genstand,
        materiale: comp.materiale,
        tilstand: comp.tilstand
      })));

      return {
        id: Date.now().toString(),
        name: itemName,
        image: imageData,
        homeCategory: homeCategory,
        recyclingCategory: recyclingCategory,
        description: `${primaryLabel.description}${itemCount > 1 ? ` - ${itemCount} stk. detekteret` : ''} - Ikke fundet i databasen`,
        confidence: Math.round(primaryLabel.score * 100),
        timestamp: new Date(),
        aiThoughtProcess: `AI-baseret analyse: Genstand genkendt som ${primaryLabel.description} med ${Math.round(primaryLabel.score * 100)}% sikkerhed${itemCount > 1 ? `. Detekteret ${itemCount} identiske genstande` : ''}. Ikke fundet i databasen - bruger AI kategorisering.`,
        components: uniqueComponents.map(comp => ({
          genstand: comp.count > 1 ? `${comp.genstand} (${comp.count} stk.)` : comp.genstand,
          materiale: comp.materiale || 'Ukendt',
          tilstand: comp.tilstand
        }))
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
      aiThoughtProcess: `Analyse fejl: ${error instanceof Error ? error.message : 'Teknisk problem under billedbehandling'}`
    };
  }
};
