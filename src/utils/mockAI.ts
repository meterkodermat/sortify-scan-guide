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

// Search database for waste item matches with comprehensive search
const searchWasteInDatabase = async (searchTerms: string[]): Promise<any[]> => {
  if (!searchTerms.length) return [];

  try {
    console.log(`🔍 Starting database search with terms:`, searchTerms);
    
    // First, try searching for exact multi-word phrases (like "blød plast")
    const exactPhrasePromises = searchTerms
      .filter(term => term.includes(' ')) // Only multi-word terms
      .map(async (phrase) => {
        const cleanPhrase = phrase.toLowerCase().trim();
        console.log(`🎯 Searching for exact phrase: "${cleanPhrase}"`);
        
        const { data, error } = await supabase
          .from('demo')
          .select('*')
          .or(`navn.ilike.%${cleanPhrase}%,synonymer.ilike.%${cleanPhrase}%,variation.ilike.%${cleanPhrase}%,materiale.ilike.%${cleanPhrase}%`)
          .limit(20);
          
        if (!error && data?.length) {
          console.log(`✅ Found exact phrase matches for "${cleanPhrase}":`, data.map(item => item.navn));
          return data;
        }
        return [];
      });
    
    // Then search for individual terms
    const searchPromises = searchTerms.map(async (term) => {
      const cleanTerm = term.toLowerCase().trim();
      if (cleanTerm.length < 2) return [];

      console.log(`🔍 Searching database for term: "${cleanTerm}"`);

      const { data, error } = await supabase
        .from('demo')
        .select('*')
        .or(`navn.ilike.%${cleanTerm}%,synonymer.ilike.%${cleanTerm}%,variation.ilike.%${cleanTerm}%,materiale.ilike.%${cleanTerm}%`)
        .limit(20);

      // Special search for "blød plast" and "hård plast"
      let extraData = [];
      if (cleanTerm === 'blød' || cleanTerm.includes('blød')) {
        console.log(`🎯 Special search for blød plast items`);
        const { data: softPlasticData, error: softError } = await supabase
          .from('demo')
          .select('*')
          .or(`materiale.ilike.%blød%,synonymer.ilike.%blød plast%,navn.ilike.%blød%`)
          .limit(20);
        
        if (!softError && softPlasticData) {
          console.log(`Found soft plastic matches:`, softPlasticData.map(item => item.navn));
          extraData = softPlasticData;
        }
      }
      
      // Also search for common plastic combinations if searching for plastic
      if (cleanTerm.includes('plast') || cleanTerm.includes('plastik')) {
        console.log(`🎯 Special plastic search for: "${cleanTerm}"`);
        const { data: plasticData, error: plasticError } = await supabase
          .from('demo')
          .select('*')
          .or(`materiale.ilike.%plast%,materiale.ilike.%plastik%,materiale.ilike.%PVC%`)
          .limit(20);
        
        if (!plasticError && plasticData) {
          extraData = [...extraData, ...plasticData];
        }
      }

      if (error) {
        console.error('Database search error for term:', cleanTerm, error);
        return [];
      }

      console.log(`Found ${data?.length || 0} results for "${cleanTerm}":`, data?.map(item => item.navn));
      
      // Combine regular results with plastic results
      const combinedData = [...(data || []), ...extraData];
      return combinedData || [];
    });

    // Execute all searches in parallel
    const [exactPhraseResults, termResults] = await Promise.all([
      Promise.all(exactPhrasePromises),
      Promise.all(searchPromises)
    ]);
    
    const allResults = [...exactPhraseResults.flat(), ...termResults.flat()];
    
    // Remove duplicates and score results
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    );

    console.log(`🎯 Total unique results found: ${uniqueResults.length}`);

    // Sort by relevance - prioritize specific matches over generic categories
    return uniqueResults.sort((a, b) => {
      // Calculate specificity scores
      const getSpecificityScore = (item, terms) => {
        const itemName = item.navn.toLowerCase();
        const itemSynonyms = (item.synonymer || '').toLowerCase();
        let score = 0;
        
        for (const term of terms) {
          if (!term) continue;
          const cleanTerm = term.toLowerCase();
          
          // Exact synonym match gets highest score (for "blød plast" matches)
          if (itemSynonyms.includes(cleanTerm)) score += 100;
          // Exact name match gets high score
          else if (itemName === cleanTerm) score += 90;
          // Specific item name contains search term
          else if (itemName.includes(cleanTerm)) score += 50;
          // Avoid generic matches for specific items
          else if (itemName === 'frugt' && cleanTerm === 'appelsin') score -= 50;
          else if (itemName === 'mad' && cleanTerm.length > 3) score -= 30;
          // Material matches
          else if (item.materiale && item.materiale.toLowerCase().includes(cleanTerm)) score += 25;
        }
        
        return score;
      };
      
      const aScore = getSpecificityScore(a, searchTerms);
      const bScore = getSpecificityScore(b, searchTerms);
      
      console.log(`Scoring: ${a.navn} = ${aScore}, ${b.navn} = ${bScore}`);
      
      return bScore - aScore; // Higher score first
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
    
    // Include alternative names if available
    if (label.navne && Array.isArray(label.navne)) {
      terms.push(...label.navne);
    }
    
    // Also search for specific object + material combinations
    if (label.materiale && label.description) {
      const combination = `${label.description} ${label.materiale}`;
      terms.push(combination);
      console.log(`🔗 Adding material combination: "${combination}"`);
    }
    
        // If we only have material, add common objects of that material type
        if (label.materiale && !label.description) {
          const materialTerms = {
            'elektronik': ['mobiltelefon', 'computer', 'tv', 'batteri', 'elektronik'],
            'plastik': ['plastikflaske', 'pose', 'beholder', 'net', 'plastiknet', 'folie', 'bobleplast', 'blød plast', 'hård plast'],
            'blød plastik': ['pose', 'folie', 'net', 'bobleplast', 'plastikpose', 'blød plast'],
            'hård plastik': ['plastikflaske', 'beholder', 'æske', 'hård plast'],
            'pap': ['karton', 'æske', 'pizzaboks'],
            'glas': ['flaske', 'glas', 'krukke'],
            'metal': ['dåse', 'aluminium'],
            'farligt': ['batteri', 'maling', 'kemikalier'],
            'organisk': ['madaffald', 'frugt', 'grøntsager', 'æg'],
            'tekstil': ['tøj', 'sko', 'tekstil'],
            'træ': ['møbler', 'træ', 'plade']
          };
      
          if (materialTerms[label.materiale]) {
            terms.push(...materialTerms[label.materiale]);
            console.log(`🧱 Adding material-specific terms for "${label.materiale}":`, materialTerms[label.materiale]);
          }
        }
        
        // Add special terms if we detect "blød plast" specifically
        if (label.description && label.description.toLowerCase().includes('blød plast')) {
          console.log('🎯 Detected "blød plast", adding specific search terms');
          terms.push('blød plast', 'pose', 'folie', 'net', 'bobleplast', 'plastikpose', 'polyethylen', 'PE');
        }

        // Add special terms if we detect "hård plast" specifically  
        if (label.description && label.description.toLowerCase().includes('hård plast')) {
          console.log('🎯 Detected "hård plast", adding specific search terms');
          terms.push('hård plast', 'plastikflaske', 'beholder', 'æske');
        }
    
    return terms;
  });

  console.log('Search terms before filtering:', allSearchTerms);

  // Remove duplicates and clean terms - be more lenient with term length
  const uniqueTerms = [...new Set(allSearchTerms)]
    .filter(term => term && typeof term === 'string')
    .map(term => term.toLowerCase().trim())
    .filter(term => term.length >= 2); // Allow shorter terms like "tv", "pc"

  console.log('Final search terms:', uniqueTerms);

  const matches = await searchWasteInDatabase(uniqueTerms);
  console.log('Database search results:', matches);
  return matches;
};

export const identifyWaste = async (imageData: string): Promise<WasteItem> => {
  try {
    console.log('🚀 Starting waste identification process...');
    
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
    let primaryLabel = labels[0];

    // Smart logic to determine the main item vs components
    if (labels.length > 1) {
      // Check if we have food items with packaging - prioritize the food
      const foodItems = labels.filter(label => 
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

      // If we have food items with packaging, prioritize the food
      if (foodItems.length > 0 && packagingItems.length > 0) {
        primaryLabel = foodItems[0];
        console.log('Detected food with packaging, prioritizing food item:', primaryLabel.description);
      }
      // If we have multiple food items, take the highest confidence one
      else if (foodItems.length > 1) {
        primaryLabel = foodItems.reduce((highest, current) => 
          current.score > highest.score ? current : highest
        );
        console.log('Multiple food items detected, using highest confidence:', primaryLabel.description);
      }
    }

    if (dbMatches.length > 0) {
      // Find best match that corresponds to our primary label, avoiding inappropriate matches
      bestMatch = dbMatches.find(match => {
        const matchName = match.navn.toLowerCase();
        const labelDesc = primaryLabel.description.toLowerCase();
        
        // Skip packaging items when looking for food items
        if (primaryLabel.materiale === 'organisk' && (
          matchName === 'net' || 
          matchName.includes('pose') || 
          matchName.includes('folie')
        )) {
          return false;
        }
        
        // Skip generic food waste for specific food items
        if (primaryLabel.materiale === 'organisk' && matchName === 'madrester') {
          return false;
        }
        
        // Direct name match (prioritize exact matches)
        if (matchName === labelDesc) {
          return true;
        }
        
        // Partial name match
        if (matchName.includes(labelDesc) || labelDesc.includes(matchName)) {
          return true;
        }
        
        return false;
      });
      
    // For specific food items like oranges, don't force a database match if no good one exists
      if (!bestMatch && primaryLabel.materiale === 'organisk') {
        console.log('No specific database match found for food item, using AI categorization');
        // Don't set bestMatch to null here - let the AI categorization handle it properly
      } else if (!bestMatch) {
        // For non-food items, use any available match
        bestMatch = dbMatches[0];
      }
      
      if (bestMatch) {
        confidence = Math.round(primaryLabel.score * 100);
        console.log('Using database match:', bestMatch.navn);
      }
    } else {
      console.log('No database matches found, using AI categorization');
    }

    // Step 3: Build result from database or fallback to vision data
    if (bestMatch) {
      // Count identical items and create description
      const itemCount = labels.filter(label => label.description === primaryLabel.description).length;
      const itemName = itemCount > 1 ? `${bestMatch.navn || primaryLabel.description} (${itemCount} stk.)` : bestMatch.navn || primaryLabel.description;
      
      // Get unique components - always include all items for clear sorting instructions
      const uniqueComponents = [];
      const componentMap = new Map();
      
      labels.forEach(label => {
        const key = `${label.description}-${label.materiale || ''}`;
        if (!componentMap.has(key)) {
          componentMap.set(key, {
            genstand: label.description,
            materiale: label.materiale || bestMatch.materiale || 'Ukendt',
            tilstand: label.tilstand,
            count: 1
          });
        } else {
          componentMap.get(key).count++;
        }
      });
      
      uniqueComponents.push(...componentMap.values());

      // Use database data
      return {
        id: Date.now().toString(),
        name: itemName,
        image: imageData,
        homeCategory: bestMatch.hjem || 'Restaffald',
        recyclingCategory: bestMatch.genbrugsplads || 'Restaffald',
        description: `${bestMatch.variation || bestMatch.navn || primaryLabel.description}${bestMatch.tilstand ? ` - ${bestMatch.tilstand}` : ''}${itemCount > 1 ? `. Indeholder ${itemCount} styk.` : ''}`,
        confidence: confidence,
        timestamp: new Date(),
        aiThoughtProcess: `Fundet i database: ${bestMatch.navn}. Materiale: ${bestMatch.materiale || 'Ukendt'}${itemCount > 1 ? `. Detekteret ${itemCount} identiske genstande.` : ''}`,
        components: uniqueComponents.map(comp => ({
          genstand: comp.count > 1 ? `${comp.genstand} (${comp.count} stk.)` : comp.genstand,
          materiale: comp.materiale,
          tilstand: comp.tilstand
        }))
      };
    } else {
      // Fallback to basic categorization from vision data
      
      // Special handling for specific items
      let homeCategory, recyclingCategory;
      
      // Eggs should always be food waste
      if (primaryLabel.description && (
        primaryLabel.description.toLowerCase().includes('æg') ||
        primaryLabel.description.toLowerCase().includes('egg')
      )) {
        homeCategory = 'Madaffald';
        recyclingCategory = 'Ikke muligt';
      }
      // Nets should be plastic
      else if (primaryLabel.description && (
        primaryLabel.description.toLowerCase().includes('net') ||
        primaryLabel.description.toLowerCase().includes('pose')
      )) {
        homeCategory = 'Plast';
        recyclingCategory = 'Hård plast';
      }
      // Default material-based categorization
      else {
        homeCategory = primaryLabel.materiale === 'pap' ? 'Pap' : 
                      primaryLabel.materiale === 'plastik' ? 'Plast' : 
                      primaryLabel.materiale === 'glas' ? 'Glas' : 
                      primaryLabel.materiale === 'metal' ? 'Metal' : 
                      primaryLabel.materiale === 'elektronik' ? 'Restaffald' : 
                      primaryLabel.materiale === 'farligt' ? 'Farligt affald' : 
                      primaryLabel.materiale === 'organisk' ? 'Madaffald' : 
                      primaryLabel.materiale === 'tekstil' ? 'Tekstilaffald' : 'Restaffald';

        recyclingCategory = primaryLabel.materiale === 'pap' ? 'Pap' : 
                           primaryLabel.materiale === 'plastik' ? 'Hård plast' : 
                           primaryLabel.materiale === 'glas' ? 'Glas' : 
                           primaryLabel.materiale === 'metal' ? 'Metal' : 
                           primaryLabel.materiale === 'elektronik' ? 'Genbrugsstation' : 
                           primaryLabel.materiale === 'farligt' ? 'Farligt affald' : 
                           primaryLabel.materiale === 'organisk' ? 'Ikke muligt' : 
                           primaryLabel.materiale === 'tekstil' ? 'Tekstilaffald' : 'Restaffald';
      }

      // Count identical items and create description
      const itemCount = labels.filter(label => label.description === primaryLabel.description).length;
      const itemName = itemCount > 1 ? `${primaryLabel.description} (${itemCount} stk.)` : primaryLabel.description;
      
      // Get all unique components for detailed sorting instructions
      const uniqueComponents = [];
      const componentMap = new Map();
      
      labels.forEach(label => {
        const key = `${label.description}-${label.materiale || ''}`;
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

      return {
        id: Date.now().toString(),
        name: itemName,
        image: imageData,
        homeCategory: homeCategory,
        recyclingCategory: recyclingCategory,
        description: `${primaryLabel.description}${itemCount > 1 ? ` - ${itemCount} styk detekteret` : ''}`,
        confidence: Math.round(primaryLabel.score * 100),
        timestamp: new Date(),
        aiThoughtProcess: `Ikke fundet i database - bruger AI-kategorisering${itemCount > 1 ? `. Detekteret ${itemCount} identiske genstande.` : ''}`,
        components: uniqueComponents.map(comp => ({
          genstand: comp.count > 1 ? `${comp.genstand} (${comp.count} stk.)` : comp.genstand,
          materiale: comp.materiale,
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
      aiThoughtProcess: `Fejl: ${error instanceof Error ? error.message : 'Ukendt fejl'}`
    };
  }
};
