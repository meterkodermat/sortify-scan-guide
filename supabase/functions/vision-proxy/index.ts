import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Call Google Vision API
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

    // Extract labels from the response
    const labels = response.labelAnnotations || [];
    const processedLabels = labels.map((label: any) => ({
      description: label.description,
      score: label.score
    }));

    console.log('Vision API labels:', processedLabels);

    // Translate labels to Danish using Google Cloud Translation API
    let translatedLabels = processedLabels;
    try {
      if (processedLabels.length > 0) {
        const textsToTranslate = processedLabels.map(label => label.description);
        
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
          
          translatedLabels = processedLabels.map((label, index) => ({
            ...label,
            translatedText: translations[index].translatedText.toLowerCase()
          }));
          
          console.log('Translated labels:', translatedLabels);
        } else {
          console.error('Translation API error:', await translationResponse.text());
        }
      }
    } catch (translationError) {
      console.error('Error translating labels:', translationError);
      // Continue with original labels if translation fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      labels: translatedLabels 
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