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

// Simplified and more reliable database search
const searchWasteInDatabase = async (searchTerms: string[]): Promise<any[]> => {
  if (!searchTerms.length) return [];

  try {
    console.log(`🔍 Database search with terms:`, searchTerms);
    
    // Create search queries for each term with better SQL patterns
    const allResults = [];
    
    for (const term of searchTerms) {
      const cleanTerm = term.toLowerCase().trim();
      if (cleanTerm.length < 2) continue;

      console.log(`🔍 Searching for: "${cleanTerm}"`);

      // Use proper PostgreSQL ILIKE with correct syntax for better matching
      const { data, error } = await supabase
        .from('demo')
        .select('*')
        .or(`navn.ilike.%${cleanTerm}%,synonymer.ilike.%${cleanTerm}%,variation.ilike.%${cleanTerm}%,materiale.ilike.%${cleanTerm}%`)
        .limit(20);

      if (!error && data?.length) {
        console.log(`✅ Found ${data.length} matches for "${cleanTerm}":`, data.map(item => `${item.navn} (${item.id})`));
        allResults.push(...data);
      } else if (error) {
        console.error(`❌ Database error for "${cleanTerm}":`, error);
      } else {
        console.log(`❌ No matches found for "${cleanTerm}"`);
      }
    }
    
    // Remove duplicates by id
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    );

    console.log(`🎯 Total unique results: ${uniqueResults.length}`);

    // Enhanced scoring system for better relevance
    return uniqueResults.sort((a, b) => {
      let aScore = 0, bScore = 0;
      
      for (const term of searchTerms) {
        const cleanTerm = term.toLowerCase();
        
        // Exact name match (highest priority)
        if (a.navn?.toLowerCase() === cleanTerm) aScore += 1000;
        if (b.navn?.toLowerCase() === cleanTerm) bScore += 1000;
        
        // Exact synonym match (very high priority for items like "Appelsin" in synonyms)
        const aSynonyms = (a.synonymer || '').toLowerCase();
        const bSynonyms = (b.synonymer || '').toLowerCase();
        
        // Check for exact word match in synonyms (not just substring)
        const aSynonymWords = aSynonyms.split(',').map(s => s.trim());
        const bSynonymWords = bSynonyms.split(',').map(s => s.trim());
        
        if (aSynonymWords.includes(cleanTerm)) aScore += 800;
        if (bSynonymWords.includes(cleanTerm)) bScore += 800;
        
        // Partial synonym match
        if (aSynonyms.includes(cleanTerm)) aScore += 600;
        if (bSynonyms.includes(cleanTerm)) bScore += 600;
        
        // Name contains term
        if (a.navn?.toLowerCase().includes(cleanTerm)) aScore += 400;
        if (b.navn?.toLowerCase().includes(cleanTerm)) bScore += 400;
        
        // Variation match
        if (a.variation?.toLowerCase().includes(cleanTerm)) aScore += 200;
        if (b.variation?.toLowerCase().includes(cleanTerm)) bScore += 200;
        
        // Material match
        if (a.materiale?.toLowerCase().includes(cleanTerm)) aScore += 100;
        if (b.materiale?.toLowerCase().includes(cleanTerm)) bScore += 100;
      }
      
      console.log(`📊 Scores: ${a.navn} = ${aScore}, ${b.navn} = ${bScore}`);
      return bScore - aScore;
    }).slice(0, 5);

  } catch (error) {
    console.error('Database search error:', error);
    return [];
  }
};

// Enhanced search with better term extraction and smarter mapping
const findBestMatches = async (labels: VisionLabel[]) => {
  console.log('🔍 Processing Gemini labels:', labels);
  
  // Extract all meaningful search terms with smart category mapping
  const searchTerms = [];
  
  for (const label of labels) {
    // Add main description
    if (label.description) {
      const desc = label.description.toLowerCase();
      searchTerms.push(label.description);
      
      // Smart category-specific term expansion
      if (desc.includes('appelsin') || desc.includes('orange')) {
        searchTerms.push('appelsin', 'frugt', 'citrusfrugt', 'orange');
        console.log('🍊 Orange detected - adding fruit-specific terms');
      }
      
      if (desc.includes('citrus')) {
        searchTerms.push('citrus', 'frugt', 'appelsin', 'citron');
      }
      
      if (desc.includes('frugt') || desc.includes('fruit')) {
        searchTerms.push('frugt', 'madaffald');
      }
      
      if (desc.includes('net') && (desc.includes('appelsin') || desc.includes('frugt') || desc.includes('grøntsag'))) {
        searchTerms.push('net', 'frugtnet', 'appelsinnet', 'grøntsagsnet');
      }
      
      if (desc.includes('æg') || desc.includes('egg')) {
        searchTerms.push('æg', 'madaffald');
      }
      
      // Generic net handling
      if (desc.includes('net') && !desc.includes('telefon') && !desc.includes('internet')) {
        searchTerms.push('net', 'plastiknet');
      }
    }
    
    // Add translated text if different
    if (label.translatedText && label.translatedText !== label.description) {
      searchTerms.push(label.translatedText);
    }
    
    // Add alternative names
    if (label.navne && Array.isArray(label.navne)) {
      searchTerms.push(...label.navne);
    }
    
    // Enhanced material-based search terms
    if (label.materiale) {
      const material = label.materiale.toLowerCase();
      searchTerms.push(label.materiale);
      
      if (material.includes('organisk')) {
        searchTerms.push('madaffald', 'frugt', 'grøntsager', 'organisk');
        console.log('🌱 Organic material detected - adding food terms');
      }
      
      if (material.includes('plastik')) {
        searchTerms.push('plastik', 'plast');
      }
      
      if (material.includes('elektronik')) {
        searchTerms.push('elektronik', 'elektronisk');
      }
    }
  }

  // Clean and deduplicate terms with better filtering
  const cleanTerms = [...new Set(searchTerms)]
    .filter(term => {
      if (!term || typeof term !== 'string') return false;
      const cleaned = term.toLowerCase().trim();
      // Filter out very short terms and common stop words
      if (cleaned.length < 2) return false;
      if (['er', 'en', 'et', 'og', 'i', 'på', 'af', 'til', 'med'].includes(cleaned)) return false;
      return true;
    })
    .map(term => term.toLowerCase().trim());

  console.log('🎯 Final search terms:', cleanTerms);

  if (cleanTerms.length === 0) {
    console.log('❌ No valid search terms found');
    return [];
  }

  const matches = await searchWasteInDatabase(cleanTerms);
  console.log(`✅ Found ${matches.length} database matches`);
  
  // Log match details for debugging
  if (matches.length > 0) {
    console.log('🎯 Top matches:', matches.slice(0, 3).map(m => ({
      navn: m.navn,
      synonymer: m.synonymer,
      materiale: m.materiale
    })));
  }
  
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
