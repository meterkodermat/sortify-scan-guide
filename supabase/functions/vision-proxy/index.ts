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
    
    // Get Gemini API key from Supabase secrets
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      console.error('Gemini API key not found in environment');
      return new Response(JSON.stringify({ success: false, error: 'API configuration error' }), {
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

    // Call Gemini 1.5 Pro API for image analysis
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Analyze this image and identify objects. Return a JSON list of objects with their confidence scores between 0 and 1. Focus on waste items, recyclables, and household objects. Format: [{\"description\": \"object_name\", \"score\": 0.95}]. Keep descriptions simple and in English." },
            { 
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000
        }
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Gemini API error: ${geminiResponse.status}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiResponse.json();
    
    // Check if there are any candidates
    if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content) {
      console.error('No responses from Gemini API');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No analysis results from Gemini API' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const candidate = geminiData.candidates[0];
    const responseText = candidate.content.parts[0].text;

    // Parse Gemini response to extract objects
    let allResults = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\[.*\]/s);
      if (jsonMatch) {
        const parsedResults = JSON.parse(jsonMatch[0]);
        allResults = parsedResults
          .filter((item: any) => item.score >= 0.3) // Filter by confidence
          .map((item: any) => ({
            description: item.description,
            score: item.score,
            type: 'gemini_detection'
          }))
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 10); // Keep top 10 results
      } else {
        // Fallback: extract objects from text response
        const lines = responseText.split('\n');
        for (const line of lines) {
          // Look for patterns like "object_name (confidence: 0.85)" or similar
          const match = line.match(/([a-zA-Z\s]+).*?(\d+\.?\d*)/);
          if (match) {
            const description = match[1].trim().toLowerCase();
            const score = parseFloat(match[2]) > 1 ? parseFloat(match[2]) / 100 : parseFloat(match[2]);
            if (score >= 0.3 && description) {
              allResults.push({
                description,
                score,
                type: 'gemini_detection'
              });
            }
          }
        }
      }
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      console.log('Raw Gemini response:', responseText);
      
      // Last resort: create basic labels from response text
      const words = responseText.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
      const uniqueWords = [...new Set(words)].slice(0, 5);
      allResults = uniqueWords.map((word, index) => ({
        description: word,
        score: 0.8 - (index * 0.1), // Decreasing confidence
        type: 'gemini_fallback'
      }));
    }

    console.log('Gemini API results:', { 
      totalResults: allResults.length,
      responseLength: responseText.length 
    });

    // No translation needed for One Word Strategy - keep English results
    let translatedResults = allResults;

    return new Response(JSON.stringify({ 
      success: true, 
      labels: translatedResults,
      metadata: {
        imageQuality: imageQuality.score,
        totalResults: allResults.length,
        model: 'gemini-1.5-pro',
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