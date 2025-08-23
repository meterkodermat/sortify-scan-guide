import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Image quality assessment function
async function assessImageQuality(base64Data: string): Promise<{ score: number, suggestions: string[] }> {
  try {
    // Decode base64 to get image data
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const blob = new Blob([binaryData]);
    
    let score = 1.0;
    const suggestions: string[] = [];
    
    // Check file size (too small indicates low resolution)
    if (blob.size < 50000) { // Less than 50KB
      score -= 0.3;
      suggestions.push('Billede for lille - prøv højere opløsning');
    }
    
    // Check if image is too large (may indicate poor compression)
    if (blob.size > 10000000) { // More than 10MB
      score -= 0.2;
      suggestions.push('Billede for stort - komprimér venligst');
    }
    
    // Basic format validation (this is simplified - in production you'd use more sophisticated analysis)
    const imageHeader = base64Data.substring(0, 50);
    if (!imageHeader.includes('/9j/') && !imageHeader.includes('iVBOR') && !imageHeader.includes('UklG')) {
      score -= 0.4;
      suggestions.push('Ugyldigt billedformat - brug JPEG, PNG eller WebP');
    }
    
    return {
      score: Math.max(0, score),
      suggestions
    };
  } catch (error) {
    console.error('Error assessing image quality:', error);
    return { score: 0.7, suggestions: [] }; // Default to acceptable quality if assessment fails
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { image } = await req.json();
    
    if (!image) {
      return new Response(JSON.stringify({ success: false, error: 'No image provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Remove base64 prefix if present
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Get Google Vision API key from Supabase secrets
    const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    const translationApiKey = Deno.env.get('GOOGLE_CLOUD_TRANSLATION_API_KEY');
    
    if (!apiKey) {
      console.error('Google Vision API key not found in environment');
      return new Response(JSON.stringify({ success: false, error: 'API configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!translationApiKey) {
      console.error('Google Cloud Translation API key not found in environment');
      return new Response(JSON.stringify({ success: false, error: 'Translation API configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Assess image quality first
    const imageQuality = await assessImageQuality(base64Data);
    console.log('Image quality assessment:', imageQuality);
    
    if (imageQuality.score < 0.3) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Image quality too low for reliable analysis',
        qualityScore: imageQuality.score,
        suggestions: imageQuality.suggestions
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call Google Vision API with enhanced features
    const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Data
            },
            features: [
              {
                type: 'LABEL_DETECTION',
                maxResults: 15
              },
              {
                type: 'OBJECT_LOCALIZATION', 
                maxResults: 10
              }
            ]
          }
        ]
      }),
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('Google Vision API error:', errorText);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Vision API error: ${visionResponse.status}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const visionData = await visionResponse.json();
    
    // Check if there are any responses
    if (!visionData.responses || !visionData.responses[0]) {
      console.error('No responses from Vision API');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No analysis results from Vision API' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = visionData.responses[0];
    
    // Check for errors in the response
    if (response.error) {
      console.error('Vision API response error:', response.error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Vision analysis error: ${response.error.message}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract and process labels with confidence filtering
    const labels = response.labelAnnotations || [];
    const objects = response.localizedObjectAnnotations || [];
    
    // Filter labels by confidence threshold (minimum 0.5)
    const filteredLabels = labels
      .filter((label: any) => label.score >= 0.5)
      .map((label: any) => ({
        description: label.description,
        score: label.score,
        type: 'label'
      }));
    
    // Process localized objects with higher priority
    const processedObjects = objects
      .filter((obj: any) => obj.score >= 0.6) // Higher threshold for objects
      .map((obj: any) => ({
        description: obj.name,
        score: obj.score,
        type: 'object',
        boundingBox: obj.boundingPoly
      }));

    // Combine and prioritize objects over general labels
    const allResults = [...processedObjects, ...filteredLabels]
      .sort((a, b) => {
        // Prioritize objects, then by score
        if (a.type === 'object' && b.type !== 'object') return -1;
        if (a.type !== 'object' && b.type === 'object') return 1;
        return b.score - a.score;
      })
      .slice(0, 10); // Keep top 10 results

    console.log('Vision API results:', { 
      labels: filteredLabels.length, 
      objects: processedObjects.length,
      combined: allResults.length 
    });

    // Translate results to Danish using Google Cloud Translation API
    let translatedResults = allResults;
    try {
      if (allResults.length > 0) {
        const textsToTranslate = allResults.map(item => item.description);
        
        const translationResponse = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${translationApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: textsToTranslate,
            target: 'da',
            source: 'en'
          }),
        });

        if (translationResponse.ok) {
          const translationData = await translationResponse.json();
          const translations = translationData.data.translations;
          
          translatedResults = allResults.map((item, index) => ({
            ...item,
            translatedText: translations[index].translatedText.toLowerCase()
          }));
          
          console.log('Translated results:', translatedResults);
        } else {
          console.error('Translation API error:', await translationResponse.text());
        }
      }
    } catch (translationError) {
      console.error('Error translating labels:', translationError);
      // Continue with original results if translation fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      labels: translatedResults,
      metadata: {
        imageQuality: imageQuality.score,
        totalLabels: filteredLabels.length,
        totalObjects: processedObjects.length,
        processingTime: Date.now()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in vision-proxy function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: `Server error: ${error.message}` 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});