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

    // Check if components are physically separate and can be easily separated
    const integratedKeywords = ['del af', 'komponent af', 'indbygget', 'fastgjort', 'integreret', 'del', 'komponent'];
    const separableKeywords = ['net med', 'pose med', 'beholder med', 'kasse med', 'pakke med', 'bæger med'];
    
    const isIntegrated = mappedComponents.some(comp => 
      integratedKeywords.some(keyword => 
        comp.description?.toLowerCase().includes(keyword)
      )
    );
    
    const isPhysicallySeparable = mappedComponents.some(comp => 
      separableKeywords.some(keyword => 
        comp.description?.toLowerCase().includes(keyword)
      )
    );
    
    const canBeSeparated = !isIntegrated || isPhysicallySeparable;

    // Only split if different sorting AND can be separated
    const shouldSplit = !allSameSorting && canBeSeparated && mappedComponents.length > 1;

    const primaryComponent = mappedComponents[0];
    
    return {
      id: Date.now().toString(),
      name: shouldSplit ? 
            `${mappedComponents.length} adskilbare materialer` : 
            primaryComponent.description,
      image: imageData,
      homeCategory: primaryComponent.homeCategory,
      recyclingCategory: primaryComponent.recyclingCategory,
      description: shouldSplit ? 
                   `Indeholder ${mappedComponents.length} materialer der kan adskilles for sortering` : 
                   primaryComponent.description,
      confidence: Math.round(primaryComponent.score * 100),
      timestamp: new Date(),
      components: shouldSplit ? labels.map(label => ({
        genstand: label.description,
        materiale: label.materiale,
        tilstand: label.tilstand
      })) : []
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
