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

// Fallback database for unknown items
const fallbackItems = [
  {
    name: 'Ukendt genstand',
    homeCategory: 'Restaffald',
    recyclingCategory: 'Restaffald',
    description: 'Genstanden kunne ikke identificeres. Sortér som restaffald eller kontakt din lokale genbrugsplads for vejledning.'
  }
];

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

    // Search database for matches
    let bestMatch = null;
    let bestScore = 0;

    for (const label of topLabels) {
      const searchTerms = label.description.toLowerCase();
      
      // Search in demo table
      const { data: matches, error: dbError } = await supabase
        .from('demo')
        .select('*')
        .or(`navn.ilike.%${searchTerms}%,synonymer.ilike.%${searchTerms}%`);

      if (dbError) {
        console.error('Database search error:', dbError);
        continue;
      }

      if (matches && matches.length > 0) {
        // Use the first match and combine with Vision confidence
        const match = matches[0];
        const combinedScore = label.score * 100; // Convert to percentage
        
        if (combinedScore > bestScore) {
          bestMatch = {
            id: Date.now().toString(),
            name: match.navn || 'Ukendt genstand',
            image: imageData,
            homeCategory: match.hjem || 'Restaffald',
            recyclingCategory: match.genbrugsplads || 'Restaffald',
            description: `${match.variation || match.navn || 'Ukendt genstand'}. ${match.materiale ? `Materiale: ${match.materiale}. ` : ''}`,
            confidence: Math.round(combinedScore),
            timestamp: new Date()
          };
          bestScore = combinedScore;
        }
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