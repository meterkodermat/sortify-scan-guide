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

    const primaryComponent = labels[0];
    
    return {
      id: Date.now().toString(),
      name: primaryComponent.description,
      image: imageData,
      homeCategory: primaryComponent.materiale === 'pap' ? 'Pap' : 
                    primaryComponent.materiale === 'plastik' ? 'Plast' : 
                    primaryComponent.materiale === 'glas' ? 'Glas' : 
                    primaryComponent.materiale === 'metal' ? 'Metal' : 
                    primaryComponent.materiale === 'elektronik' ? 'Restaffald' : 
                    primaryComponent.materiale === 'farligt' ? 'Farligt affald' : 
                    primaryComponent.materiale === 'organisk' ? 'Madaffald' : 
                    primaryComponent.materiale === 'tekstil' ? 'Tekstilaffald' : 
                    primaryComponent.materiale === 'træ' ? 'Restaffald' : 'Restaffald',
      recyclingCategory: primaryComponent.materiale === 'pap' ? 'Pap' : 
                         primaryComponent.materiale === 'plastik' ? 'Hård plast' : 
                         primaryComponent.materiale === 'glas' ? 'Glas' : 
                         primaryComponent.materiale === 'metal' ? 'Metal' : 
                         primaryComponent.materiale === 'elektronik' ? 'Genbrugsstation' : 
                         primaryComponent.materiale === 'farligt' ? 'Farligt affald' : 
                         primaryComponent.materiale === 'organisk' ? 'Ikke muligt' : 
                         primaryComponent.materiale === 'tekstil' ? 'Tekstilaffald' : 
                         primaryComponent.materiale === 'træ' ? 'Restaffald' : 'Rest efter sortering',
      description: primaryComponent.description,
      confidence: Math.round(primaryComponent.score * 100),
      timestamp: new Date(),
      components: labels.map(label => ({
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
