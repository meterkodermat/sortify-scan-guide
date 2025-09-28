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
  
  // Handle paper items specifically based on description
  if (desc.includes('papir') || desc.includes('kvittering') || desc.includes('bonpapir')) {
    return { hjem: 'Papir', genbrugsplads: 'Genbrugsstation - pap og papir' };
  }
  
  // Handle bonpapir/kvittering specifically - must come before 'pap' check
  if (material.includes('bonpapir') || material.includes('kvittering')) {
    return { hjem: 'Papir', genbrugsplads: 'Genbrugsstation - pap og papir' };
  } else if (material.includes('plastik') || material.includes('plast')) {
    return { hjem: 'Plast', genbrugsplads: 'Genbrugsstation - hård plast' };
  } else if (material.includes('elektronik') || material.includes('elektronisk')) {
    return { hjem: 'Farligt affald', genbrugsplads: 'Genbrugsstation - elektronik' };
  } else if (material.includes('metal') || material.includes('stål') || material.includes('aluminium')) {
    return { hjem: 'Metal', genbrugsplads: 'Genbrugsstation - metal' };
  } else if (material.includes('glas')) {
    return { hjem: 'Glas', genbrugsplads: 'Genbrugsstation - glas' };
  } else if (material.includes('papir')) {
    return { hjem: 'Papir', genbrugsplads: 'Genbrugsstation - pap og papir' };  
  } else if (material.includes('pap') || material.includes('karton')) {
    return { hjem: 'Pap', genbrugsplads: 'Genbrugsstation - pap og papir' };
  } else if (material.includes('tekstil') || material.includes('tøj')) {
    return { hjem: 'Tekstilaffald', genbrugsplads: 'Genbrugsstation - tekstil' };
  } else if (material.includes('organisk') || material.includes('mad')) {
    return { hjem: 'Madaffald', genbrugsplads: 'Genbrugsstation - organisk affald' };
  } else {
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
      
        // Find matches in database
        const matches = await findBestMatches(data.labels);
        
        if (matches.length > 0) {
          let bestMatch = matches[0];
          console.log('✅ Found database match:', bestMatch.navn);
          
          // Smart material override - if item name clearly indicates material, override database category
          const detectedItem = data.labels.find(item => item.score >= 0.8) || data.labels[0];
          const itemDescription = detectedItem?.description?.toLowerCase() || '';
          
          console.log('🧠 Smart material check for:', itemDescription);
          
          // Override for plastic items that are clearly plastic
          if ((itemDescription.includes('plastik') || itemDescription.includes('plast') || 
               (detectedItem?.materiale?.toLowerCase().includes('plast'))) && 
              bestMatch.hjem?.toLowerCase() !== 'plast') {
            console.log('🔧 Overriding category: plastic item detected, changing to Plast');
            bestMatch = {
              ...bestMatch,
              hjem: 'Plast',
              genbrugsplads: 'Genbrugsstation - hård plast'
            };
          }
          
          // Override for paper items that are clearly paper
          else if ((itemDescription.includes('papir') || 
                   (detectedItem?.materiale?.toLowerCase().includes('papir'))) && 
                  bestMatch.hjem?.toLowerCase() !== 'papir') {
            console.log('🔧 Overriding category: paper item detected, changing to Papir');
            bestMatch = {
              ...bestMatch,
              hjem: 'Papir',
              genbrugsplads: 'Genbrugsstation - papir'
            };
          }
          
          // Override for cardboard items
          else if ((itemDescription.includes('karton') || itemDescription.includes('pap') || 
                   (detectedItem?.materiale?.toLowerCase().includes('karton'))) && 
                  bestMatch.hjem?.toLowerCase() !== 'pap') {
            console.log('🔧 Overriding category: cardboard item detected, changing to Pap');
            bestMatch = {
              ...bestMatch,
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
        
        const itemName = physicalItems.length > 1 ? 
          `Flere komponenter fundet` : 
          (bestMatch.navn || primaryItem?.description || "Ukendt genstand");
        
        return {
          id: Math.random().toString(),
          name: itemName,
          image: "",
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
              image: "",
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
          image: "",
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
