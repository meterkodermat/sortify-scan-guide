import { supabase } from "@/integrations/supabase/client";

// ============= PHASE 1: Standardize "Not Found" message =============
export const NOT_FOUND_MESSAGE = "Ikke fundet i databasen";

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

// ============= PHASE 4: Enhanced database search with material-aware scoring =============
const searchWasteInDatabase = async (searchTerms: string[], aiMaterial?: string): Promise<any[]> => {
  console.log('🔍 searchWasteInDatabase called with terms:', searchTerms, 'AI material:', aiMaterial);
  
  if (!searchTerms.length) {
    console.log('❌ No search terms provided');
    return [];
  }

  try {
    console.log(`🔍 Database search with ${searchTerms.length} terms`);
    
    const limitedTerms = searchTerms.slice(0, 8);
    const allResults = [];
      
    for (const term of limitedTerms) {
      const cleanTerm = term.toLowerCase().trim();
      if (cleanTerm.length < 1) continue;

      console.log(`🔍 Searching database for term: "${cleanTerm}"`);

      const { data, error } = await supabase
        .from('demo')
        .select('*')
        .or(`navn.ilike.${cleanTerm},navn.ilike.%${cleanTerm}%,synonymer.ilike.%${cleanTerm}%,variation.ilike.%${cleanTerm}%,materiale.ilike.%${cleanTerm}%`)
        .limit(30);

      if (error) {
        console.error(`❌ Database error for term "${cleanTerm}":`, error);
        continue;
      }

      if (data?.length) {
        console.log(`✅ Found ${data.length} matches for "${cleanTerm}":`, 
          data.map(d => `${d.navn} (Materiale: ${d.materiale || 'none'}, Hjem: ${d.hjem})`));
        allResults.push(...data);
      } else {
        console.log(`❌ No matches found for term: "${cleanTerm}"`);
      }
    }
    
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    );

    console.log(`🎯 Total unique results: ${uniqueResults.length}`);

    // PHASE 4: Group by name and prioritize material-matching variants
    const groupedByName = new Map();
    uniqueResults.forEach(item => {
      const name = item.navn?.toLowerCase() || '';
      if (!groupedByName.has(name)) {
        groupedByName.set(name, []);
      }
      groupedByName.get(name).push(item);
    });

    const prioritizedResults = [];
    groupedByName.forEach((variants, name) => {
      if (variants.length === 1) {
        prioritizedResults.push(variants[0]);
      } else {
        console.log(`🔄 Multiple variants found for "${name}":`, variants.map(v => 
          `${v.materiale || 'no material'} -> ${v.hjem}`));
        
        // Sort variants with material-aware prioritization
        const sortedVariants = variants.sort((a, b) => {
          let aScore = 0, bScore = 0;
          
          // PHASE 4: Material matching score
          if (aiMaterial) {
            const aiMat = aiMaterial.toLowerCase();
            const aMat = (a.materiale || '').toLowerCase();
            const bMat = (b.materiale || '').toLowerCase();
            
            // Exact material match gets highest bonus
            if (aMat === aiMat) aScore += 500;
            if (bMat === aiMat) bScore += 500;
            
            // Partial material match
            if (aMat.includes(aiMat) || aiMat.includes(aMat)) aScore += 300;
            if (bMat.includes(aiMat) || aiMat.includes(bMat)) bScore += 300;
            
            // Special plastic handling
            if (aiMat.includes('blød') && aMat.includes('blød')) aScore += 400;
            if (aiMat.includes('blød') && bMat.includes('blød')) bScore += 400;
            if (aiMat.includes('hård') && aMat.includes('hård')) aScore += 400;
            if (aiMat.includes('hård') && bMat.includes('hård')) bScore += 400;
            
            console.log(`  Material scoring: "${a.materiale}" score=${aScore}, "${b.materiale}" score=${bScore}`);
          }
          
          // Clean condition priority
          const aCondition = (a.tilstand || '').toLowerCase();
          const bCondition = (b.tilstand || '').toLowerCase();
          
          const aIsClean = aCondition.includes('rent') || aCondition.includes('tør');
          const bIsClean = bCondition.includes('rent') || bCondition.includes('tør');
          
          if (aIsClean && !bIsClean) aScore += 200;
          if (bIsClean && !aIsClean) bScore += 200;
          
          // Prefer non-Restaffald
          if (a.hjem !== 'Restaffald') aScore += 100;
          if (b.hjem !== 'Restaffald') bScore += 100;
          
          return bScore - aScore;
        });
        
        console.log(`✅ Selected variant for "${name}": ${sortedVariants[0].materiale || 'no material'} -> ${sortedVariants[0].hjem}`);
        prioritizedResults.push(sortedVariants[0]);
      }
    });

    // Final scoring and sorting
    return prioritizedResults.sort((a, b) => {
      let aScore = 0, bScore = 0;
      
      const primaryTerm = searchTerms[0]?.toLowerCase() || '';
      if (!primaryTerm) return 0;
      
      // PHASE 4: Add material precision bonus
      if (aiMaterial) {
        const aiMat = aiMaterial.toLowerCase();
        const aMat = (a.materiale || '').toLowerCase();
        const bMat = (b.materiale || '').toLowerCase();
        
        if (aMat === aiMat) aScore += 600;
        if (bMat === aiMat) bScore += 600;
        
        if (aMat.includes(aiMat)) aScore += 400;
        if (bMat.includes(aiMat)) bScore += 400;
      }
      
      // Exact name match
      if (a.navn?.toLowerCase() === primaryTerm) aScore += 1000;
      if (b.navn?.toLowerCase() === primaryTerm) bScore += 1000;
      
      // Name contains term
      if (a.navn?.toLowerCase().includes(primaryTerm)) aScore += 300;
      if (b.navn?.toLowerCase().includes(primaryTerm)) bScore += 300;
      
      // Synonym match
      if (a.synonymer?.toLowerCase().includes(primaryTerm)) aScore += 300;
      if (b.synonymer?.toLowerCase().includes(primaryTerm)) bScore += 300;
      
      // Condition scoring
      const aCondition = (a.tilstand || '').toLowerCase();
      const bCondition = (b.tilstand || '').toLowerCase();
      
      if (aCondition.includes('rent') || aCondition.includes('tør')) aScore += 200;
      if (bCondition.includes('rent') || bCondition.includes('tør')) bScore += 200;
      
      // Category prioritization
      const goodCategories = ['Metal', 'Plast', 'Papir', 'Pap', 'Glas', 'Madaffald', 'Tekstilaffald'];
      if (goodCategories.includes(a.hjem)) aScore += 150;
      if (goodCategories.includes(b.hjem)) bScore += 150;
      
      if (a.hjem === 'Restaffald') aScore -= 200;
      if (b.hjem === 'Restaffald') bScore -= 200;
      
      return bScore - aScore;
    }).slice(0, 12);

  } catch (error) {
    console.error('Database search error:', error.message);
    return [];
  }
};

// ============= PHASE 2: Improved material classification with description checking =============
const getMaterialSorting = (materiale: string, description?: string): { hjem: string; genbrugsplads: string } => {
  const material = materiale.toLowerCase();
  const desc = description?.toLowerCase() || '';
  
  console.log('🔍 getMaterialSorting called with:', { materiale, description });
  
  // Check description for plastic type hints first
  if (desc.includes('blød') || desc.includes('pose') || desc.includes('folie') || desc.includes('film')) {
    console.log('✅ Description indicates soft plastic');
    return { hjem: 'Plast', genbrugsplads: 'Genbrugsstation - plast' };
  }
  if (desc.includes('hård') || desc.includes('flaske') || desc.includes('beholder')) {
    console.log('✅ Description indicates hard plastic');
    return { hjem: 'Plast', genbrugsplads: 'Genbrugsstation - hård plast' };
  }
  
  // Then check material classification
  if (material.includes('elektronik') || material.includes('elektronisk')) {
    console.log('✅ Matched electronic material');
    return { hjem: 'Farligt affald', genbrugsplads: 'Genbrugsstation - elektronik' };
  } else if (material.includes('blød plastik') || material.includes('blød plast') || 
             material.includes('plastpose') || material.includes('plastfolie') || 
             material.includes('plastfilm') || material.includes('plastindpakning')) {
    console.log('✅ Matched soft plastic material');
    return { hjem: 'Plast', genbrugsplads: 'Genbrugsstation - plast' };
  } else if (material.includes('hård plastik') || material.includes('hård plast')) {
    console.log('✅ Matched hard plastic material');
    return { hjem: 'Plast', genbrugsplads: 'Genbrugsstation - hård plast' };
  } else if (material.includes('plastik') || material.includes('plast')) {
    console.log('✅ Matched generic plastic (defaulting to soft)');
    return { hjem: 'Plast', genbrugsplads: 'Genbrugsstation - plast' };
  } else if (material.includes('metal') || material.includes('stål') || material.includes('aluminium')) {
    console.log('✅ Matched metal material');
    return { hjem: 'Metal', genbrugsplads: 'Genbrugsstation - metal' };
  } else if (material.includes('glas')) {
    console.log('✅ Matched glass material');
    return { hjem: 'Glas', genbrugsplads: 'Genbrugsstation - glas' };
  } else if (material.includes('papir')) {
    console.log('✅ Matched papir material');
    return { hjem: 'Papir', genbrugsplads: 'Genbrugsstation - pap og papir' };  
  } else if (material.includes('pap') || material.includes('karton')) {
    console.log('✅ Matched pap/karton material');
    return { hjem: 'Pap', genbrugsplads: 'Genbrugsstation - pap og papir' };
  } else if (material.includes('tekstil') || material.includes('tøj')) {
    console.log('✅ Matched textile material');
    return { hjem: 'Tekstilaffald', genbrugsplads: 'Genbrugsstation - tekstil' };
  } else if (material.includes('organisk') || material.includes('mad')) {
    console.log('✅ Matched organic material');
    return { hjem: 'Madaffald', genbrugsplads: 'Genbrugsstation - organisk affald' };
  } else {
    console.log('❌ No match found, returning Restaffald');
    return { hjem: 'Restaffald', genbrugsplads: 'Genbrugsstation - restaffald' };
  }
};

// ============= PHASE 2: Intelligent material sorting that combines database + AI =============
const intelligentMaterialSorting = (
  dbMaterial: string | null,
  dbHome: string | null, 
  dbRecycling: string | null,
  aiMaterial: string | null,
  aiDescription: string
): { hjem: string; genbrugsplads: string; source: string } => {
  
  console.log('\n🧠 intelligentMaterialSorting called:');
  console.log('  DB:', { material: dbMaterial, home: dbHome, recycling: dbRecycling });
  console.log('  AI:', { material: aiMaterial, description: aiDescription });
  
  // Check if database has precise material info (e.g., "Plast - blød" vs just "Plast")
  const dbHasPreciseMaterial = dbMaterial && (
    dbMaterial.includes(' - ') || 
    dbMaterial.includes('blød') || 
    dbMaterial.includes('hård')
  );
  
  // If database has both values AND precise material, use database
  if (dbHome && dbRecycling && dbHasPreciseMaterial) {
    console.log('✅ Database has complete + precise info, using database');
    return { hjem: dbHome, genbrugsplads: dbRecycling, source: 'database-precise' };
  }
  
  // If database has both values but generic material, check if AI has more specific info
  if (dbHome && dbRecycling && !dbHasPreciseMaterial && aiMaterial) {
    const aiMat = aiMaterial.toLowerCase();
    const dbMat = (dbMaterial || '').toLowerCase();
    
    // If AI provides more specific plastic type than database
    if (dbMat === 'plast' && (aiMat.includes('blød') || aiMat.includes('hård'))) {
      console.log('✅ AI has more specific plastic type than database, using AI');
      const aiSorting = getMaterialSorting(aiMaterial, aiDescription);
      return { ...aiSorting, source: 'ai-specific' };
    }
  }
  
  // If database has values, use them
  if (dbHome && dbRecycling) {
    console.log('✅ Database has complete info, using database');
    return { hjem: dbHome, genbrugsplads: dbRecycling, source: 'database' };
  }
  
  // If database is incomplete but we have AI material, use AI
  if (aiMaterial) {
    console.log('✅ Database incomplete, using AI material classification');
    const aiSorting = getMaterialSorting(aiMaterial, aiDescription);
    return { ...aiSorting, source: 'ai-fallback' };
  }
  
  // Last resort: use whatever database values we have
  console.log('⚠️ Using partial database values as last resort');
  return { 
    hjem: dbHome || 'Restaffald', 
    genbrugsplads: dbRecycling || 'Genbrugsstation - generelt affald',
    source: 'fallback'
  };
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

// ============= PHASE 5: Main identification function with comprehensive logging =============
export const identifyWaste = async (imageData: string): Promise<WasteItem> => {
  // PHASE 5: Decision log for transparency
  const decisionLog: string[] = [];
  
  try {
    console.log('🚀 Starting enhanced waste identification with material-aware matching...');
    decisionLog.push('🚀 Started waste identification');
    
    const { data, error } = await supabase.functions.invoke('vision-proxy', {
      body: { image: imageData }
    });

    if (error) {
      console.error('❌ Vision proxy error:', error);
      throw error;
    }

    console.log('✅ Gemini labels:', data.labels);
    decisionLog.push(`✅ Received ${data.labels?.length || 0} AI labels from Gemini`);

    if (data?.labels && data.labels.length > 0) {
      const scoredCandidates = [];
      
      for (let i = 0; i < Math.min(data.labels.length, 8); i++) {
        const label = data.labels[i];
        console.log(`\n🔍 Processing label ${i + 1}: "${label.description}" (AI confidence: ${label.score})`);
        decisionLog.push(`🔍 Label ${i + 1}: "${label.description}" (confidence: ${label.score.toFixed(3)}, material: ${label.materiale || 'none'})`);
        
        let searchTerms = [label.description];
        
        const lowerDesc = label.description.toLowerCase();
        if (lowerDesc.includes('pizza') || lowerDesc.includes('æske') || lowerDesc.includes('box')) {
          searchTerms = ['kasse', 'pizza', 'æske', 'emballage', 'karton', label.description];
        } else if (lowerDesc.includes('cardboard') || lowerDesc.includes('carton') || lowerDesc.includes('container')) {
          searchTerms = ['kasse', 'emballage', 'pap', 'karton', label.description];
        } else if (lowerDesc === 'papirark' || lowerDesc === 'papir ark') {
          if (label.materiale?.toLowerCase() === 'pap') {
            searchTerms = ['bog', 'kasse', 'emballage', label.description];
          } else {
            searchTerms = ['avis', 'bog', 'konvolut', label.description];
          }
        } else if (lowerDesc.includes('plastik') || lowerDesc.includes('plastic') || lowerDesc.includes('plast')) {
          searchTerms = ['plastik', 'plast', 'plastikemballage', 'plastpose', label.description];
        }
        
        // PHASE 4: Pass AI material to database search for material-aware matching
        const matches = await searchWasteInDatabase(searchTerms, label.materiale);
        
        if (matches.length > 0) {
          const bestDbMatch = matches[0];
          decisionLog.push(`  ✅ Found database match: "${bestDbMatch.navn}" (Material: ${bestDbMatch.materiale || 'none'}, Home: ${bestDbMatch.hjem})`);
          
          let dbMatchQuality = 1.0;
          
          if (bestDbMatch.navn?.toLowerCase() === label.description.toLowerCase()) {
            dbMatchQuality = 2.0;
          }
          
          const specificObjects = ['kasse', 'pizza', 'æske', 'flaske', 'dåse', 'bog', 'avis'];
          if (specificObjects.some(obj => bestDbMatch.navn?.toLowerCase().includes(obj))) {
            dbMatchQuality *= 1.5;
          }
          
          const goodCategories = ['Metal', 'Plast', 'Papir', 'Pap', 'Glas', 'Madaffald', 'Tekstilaffald'];
          if (goodCategories.includes(bestDbMatch.hjem)) {
            dbMatchQuality *= 1.2;
          }
          
          if (bestDbMatch.hjem === 'Restaffald') {
            dbMatchQuality *= 0.5;
          }
          
          const genericMaterials = ['aluminiumsfolie', 'plastikfolie', 'metalfolie'];
          if (genericMaterials.some(material => bestDbMatch.navn?.toLowerCase().includes(material))) {
            dbMatchQuality *= 0.7;
          }
          
          const combinedScore = label.score * dbMatchQuality;
          
          console.log(`📊 Combined score: ${combinedScore.toFixed(3)} (AI: ${label.score.toFixed(3)} × DB quality: ${dbMatchQuality.toFixed(2)})`);
          
          scoredCandidates.push({
            label,
            dbMatch: bestDbMatch,
            combinedScore,
            dbMatchQuality
          });
        } else {
          decisionLog.push(`  ❌ No database match found for "${label.description}"`);
        }
      }
      
      scoredCandidates.sort((a, b) => b.combinedScore - a.combinedScore);
      
      console.log('\n🏆 Final scoring results:');
      decisionLog.push('\n🏆 Final candidate ranking:');
      scoredCandidates.forEach((candidate, index) => {
        const logEntry = `${index + 1}. "${candidate.label.description}" → "${candidate.dbMatch.navn}" (${candidate.dbMatch.hjem}) - Score: ${candidate.combinedScore.toFixed(3)}`;
        console.log(logEntry);
        decisionLog.push(logEntry);
      });
      
      // Retry with less specific terms if no matches found
      if (scoredCandidates.length === 0) {
        console.log('\n🔄 No matches found - attempting broader search...');
        decisionLog.push('\n🔄 No matches found - retrying with broader terms');
        
        const genericSearchTerms = new Set<string>();
        
        // Extract generic terms and materials from AI labels
        for (const label of data.labels.slice(0, 5)) {
          // Add material if available
          if (label.materiale) {
            const material = label.materiale.toLowerCase();
            if (material.includes('plast')) genericSearchTerms.add('plastik');
            else if (material.includes('pap')) genericSearchTerms.add('pap');
            else if (material.includes('papir')) genericSearchTerms.add('papir');
            else if (material.includes('metal')) genericSearchTerms.add('metal');
            else if (material.includes('glas')) genericSearchTerms.add('glas');
            
            decisionLog.push(`  Material: ${label.materiale}`);
          }
          
          // Extract generic words from description
          const desc = label.description.toLowerCase();
          const words = desc.split(/\s+/);
          
          for (const word of words) {
            // Skip very short words
            if (word.length < 3) continue;
            
            // Add common waste categories
            if (['plastik', 'plast', 'pap', 'papir', 'metal', 'glas', 'æske', 'kasse', 
                 'flaske', 'dåse', 'pose', 'emballage', 'karton', 'beholder'].includes(word)) {
              genericSearchTerms.add(word);
            }
          }
        }
        
        if (genericSearchTerms.size > 0) {
          const genericArray = Array.from(genericSearchTerms).slice(0, 5);
          decisionLog.push(`  Broader terms: ${genericArray.join(', ')}`);
          console.log(`🔍 Searching with generic terms: ${genericArray.join(', ')}`);
          
          const genericMatches = await searchWasteInDatabase(genericArray);
          
          if (genericMatches.length > 0) {
            const bestMatch = genericMatches[0];
            decisionLog.push(`  ✅ Found match with broader search: "${bestMatch.navn}"`);
            console.log(`✅ Broader search found: "${bestMatch.navn}"`);
            
            // Use the first AI label for scoring
            const firstLabel = data.labels[0];
            scoredCandidates.push({
              label: firstLabel,
              dbMatch: bestMatch,
              combinedScore: firstLabel.score * 0.7, // Lower confidence for generic match
              dbMatchQuality: 0.7
            });
          } else {
            decisionLog.push(`  ❌ No matches found even with broader search`);
            console.log('❌ Broader search also found no matches');
          }
        }
      }
      
      if (scoredCandidates.length > 0) {
        const winner = scoredCandidates[0];
        console.log(`\n🎯 Selected winner: "${winner.label.description}" -> "${winner.dbMatch.navn}"`);
        decisionLog.push(`\n🎯 WINNER: "${winner.label.description}" → "${winner.dbMatch.navn}"`);
        
        // PHASE 2: Use intelligent material sorting
        const sorting = intelligentMaterialSorting(
          winner.dbMatch.materiale,
          winner.dbMatch.hjem,
          winner.dbMatch.genbrugsplads,
          winner.label.materiale,
          winner.label.description
        );
        
        decisionLog.push(`📋 Categorization (${sorting.source}):`);
        decisionLog.push(`  Home: ${sorting.hjem}`);
        decisionLog.push(`  Recycling: ${sorting.genbrugsplads}`);
        
        const thoughtProcess = decisionLog.join('\n');
        
        return {
          id: Math.random().toString(),
          name: winner.dbMatch.navn,
          image: getIconForCategory(sorting.hjem),
          homeCategory: sorting.hjem,
          recyclingCategory: sorting.genbrugsplads,
          description: `Identificeret ved hjælp af AI-analyse. ${winner.dbMatch.materiale ? `Materiale: ${winner.dbMatch.materiale}. ` : ''}${winner.dbMatch.variation ? `Variation: ${winner.dbMatch.variation}. ` : ''}${winner.dbMatch.tilstand ? `Tilstand: ${winner.dbMatch.tilstand}. ` : ''}Sortér som angivet eller kontakt din lokale genbrugsstation for specifik vejledning.`,
          confidence: winner.label.score || 0.8,
          timestamp: new Date(),
          aiThoughtProcess: thoughtProcess
        };
      }
    }
    
    // PHASE 1: Use standardized NOT_FOUND_MESSAGE
    console.log(`❌ No database matches found - returning fallback result with "${NOT_FOUND_MESSAGE}"`);
    decisionLog.push(`❌ No matches found - returning fallback`);
    
    return {
      id: Math.random().toString(),
      name: NOT_FOUND_MESSAGE,
      image: "",
      homeCategory: "",
      recyclingCategory: "",
      description: "Genstanden kunne ikke identificeres i vores database. Prøv at søge efter det manuelt eller kontakt din lokale genbrugsstation for vejledning.",
      confidence: 0,
      timestamp: new Date(),
      aiThoughtProcess: decisionLog.join('\n')
    };

  } catch (error) {
    console.error('❌ Error in identifyWaste:', error);
    decisionLog.push(`❌ Error: ${error.message}`);
    
    return {
      id: Math.random().toString(),
      name: NOT_FOUND_MESSAGE,
      image: "",
      homeCategory: "",
      recyclingCategory: "",
      description: "Der opstod en fejl under analysen. Prøv at søge efter det manuelt eller kontakt din lokale genbrugsstation for vejledning.",
      confidence: 0,
      timestamp: new Date(),
      aiThoughtProcess: decisionLog.join('\n')
    };
  }
};