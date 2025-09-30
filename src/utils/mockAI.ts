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

// Enhanced database search with clean variant prioritization
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

      // Search for matches including clean/dirty variants
      const { data, error } = await supabase
        .from('demo')
        .select('*')
        .or(`navn.ilike.${cleanTerm},navn.ilike.%${cleanTerm}%,synonymer.ilike.%${cleanTerm}%`)
        .limit(20); // Increased limit to capture all variants

      if (error) {
        console.error(`❌ Database error for term "${cleanTerm}":`, error);
        continue;
      }

      if (data?.length) {
        console.log(`✅ Found ${data.length} matches for "${cleanTerm}":`, data.map(d => `${d.navn} (${d.hjem}) [${d.tilstand || 'no condition'}]`));
        allResults.push(...data);
      } else {
        console.log(`❌ No matches found for term: "${cleanTerm}"`);
      }
    }
    
    // Remove duplicates by id
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    );

    console.log(`🎯 Total unique results: ${uniqueResults.length}`);

    // Group by name to handle clean/dirty variants of the same object
    const groupedByName = new Map();
    uniqueResults.forEach(item => {
      const name = item.navn?.toLowerCase() || '';
      if (!groupedByName.has(name)) {
        groupedByName.set(name, []);
      }
      groupedByName.get(name).push(item);
    });

    // For each name group, prioritize clean variants
    const prioritizedResults = [];
    groupedByName.forEach((variants, name) => {
      if (variants.length === 1) {
        prioritizedResults.push(variants[0]);
      } else {
        // Sort variants to prioritize clean ones
        const sortedVariants = variants.sort((a, b) => {
          const aCondition = (a.tilstand || '').toLowerCase();
          const bCondition = (b.tilstand || '').toLowerCase();
          
          // Prioritize clean conditions
          const aIsClean = aCondition.includes('rent') || aCondition.includes('tør');
          const bIsClean = bCondition.includes('rent') || bCondition.includes('tør');
          
          if (aIsClean && !bIsClean) return -1;
          if (!aIsClean && bIsClean) return 1;
          
          // If both are clean or both are dirty, prefer non-Restaffald
          const aIsRestaffald = a.hjem === 'Restaffald';
          const bIsRestaffald = b.hjem === 'Restaffald';
          
          if (!aIsRestaffald && bIsRestaffald) return -1;
          if (aIsRestaffald && !bIsRestaffald) return 1;
          
          return 0;
        });
        
        console.log(`🔄 Prioritized "${name}": ${sortedVariants[0].hjem} (${sortedVariants[0].tilstand || 'no condition'}) over ${sortedVariants.length - 1} other variant(s)`);
        prioritizedResults.push(sortedVariants[0]);
      }
    });

    // Score and sort the prioritized results
    return prioritizedResults.sort((a, b) => {
      let aScore = 0, bScore = 0;
      
      const primaryTerm = searchTerms[0]?.toLowerCase() || '';
      if (!primaryTerm) return 0;
      
      console.log(`🎯 Scoring results for primary term: "${primaryTerm}"`);
      
      // Exact name match (highest priority)
      if (a.navn?.toLowerCase() === primaryTerm) aScore += 1000;
      if (b.navn?.toLowerCase() === primaryTerm) bScore += 1000;
      
      // Name contains term
      if (a.navn?.toLowerCase().includes(primaryTerm)) aScore += 300;
      if (b.navn?.toLowerCase().includes(primaryTerm)) bScore += 300;
      
      // Synonym match
      if (a.synonymer?.toLowerCase().includes(primaryTerm)) aScore += 300;
      if (b.synonymer?.toLowerCase().includes(primaryTerm)) bScore += 300;
      
      // Condition-based scoring
      const aCondition = (a.tilstand || '').toLowerCase();
      const bCondition = (b.tilstand || '').toLowerCase();
      
      if (aCondition.includes('rent') || aCondition.includes('tør')) aScore += 200;
      if (bCondition.includes('rent') || bCondition.includes('tør')) bScore += 200;
      
      if (aCondition.includes('beskidt') || aCondition.includes('ikke tømt')) aScore -= 100;
      if (bCondition.includes('beskidt') || bCondition.includes('ikke tømt')) bScore -= 100;
      
      // Category prioritization - prefer proper recycling categories over "Restaffald"
      const goodCategories = ['Metal', 'Plast', 'Papir', 'Pap', 'Glas', 'Madaffald', 'Tekstilaffald'];
      if (goodCategories.includes(a.hjem)) aScore += 150;
      if (goodCategories.includes(b.hjem)) bScore += 150;
      
      // Strong penalty for "Restaffald" when better alternatives exist
      if (a.hjem === 'Restaffald') aScore -= 200;
      if (b.hjem === 'Restaffald') bScore -= 200;
      
      const finalScore = bScore - aScore;
      console.log(`📊 Final scores: ${a.navn} (${a.tilstand || 'no condition'}): ${aScore}, ${b.navn} (${b.tilstand || 'no condition'}): ${bScore} (diff: ${finalScore})`);
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
  
  if (material.includes('elektronik') || material.includes('elektronisk')) {
    console.log('✅ Matched electronic material, returning Farligt affald');
    return { hjem: 'Farligt affald', genbrugsplads: 'Genbrugsstation - elektronik' };
  } else if (material.includes('plastik') || material.includes('plast')) {
    console.log('✅ Matched plastic material, returning Plast');
    return { hjem: 'Plast', genbrugsplads: 'Genbrugsstation - hård plast' };
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

// Get icon for waste category
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
    console.log('🚀 Starting enhanced waste identification with multi-object scoring...');
    
    // Call the vision-proxy edge function for AI analysis
    const { data, error } = await supabase.functions.invoke('vision-proxy', {
      body: { image: imageData }
    });

    if (error) {
      console.error('❌ Vision proxy error:', error);
      throw error;
    }

    console.log('✅ Gemini labels:', data.labels);

    if (data?.labels && data.labels.length > 0) {
      // NEW APPROACH: Score each Gemini detection individually
      const scoredCandidates = [];
      
      for (let i = 0; i < Math.min(data.labels.length, 5); i++) { // Process top 5 labels
        const label = data.labels[i];
        console.log(`\n🔍 Processing Gemini label ${i + 1}: "${label.description}" (confidence: ${label.score})`);
        
        // Generate search terms for this specific label
        let searchTerms = [label.description];
        
        // Map generic terms to more specific database terms
        const lowerDesc = label.description.toLowerCase();
        if (lowerDesc.includes('pizza') || lowerDesc.includes('æske') || lowerDesc.includes('box')) {
          searchTerms = ['kasse', 'pizza', 'emballage', label.description];
        } else if (lowerDesc.includes('cardboard') || lowerDesc.includes('carton') || lowerDesc.includes('container')) {
          searchTerms = ['kasse', 'emballage', 'pap', label.description];
        } else if (lowerDesc === 'papirark' || lowerDesc === 'papir ark') {
          if (label.materiale?.toLowerCase() === 'pap') {
            searchTerms = ['bog', 'kasse', 'emballage', label.description];
          } else {
            searchTerms = ['avis', 'bog', 'konvolut', label.description];
          }
        }
        
        console.log(`🔍 Search terms for "${label.description}":`, searchTerms);
        
        // Find database matches for this specific label
        const matches = await searchWasteInDatabase(searchTerms);
        
        if (matches.length > 0) {
          const bestDbMatch = matches[0];
          
          // Calculate combined score: Gemini confidence × database match quality
          let dbMatchQuality = 1.0; // Base quality
          
          // Boost quality for exact name matches
          if (bestDbMatch.navn?.toLowerCase() === label.description.toLowerCase()) {
            dbMatchQuality = 2.0;
          }
          
          // Boost quality for specific objects over generic materials
          const specificObjects = ['kasse', 'pizza', 'æske', 'flaske', 'dåse', 'bog', 'avis'];
          if (specificObjects.some(obj => bestDbMatch.navn?.toLowerCase().includes(obj))) {
            dbMatchQuality *= 1.5;
          }
          
          // Boost quality for good recycling categories
          const goodCategories = ['Metal', 'Plast', 'Papir', 'Pap', 'Glas', 'Madaffald', 'Tekstilaffald'];
          if (goodCategories.includes(bestDbMatch.hjem)) {
            dbMatchQuality *= 1.2;
          }
          
          // Penalize "Restaffald"
          if (bestDbMatch.hjem === 'Restaffald') {
            dbMatchQuality *= 0.5;
          }
          
          // Penalize generic materials when specific objects are available
          const genericMaterials = ['aluminiumsfolie', 'plastikfolie', 'metalfolie'];
          if (genericMaterials.some(material => bestDbMatch.navn?.toLowerCase().includes(material))) {
            dbMatchQuality *= 0.7;
          }
          
          const combinedScore = label.score * dbMatchQuality;
          
          console.log(`📊 Scoring for "${label.description}":`, {
            geminiScore: label.score,
            dbMatch: bestDbMatch.navn,
            dbCategory: bestDbMatch.hjem,
            dbMatchQuality,
            combinedScore
          });
          
          scoredCandidates.push({
            label,
            dbMatch: bestDbMatch,
            combinedScore,
            dbMatchQuality
          });
        }
      }
      
      // Sort by combined score and select the best candidate
      scoredCandidates.sort((a, b) => b.combinedScore - a.combinedScore);
      
      console.log('\n🏆 Final scoring results:');
      scoredCandidates.forEach((candidate, index) => {
        console.log(`${index + 1}. "${candidate.label.description}" -> "${candidate.dbMatch.navn}" (${candidate.dbMatch.hjem}) - Score: ${candidate.combinedScore.toFixed(3)}`);
      });
      
      if (scoredCandidates.length > 0) {
        const winner = scoredCandidates[0];
        console.log(`\n🎯 Selected winner: "${winner.label.description}" -> "${winner.dbMatch.navn}" (${winner.dbMatch.hjem})`);
        
        return {
          id: Math.random().toString(),
          name: winner.dbMatch.navn,
          image: getIconForCategory(winner.dbMatch.hjem || ""),
          homeCategory: winner.dbMatch.hjem || "Restaffald",
          recyclingCategory: winner.dbMatch.genbrugsplads || "Genbrugsstation - generelt affald",
          description: `Identificeret ved hjælp af AI-analyse. ${winner.dbMatch.variation ? `Variation: ${winner.dbMatch.variation}. ` : ''}${winner.dbMatch.tilstand ? `Tilstand: ${winner.dbMatch.tilstand}. ` : ''}Sortér som angivet eller kontakt din lokale genbrugsstation for specifik vejledning.`,
          confidence: winner.label.score || 0.8,
          timestamp: new Date(),
          aiThoughtProcess: data.thoughtProcess
        };
      }
    }
    
    // Fallback: Try to use material information from Gemini if available
    console.log('❌ No database matches found - checking for material-based fallback');
    
    if (data?.labels && data.labels.length > 0) {
      const topLabel = data.labels[0];
      if (topLabel.materiale) {
        console.log(`🔄 Using material-based fallback for "${topLabel.description}" with material "${topLabel.materiale}"`);
        const sorting = getMaterialSorting(topLabel.materiale, topLabel.description);
        
        return {
          id: Math.random().toString(),
          name: topLabel.description || "Ukendt genstand",
          image: getIconForCategory(sorting.hjem),
          homeCategory: sorting.hjem,
          recyclingCategory: sorting.genbrugsplads,
          description: `Identificeret som ${topLabel.materiale}. Genstanden findes ikke i vores database, men baseret på materialet anbefales sortering som angivet. Kontakt din lokale genbrugsstation hvis du er i tvivl.`,
          confidence: topLabel.score || 0.6,
          timestamp: new Date(),
          aiThoughtProcess: data.thoughtProcess
        };
      }
    }
    
    // Final fallback if no material information available
    console.log('❌ No material information available - returning generic fallback');
    
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