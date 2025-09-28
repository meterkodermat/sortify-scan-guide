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
    hjem: string;
    genbrugsplads: string;
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

      console.log(`🔍 Searching database for term: "${cleanTerm}"`);

      // Prioritize exact matches first for better performance
      const { data, error } = await supabase
        .from('demo')
        .select('*')
        .or(`navn.ilike.${cleanTerm},navn.ilike.%${cleanTerm}%,synonymer.ilike.%${cleanTerm}%`)
        .limit(10);

      if (error) {
        console.error(`❌ Database error for term "${cleanTerm}":`, error);
        continue;
      }

      if (data?.length) {
        console.log(`✅ Found ${data.length} matches for "${cleanTerm}":`, data.map(d => `${d.navn} (${d.hjem})`));
        allResults.push(...data);
      } else {
        console.log(`❌ No matches found for term: "${cleanTerm}"`);
      }
    }
    
    // Remove duplicates by id and limit total results
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    ).slice(0, 15); // Limit to 15 results max for performance

    console.log(`🎯 Total unique results: ${uniqueResults.length}`);

    // Simplified scoring for better performance
    return uniqueResults.sort((a, b) => {
      let aScore = 0, bScore = 0;
      
      // Only use first search term for scoring to improve performance
      const primaryTerm = searchTerms[0]?.toLowerCase() || '';
      if (!primaryTerm) return 0;
      
      console.log(`🎯 Scoring results for primary term: "${primaryTerm}"`);
      
      // Special boost for electronics when searching for oplader/strømforsyning
      if (primaryTerm.includes('oplader') || primaryTerm.includes('strømforsyning')) {
        console.log('⚡ Applying electronics boost for', primaryTerm);
        if (a.navn?.toLowerCase() === 'strømforsyning') {
          aScore += 2000;
          console.log(`⚡ Boosting ${a.navn} by 2000 points`);
        }
        if (b.navn?.toLowerCase() === 'strømforsyning') {
          bScore += 2000;
          console.log(`⚡ Boosting ${b.navn} by 2000 points`);
        }
        if (a.synonymer?.toLowerCase().includes('oplader')) {
          aScore += 1500;
          console.log(`⚡ Boosting ${a.navn} by 1500 points for oplader synonym`);
        }
        if (b.synonymer?.toLowerCase().includes('oplader')) {
          bScore += 1500;
          console.log(`⚡ Boosting ${b.navn} by 1500 points for oplader synonym`);
        }
      }
      
      // Exact name match (highest priority)
      if (a.navn?.toLowerCase() === primaryTerm) aScore += 1000;
      if (b.navn?.toLowerCase() === primaryTerm) bScore += 1000;
      
      // Penalize specific subtypes when searching for generic terms
      if (primaryTerm === 'papir') {
        if (a.navn?.toLowerCase() === 'papir') {
          // Boost correct papir entries that are actually sorted as papir
          if (a.hjem?.toLowerCase() === 'papir') aScore += 3000;
          else aScore += 1000; // Still boost exact match but less if categorized as restaffald
        }
        if (b.navn?.toLowerCase() === 'papir') {
          // Boost correct papir entries that are actually sorted as papir
          if (b.hjem?.toLowerCase() === 'papir') bScore += 3000;
          else bScore += 1000; // Still boost exact match but less if categorized as restaffald
        }
        // Penalize specialized papir types when searching for generic papir
        if (a.navn?.toLowerCase().includes('bonpapir') || a.navn?.toLowerCase().includes('fortroligt') || 
            a.navn?.toLowerCase().includes('gave') || a.navn?.toLowerCase().includes('mad')) aScore -= 500;
        if (b.navn?.toLowerCase().includes('bonpapir') || b.navn?.toLowerCase().includes('fortroligt') || 
            b.navn?.toLowerCase().includes('gave') || b.navn?.toLowerCase().includes('mad')) bScore -= 500;
      }
      
      // Name contains term (lower priority for partial matches)
      if (a.navn?.toLowerCase().includes(primaryTerm)) aScore += 300;
      if (b.navn?.toLowerCase().includes(primaryTerm)) bScore += 300;
      
      // Synonym match
      if (a.synonymer?.toLowerCase().includes(primaryTerm)) aScore += 300;
      if (b.synonymer?.toLowerCase().includes(primaryTerm)) bScore += 300;
      
      const finalScore = bScore - aScore;
      console.log(`📊 Final scores: ${a.navn}: ${aScore}, ${b.navn}: ${bScore} (diff: ${finalScore})`);
      return finalScore;
    }).slice(0, 8); // Limit to 8 results for better performance

  } catch (error) {
    console.error('Database search error:', error.message);
    return [];
  }
};

// Function to map material to sorting categories
const getMaterialSorting = (materiale: string, description?: string): { hjem: string; genbrugsplads: string } => {
  const material = materiale.toLowerCase();
  const desc = description?.toLowerCase() || '';
  
  console.log('getMaterialSorting called with:', { materiale, description, material, desc });
  
  // Handle paper items specifically based on description
  if (desc.includes('papir') || desc.includes('kvittering') || desc.includes('bonpapir')) {
    console.log('✅ Matched paper description, returning Papir');
    return { hjem: 'Papir', genbrugsplads: 'Genbrugsstation - pap og papir' };
  }
  
  // Handle bonpapir/kvittering specifically - must come before 'pap' check
  if (material.includes('bonpapir') || material.includes('kvittering')) {
    console.log('✅ Matched bonpapir/kvittering material, returning Papir');
    return { hjem: 'Papir', genbrugsplads: 'Genbrugsstation - pap og papir' };
  } else if (material.includes('plastik') || material.includes('plast')) {
    console.log('✅ Matched plastic material, returning Plast');
    return { hjem: 'Plast', genbrugsplads: 'Genbrugsstation - hård plast' };
  } else if (material.includes('elektronik') || material.includes('elektronisk')) {
    console.log('✅ Matched electronic material, returning Farligt affald');
    return { hjem: 'Farligt affald', genbrugsplads: 'Genbrugsstation - elektronik' };
  } else if (material.includes('metal') || material.includes('stål') || material.includes('aluminium')) {
    console.log('✅ Matched metal material, returning Metal');
    return { hjem: 'Metal', genbrugsplads: 'Genbrugsstation - metal' };
  } else if (material.includes('glas')) {
    console.log('✅ Matched glass material, returning Glas');
    return { hjem: 'Glas', genbrugsplads: 'Genbrugsstation - glas' };
  } else if (material.includes('papir')) {
    console.log('✅ Matched papir material, returning Papir');
    return { hjem: 'Papir', genbrugsplads: 'Genbrugsstation - pap og papir' };  
  } else if (material.includes('pap') || material.includes('karton')) {
    console.log('✅ Matched pap/karton material, returning Pap');
    return { hjem: 'Pap', genbrugsplads: 'Genbrugsstation - pap og papir' };
  } else if (material.includes('tekstil') || material.includes('tøj')) {
    console.log('✅ Matched textile material, returning Tekstilaffald');
    return { hjem: 'Tekstilaffald', genbrugsplads: 'Genbrugsstation - tekstil' };
  } else if (material.includes('organisk') || material.includes('mad')) {
    console.log('✅ Matched organic material, returning Madaffald');
    return { hjem: 'Madaffald', genbrugsplads: 'Genbrugsstation - organisk affald' };
  } else {
    console.log('❌ No match found, returning Restaffald');
    return { hjem: 'Restaffald', genbrugsplads: 'Genbrugsstation - restaffald' };
  }
};

// Enhanced search with smarter term extraction and filtering
const findBestMatches = async (labels: VisionLabel[]) => {
  console.log('🔍 Processing Gemini labels:', labels);
  
  // Sort labels by score to prioritize the most confident detections
  const sortedLabels = [...labels].sort((a, b) => (b.score || 0) - (a.score || 0));
  console.log('📊 Labels sorted by confidence:', sortedLabels.map(l => `${l.description} (${l.score})`));
  
  // Get primary item (highest confidence)
  const primaryLabel = sortedLabels[0];
  const primaryMaterial = primaryLabel?.materiale?.toLowerCase();
  
  console.log('🎯 Primary item:', primaryLabel?.description, 'Material:', primaryMaterial);
  
  // Filter out liquid contents and focus on physical items
  const filteredLabels = sortedLabels.filter(label => {
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
  
  // Extract main search terms with smart mapping - prioritize primary item
  const searchTerms = [];
  
  // Start with primary item terms
  if (primaryLabel?.description) {
    const primaryTerm = primaryLabel.description.toLowerCase();
    
    console.log('🔍 Processing primary term:', primaryTerm);
    
    // Smart mapping for common items
    if (primaryTerm.includes('balje') || primaryTerm.includes('skål')) {
      searchTerms.push('balje');
      searchTerms.push('skål');
      console.log('🥣 Added bowl/balje terms');
    } else if (primaryTerm.includes('cover') || primaryTerm.includes('hylster')) {
      searchTerms.push('cover');
      searchTerms.push('mobilcover');
      searchTerms.push('hylster');
      console.log('📱 Added cover terms');
    } else if (primaryTerm.includes('juicekarton')) {
      searchTerms.push('juicekarton');
      searchTerms.push('drikkekarton');
      searchTerms.push('kartoner');
      console.log('📦 Mapped to juice carton terms');
    } else if (primaryTerm.includes('strømforsyning') || primaryTerm.includes('oplader')) {
      console.log('⚡ Detected power supply/charger, mapping terms...');
      searchTerms.push('strømforsyning');
      searchTerms.push('oplader');
      searchTerms.push('mobiloplader');
    }
    
    // Always add the primary term
    searchTerms.push(primaryLabel.description);
    
    // Add translated text if different
    if (primaryLabel.translatedText && primaryLabel.translatedText !== primaryLabel.description) {
      searchTerms.push(primaryLabel.translatedText);
    }
  }
  
  // Add material-based search terms (only if they make sense for the primary item)
  if (primaryMaterial) {
    console.log('🔬 Adding material-based terms for:', primaryMaterial);
    
    if (primaryMaterial === 'plastik' || primaryMaterial === 'plast') {
      searchTerms.push('plast');
      searchTerms.push('plastik');
      // Only add specific plastic terms if they match the primary item
      if (primaryLabel?.description?.toLowerCase().includes('balje')) {
        searchTerms.push('plastbalje');
        searchTerms.push('plastikbalje');
      }
      if (primaryLabel?.description?.toLowerCase().includes('cover')) {
        searchTerms.push('plastcover');
        searchTerms.push('mobilcover');
      }
    } else if (primaryMaterial === 'pap' || primaryMaterial === 'karton') {
      searchTerms.push('pap');
      searchTerms.push('karton');
    }
  }
  
  // Add secondary items only if they don't conflict with primary material
  for (let i = 1; i < Math.min(filteredLabels.length, 3); i++) {
    const secondaryLabel = filteredLabels[i];
    const secondaryMaterial = secondaryLabel?.materiale?.toLowerCase();
    
    // Skip secondary items that have conflicting materials unless they're very relevant
    if (primaryMaterial && secondaryMaterial && primaryMaterial !== secondaryMaterial) {
      console.log(`⚠️ Skipping secondary item "${secondaryLabel.description}" (${secondaryMaterial}) - conflicts with primary material (${primaryMaterial})`);
      continue;
    }
    
    if (secondaryLabel?.description) {
      searchTerms.push(secondaryLabel.description);
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

  console.log('🎯 Final search terms:', cleanTerms);

  if (cleanTerms.length === 0) {
    console.log('❌ No valid search terms found');
    return [];
  }

  const matches = await searchWasteInDatabase(cleanTerms);
  console.log(`✅ Found ${matches.length} database matches:`, matches.map(m => `${m.navn} (${m.hjem})`));
  
  // Re-score matches based on material compatibility
  if (primaryMaterial && matches.length > 0) {
    console.log('🎯 Re-scoring matches based on material compatibility...');
    
    const rescoredMatches = matches.map(match => {
      let materialScore = 0;
      
      // Boost matches that align with detected material
      if (primaryMaterial === 'plastik' || primaryMaterial === 'plast') {
        if (match.hjem?.toLowerCase() === 'plast') materialScore += 1000;
        if (match.genbrugsplads?.toLowerCase().includes('plast')) materialScore += 500;
        // Penalize non-plastic categories for plastic items
        if (match.hjem?.toLowerCase() === 'pap' || match.hjem?.toLowerCase() === 'papir') materialScore -= 2000;
      } else if (primaryMaterial === 'pap' || primaryMaterial === 'karton') {
        if (match.hjem?.toLowerCase() === 'pap') materialScore += 1000;
        if (match.genbrugsplads?.toLowerCase().includes('pap')) materialScore += 500;
      }
      
      return { ...match, materialScore };
    });
    
    // Sort by material score
    rescoredMatches.sort((a, b) => (b.materialScore || 0) - (a.materialScore || 0));
    
    console.log('📊 Rescored matches:', rescoredMatches.map(m => `${m.navn} (${m.hjem}) - score: ${m.materialScore}`));
    
    return rescoredMatches;
  }
  
  return matches;
};

// Filter labels to prioritize electronics over plastic variants of same item
const filterSmartLabels = (labels: VisionLabel[]): VisionLabel[] => {
  console.log('🎯 Starting smart label filtering...');
  
  // Group labels by base description (remove material prefixes)
  const groupedLabels = new Map<string, VisionLabel[]>();
  
  labels.forEach(label => {
    const description = label.description?.toLowerCase() || '';
    
    // Extract base description (remove material prefixes like "plastik ")
    let baseDescription = description;
    if (description.startsWith('plastik ')) {
      baseDescription = description.replace('plastik ', '');
    } else if (description.startsWith('metal ')) {
      baseDescription = description.replace('metal ', '');
    } else if (description.startsWith('glas ')) {
      baseDescription = description.replace('glas ', '');
    }
    
    if (!groupedLabels.has(baseDescription)) {
      groupedLabels.set(baseDescription, []);
    }
    groupedLabels.get(baseDescription)!.push(label);
  });
  
  const filteredLabels: VisionLabel[] = [];
  
  // For each group, select the best label
  groupedLabels.forEach((labelGroup, baseDescription) => {
    if (labelGroup.length === 1) {
      // Only one label for this item, keep it
      filteredLabels.push(labelGroup[0]);
    } else {
      // Multiple labels for same item - prioritize by material type and score
      console.log(`🔍 Found ${labelGroup.length} variants for "${baseDescription}":`, labelGroup.map(l => `${l.description} (${l.materiale}, ${l.score})`));
      
      // Sort by priority: electronics > others > plastic, then by score
      const sorted = labelGroup.sort((a, b) => {
        const aMaterial = a.materiale?.toLowerCase() || '';
        const bMaterial = b.materiale?.toLowerCase() || '';
        
        // Electronics has highest priority
        if (aMaterial.includes('elektronik') && !bMaterial.includes('elektronik')) return -1;
        if (!aMaterial.includes('elektronik') && bMaterial.includes('elektronik')) return 1;
        
        // Plastic has lowest priority
        if (aMaterial.includes('plast') && !bMaterial.includes('plast')) return 1;
        if (!aMaterial.includes('plast') && bMaterial.includes('plast')) return -1;
        
        // Same material priority, sort by score
        return b.score - a.score;
      });
      
      const bestLabel = sorted[0];
      console.log(`✅ Selected best variant: ${bestLabel.description} (${bestLabel.materiale}, ${bestLabel.score})`);
      filteredLabels.push(bestLabel);
    }
  });
  
  console.log('🎯 Smart filtering complete. Original:', labels.length, 'Filtered:', filteredLabels.length);
  return filteredLabels;
};

// Get icon for category
const getIconForCategory = (category: string): string => {
  const categoryMap: { [key: string]: string } = {
    "Pap": "/src/assets/pap.png",
    "Papir": "/src/assets/papir.png", 
    "Plast": "/src/assets/plast.png",
    "Metal": "/src/assets/metal.png",
    "Glas": "/src/assets/glas.png",
    "Madaffald": "/src/assets/madaffald.png",
    "Tekstilaffald": "/src/assets/tekstilaftald.png",
    "Farligt affald": "/src/assets/farligtaffald.png",
    "Restaffald": "/src/assets/restaffald.png"
  };

  return categoryMap[category] || "/src/assets/restaffald.png";
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
      
      // Filter labels to prioritize electronics over plastic variants
      const filteredLabels = filterSmartLabels(data.labels);
      console.log('🎯 Filtered labels:', filteredLabels);
      
      // Find matches in database
      const matches = await findBestMatches(filteredLabels);
      
      if (matches.length > 0) {
        let bestMatch = matches[0];
        console.log('✅ Found database match:', bestMatch.navn);
        
        // Smart material override - if item name clearly indicates material, override database category
        const detectedItem = filteredLabels.find(item => item.score >= 0.8) || filteredLabels[0];
        const itemDescription = detectedItem?.description?.toLowerCase() || '';
        
        console.log('🧠 Smart material check for:', itemDescription);
        
        // Check all detected items for electronics (priority override)
        const hasElectronics = filteredLabels.some(item => 
          item.materiale?.toLowerCase().includes('elektronik') || 
          item.description?.toLowerCase().includes('elektronik') ||
          item.description?.toLowerCase().includes('fjernbetjening') ||
          item.description?.toLowerCase().includes('elektronisk')
        );
        
        console.log('🔍 Electronics check:', {
          hasElectronics,
          filteredLabels,
          bestMatchHjem: bestMatch.hjem,
          shouldOverride: hasElectronics && bestMatch.hjem?.toLowerCase() !== 'farligt affald'
        });
        
        // Override for electronic items (highest priority)
        if (hasElectronics && bestMatch.hjem?.toLowerCase() !== 'farligt affald') {
          console.log('🔧 Overriding category: electronics detected, changing to Farligt affald');
          const electronicsItem = filteredLabels.find(item => 
            item.materiale?.toLowerCase().includes('elektronik') || 
            item.description?.toLowerCase().includes('elektronik') ||
            item.description?.toLowerCase().includes('fjernbetjening')
          ) || detectedItem;
          console.log('📱 Selected electronics item:', electronicsItem);
          bestMatch = {
            ...bestMatch,
            navn: electronicsItem?.description || detectedItem?.description || 'Elektronisk affald',
            hjem: 'Farligt affald',
            genbrugsplads: 'Genbrugsstation - elektronik'
          };
          console.log('✅ Override complete, new bestMatch:', bestMatch);
        }
        
        // Override for plastic items that are clearly plastic (but not if electronics detected)
        else if ((itemDescription.includes('plastik') || itemDescription.includes('plast') || 
             (detectedItem?.materiale?.toLowerCase().includes('plast'))) && 
            !hasElectronics &&
            bestMatch.hjem?.toLowerCase() !== 'plast') {
          console.log('🔧 Overriding category: plastic item detected, changing to Plast');
          bestMatch = {
            ...bestMatch,
            navn: detectedItem?.description || 'Plast',
            hjem: 'Plast',
            genbrugsplads: 'Genbrugsstation - hård plast'
          };
        }
        
        // Override for paper items that are clearly paper
        else if ((itemDescription.includes('papir') || 
                 (detectedItem?.materiale?.toLowerCase() === 'pap') ||
                 (detectedItem?.description?.toLowerCase() === 'papir')) && 
                bestMatch.hjem?.toLowerCase() !== 'papir') {
          console.log('🔧 Overriding category: paper item detected, changing to Papir');
          console.log('🔧 Detected item:', detectedItem);
          console.log('🔧 Setting name to:', detectedItem?.description);
          bestMatch = {
            ...bestMatch,
            navn: detectedItem?.description || 'Papir',
            hjem: 'Papir',
            genbrugsplads: 'Papir'
          };
          console.log('🔧 Updated bestMatch:', bestMatch);
        }
        
        // Override for cardboard items (but not paper items)
        else if ((itemDescription.includes('karton') || 
                 (itemDescription.includes('pap') && !itemDescription.includes('papir')) || 
                 (detectedItem?.materiale?.toLowerCase().includes('karton'))) && 
                bestMatch.hjem?.toLowerCase() !== 'pap') {
          console.log('🔧 Overriding category: cardboard item detected, changing to Pap');
          bestMatch = {
            ...bestMatch,
            navn: detectedItem?.description || 'Pap',
            hjem: 'Pap',
            genbrugsplads: 'Genbrugsstation - pap og papir'
          };
        }
        
        // Override for glass items
        else if ((itemDescription.includes('glas') || 
                 (detectedItem?.materiale?.toLowerCase().includes('glas'))) && 
                bestMatch.hjem?.toLowerCase() !== 'glas') {
          console.log('🔧 Overriding category: glass item detected, changing to Glas');
          bestMatch = {
            ...bestMatch,
            navn: detectedItem?.description || 'Glas',
            hjem: 'Glas',
            genbrugsplads: 'Genbrugsstation - glas'
          };
        }
        
        // Override for metal items
        else if ((itemDescription.includes('metal') || itemDescription.includes('stål') || itemDescription.includes('aluminium') ||
                 (detectedItem?.materiale?.toLowerCase().includes('metal'))) && 
                bestMatch.hjem?.toLowerCase() !== 'metal') {
          console.log('🔧 Overriding category: metal item detected, changing to Metal');
          bestMatch = {
            ...bestMatch,
            navn: detectedItem?.description || 'Metal',
            hjem: 'Metal',
            genbrugsplads: 'Genbrugsstation - metal'
          };
        }
        
        // Count physical items (excluding liquids)
        const physicalItems = data.labels.filter(label => {
          const desc = label.description?.toLowerCase() || '';
          return !(['juice', 'mælk', 'vand', 'øl', 'sodavand'].some(liquid => 
            desc.includes(liquid) && !desc.includes('karton') && !desc.includes('flaske') && !desc.includes('dåse')
          ));
        });

        // Get primary item for naming
        const primaryItem = physicalItems.find(item => item.score >= 0.8) || physicalItems[0];
        
        // Use the updated bestMatch.navn if it was overridden by material detection, otherwise use original logic
        const itemName = physicalItems.length > 1 ? 
          `Flere komponenter fundet` : 
          (bestMatch.navn || primaryItem?.description || "Ukendt genstand");
        
        console.log('🏷️ Final item name calculation:');
        console.log('  - physicalItems.length:', physicalItems.length);
        console.log('  - bestMatch.navn:', bestMatch.navn);
        console.log('  - primaryItem?.description:', primaryItem?.description);
        console.log('  - Final itemName:', itemName);
        
        return {
          id: Math.random().toString(),
          name: itemName,
          image: getIconForCategory(bestMatch.hjem || ""),
          homeCategory: bestMatch.hjem || "Restaffald",
          recyclingCategory: bestMatch.genbrugsplads || "Genbrugsstation - generelt affald",
          description: `Identificeret ved hjælp af AI-analyse. ${bestMatch.variation ? `Variation: ${bestMatch.variation}. ` : ''}${bestMatch.tilstand ? `Tilstand: ${bestMatch.tilstand}. ` : ''}Sortér som angivet eller kontakt din lokale genbrugsstation for specifik vejledning.`,
          confidence: data.labels[0]?.score || 0.8,
          timestamp: new Date(),
          aiThoughtProcess: data.thoughtProcess,
          components: physicalItems.map((label: VisionLabel) => {
            const sorting = getMaterialSorting(label.materiale || '', label.description);
            return {
              genstand: label.description,
              materiale: label.materiale || '',
              tilstand: label.tilstand || '',
              hjem: sorting.hjem,
              genbrugsplads: sorting.genbrugsplads
            };
          })
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
              `Flere komponenter fundet` : 
              (bestMatch.navn || physicalItems[0]?.description || "Ukendt genstand");
            
            return {
              id: Math.random().toString(),
              name: itemName,
              image: getIconForCategory(bestMatch.hjem || ""),
              homeCategory: bestMatch.hjem || "Restaffald",
              recyclingCategory: bestMatch.genbrugsplads || "Genbrugsstation - generelt affald",
              description: `Identificeret ved hjælp af forenklet AI-analyse. ${bestMatch.variation ? `Variation: ${bestMatch.variation}. ` : ''}${bestMatch.tilstand ? `Tilstand: ${bestMatch.tilstand}. ` : ''}Sortér som angivet eller kontakt din lokale genbrugsstation for specifik vejledning.`,
              confidence: (simpleData.labels[0]?.score || 0.6) * 0.9, // Slightly lower confidence for simple analysis
              timestamp: new Date(),
              aiThoughtProcess: simpleData.thoughtProcess,
              components: physicalItems.map((label: VisionLabel) => {
                const sorting = getMaterialSorting(label.materiale || '', label.description);
                return {
                  genstand: label.description,
                  materiale: label.materiale || '',
                  tilstand: label.tilstand || '',
                  hjem: sorting.hjem,
                  genbrugsplads: sorting.genbrugsplads
                };
              })
            };
          }
        }

        // No database match - use material-based fallback
        console.log('🔄 No database match found, using material-based fallback...');
        
        const primaryLabel = data.labels[0];
        const detectedMaterial = primaryLabel?.materiale?.toLowerCase();
        
        let homeCategory = "Restaffald";
        let recyclingCategory = "Genbrugsstation - generelt affald";
        
        // Use detected material for better categorization
        if (detectedMaterial === 'plastik' || detectedMaterial === 'plast') {
          homeCategory = "Plast";
          recyclingCategory = "Hård plast";
          console.log('🔬 Applied plastic categorization based on detected material');
        } else if (detectedMaterial === 'pap' || detectedMaterial === 'karton') {
          homeCategory = "Pap";
          recyclingCategory = "Pap";
          console.log('🔬 Applied cardboard categorization based on detected material');
        } else if (detectedMaterial === 'metal') {
          homeCategory = "Metal";
          recyclingCategory = "Metal";
          console.log('🔬 Applied metal categorization based on detected material');
        } else if (detectedMaterial === 'glas') {
          homeCategory = "Glas";
          recyclingCategory = "Glas";
          console.log('🔬 Applied glass categorization based on detected material');
        }
        
        const physicalItems = data.labels.filter(label => {
          const desc = label.description?.toLowerCase() || '';
          return !(['juice', 'mælk', 'vand', 'øl', 'sodavand'].some(liquid => 
            desc.includes(liquid) && !desc.includes('karton') && !desc.includes('flaske') && !desc.includes('dåse')
          ));
        });

        const itemName = physicalItems.length > 1 ? 
          `Flere komponenter fundet` : 
          (primaryLabel?.description || "Ukendt genstand");
        
        return {
          id: Math.random().toString(),
          name: itemName,
          image: getIconForCategory(homeCategory),
          homeCategory,
          recyclingCategory,
          description: `Identificeret som ${detectedMaterial || 'ukendt materiale'} ved hjælp af AI-analyse. Sortér som angivet eller kontakt din lokale genbrugsstation for specifik vejledning.`,
          confidence: (primaryLabel?.score || 0.6) * 0.8, // Lower confidence for fallback
          timestamp: new Date(),
          aiThoughtProcess: data.thoughtProcess,
          components: physicalItems.map((label: VisionLabel) => {
            const sorting = getMaterialSorting(label.materiale || '', label.description);
            return {
              genstand: label.description,
              materiale: label.materiale || '',
              tilstand: label.tilstand || '',
              hjem: sorting.hjem,
              genbrugsplads: sorting.genbrugsplads
            };
          })
        };
      }
    }
    
    // Fallback if no matches found
    console.log('❌ No database matches found - returning fallback result');
    
    return {
      id: Math.random().toString(),
      name: "Genstand ikke fundet i database", 
      image: getIconForCategory("Restaffald"),
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
      image: getIconForCategory("Restaffald"),
      homeCategory: "Restaffald",  
      recyclingCategory: "Genbrugsstation - generelt affald",
      description: "Der opstod en fejl under analysen. Sortér som restaffald eller kontakt din lokale genbrugsstation for vejledning.",
      confidence: 0,
      timestamp: new Date(),
    };
  }
};
