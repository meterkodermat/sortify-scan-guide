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
}

interface VisionResponse {
  success: boolean;
  labels?: VisionLabel[];
  error?: string;
}

export const identifyWaste = async (imageData: string): Promise<WasteItem> => {
  try {
    const { data: visionData, error: visionError } = await supabase.functions.invoke('vision-proxy', {
      body: { image: imageData }
    });

    if (visionError || !visionData?.success || !visionData?.labels?.length) {
      throw new Error('Kunne ikke analysere billedet');
    }

    const labels = visionData.labels || [];
    
    if (!labels.length) {
      throw new Error('Ingen komponenter fundet i billedet');
    }

    // Map each component to its categories
    const mappedComponents = labels.map(label => ({
      ...label,
      homeCategory: label.materiale === 'pap' ? 'Pap' : 
                    label.materiale === 'plastik' ? 'Plast' : 
                    label.materiale === 'glas' ? 'Glas' : 
                    label.materiale === 'metal' ? 'Metal' : 
                    label.materiale === 'elektronik' ? 'Restaffald' : 
                    label.materiale === 'farligt' ? 'Farligt affald' : 
                    label.materiale === 'organisk' ? 'Madaffald' : 
                    label.materiale === 'tekstil' ? 'Tekstilaffald' : 
                    label.materiale === 'træ' ? 'Restaffald' : 'Restaffald',
      recyclingCategory: label.materiale === 'pap' ? 'Pap' : 
                         label.materiale === 'plastik' ? 'Hård plast' : 
                         label.materiale === 'glas' ? 'Glas' : 
                         label.materiale === 'metal' ? 'Metal' : 
                         label.materiale === 'elektronik' ? 'Genbrugsstation' : 
                         label.materiale === 'farligt' ? 'Farligt affald' : 
                         label.materiale === 'organisk' ? 'Ikke muligt' : 
                         label.materiale === 'tekstil' ? 'Tekstilaffald' : 
                         label.materiale === 'træ' ? 'Restaffald' : 'Rest efter sortering'
    }));

    // Check if all components have same sorting categories
    const firstComponent = mappedComponents[0];
    const allSameSorting = mappedComponents.every(comp => 
      comp.homeCategory === firstComponent.homeCategory && 
      comp.recyclingCategory === firstComponent.recyclingCategory
    );

    const primaryComponent = mappedComponents[0];
    
    return {
      id: Date.now().toString(),
      name: allSameSorting || mappedComponents.length === 1 ? 
            primaryComponent.description : 
            `${mappedComponents.length} forskellige materialer`,
      image: imageData,
      homeCategory: primaryComponent.homeCategory,
      recyclingCategory: primaryComponent.recyclingCategory,
      description: allSameSorting || mappedComponents.length === 1 ? 
                   primaryComponent.description : 
                   `Indeholder ${mappedComponents.length} forskellige materialer - se detaljer nedenfor`,
      confidence: Math.round(primaryComponent.score * 100),
      timestamp: new Date(),
      components: allSameSorting ? [] : labels.map(label => ({
        genstand: label.description,
        materiale: label.materiale,
        tilstand: label.tilstand
      }))
    };

  } catch (error) {
    return {
      id: Date.now().toString(),
      name: 'Analyse fejl',
      image: imageData,
      homeCategory: 'Restaffald',
      recyclingCategory: 'Restaffald',
      description: 'Der opstod en teknisk fejl under AI-analysen.',
      confidence: 0,
      timestamp: new Date()
    };
  }
};
