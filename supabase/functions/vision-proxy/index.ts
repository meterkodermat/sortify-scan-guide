import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Version: 2.1.0 - Enhanced troubleshooting (Force redeployment timestamp: 2025-01-24T12:00:00Z)

// Validate Gemini API Key format
function validateGeminiApiKey(apiKey: string): { valid: boolean, errors: string[] } {
  const errors: string[] = [];
  
  if (!apiKey) {
    errors.push('API key is empty');
    return { valid: false, errors };
  }
  
  // Gemini API keys should start with "AIza" and be 39 characters
  if (!apiKey.startsWith('AIza')) {
    errors.push('Gemini API keys should start with "AIza"');
  }
  
  if (apiKey.length !== 39) {
    errors.push(`Expected 39 characters, got ${apiKey.length}`);
  }
  
  // Check for suspicious patterns
  if (/^[a-f0-9]{40}$/.test(apiKey)) {
    errors.push('This looks like a SHA-1 hash, not a Gemini API key');
  }
  
  return { valid: errors.length === 0, errors };
}

// Test API key validity with a simple request
async function testGeminiApiKey(apiKey: string): Promise<{ valid: boolean, error?: string }> {
  try {
    const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hello" }] }],
        generationConfig: { maxOutputTokens: 1 }
      })
    });
    
    if (testResponse.status === 401 || testResponse.status === 403) {
      return { valid: false, error: 'Invalid API key or insufficient permissions' };
    }
    
    if (testResponse.status === 400) {
      const errorBody = await testResponse.text();
      if (errorBody.includes('API key not valid')) {
        return { valid: false, error: 'API key format is invalid' };
      }
      if (errorBody.includes('not available')) {
        return { valid: false, error: 'Gemini API not available in your region' };
      }
    }
    
    return { valid: testResponse.ok, error: testResponse.ok ? undefined : `HTTP ${testResponse.status}` };
  } catch (error) {
    return { valid: false, error: `Network error: ${(error as Error).message}` };
  }
}

// Generate fallback mock response
function generateMockResponse(base64Data: string) {
  const mockObjects = [
    { description: "plastikflaske", score: 0.85 },
    { description: "papir", score: 0.78 },
    { description: "dåse", score: 0.72 },
    { description: "madkasse", score: 0.68 },
    { description: "flaske", score: 0.65 }
  ];
  
  // Simple pseudo-random selection based on image hash
  const imageHash = base64Data.substring(0, 10);
  const seed = imageHash.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const selectedObjects = mockObjects.slice(0, 2 + (seed % 3));
  
  return selectedObjects.map(obj => ({
    ...obj,
    type: 'mock_detection'
  }));
}

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
    const { image, textQuery, simple = false } = await req.json();
    
    // Handle text-only queries for AI suggestions
    if (textQuery && !image) {
      console.log(`Processing text query: "${textQuery}"`);
      
      // Simple text-based categorization
      const normalizedQuery = textQuery.toLowerCase().trim();
      
      let materiale = 'ukendt';
      let description = textQuery;
      
      // Specific item categorization with emphasis on fruits being organic
      if (normalizedQuery.includes('appelsin') || normalizedQuery.includes('orange') || 
          normalizedQuery.includes('citrus') || normalizedQuery.includes('frugt') ||
          normalizedQuery.includes('banan') || normalizedQuery.includes('æble')) {
        materiale = 'organisk';
        description = normalizedQuery.includes('appelsin') ? 'Appelsin' : 
                     normalizedQuery.includes('orange') ? 'Orange' : 
                     normalizedQuery.includes('banan') ? 'Banan' : 'Frugt';
      } else if (normalizedQuery.includes('net') && (normalizedQuery.includes('appelsin') || normalizedQuery.includes('frugt') || normalizedQuery.includes('grøntsag'))) {
        materiale = 'plastik';
        description = 'Frugt/grøntsagsnet';
      } else if (normalizedQuery.includes('æg')) {
        materiale = 'organisk';
        description = 'Æg';
      } else if (normalizedQuery.includes('mobil') || normalizedQuery.includes('telefon')) {
        materiale = 'elektronik';
        description = 'Mobiltelefon';
      } else if (normalizedQuery.includes('plastik') || normalizedQuery.includes('pose') || normalizedQuery.includes('flaske')) {
        materiale = 'plastik';
      } else if (normalizedQuery.includes('pap') || normalizedQuery.includes('karton')) {
        materiale = 'pap';
      } else if (normalizedQuery.includes('glas')) {
        materiale = 'glas';
      } else if (normalizedQuery.includes('metal') || normalizedQuery.includes('dåse')) {
        materiale = 'metal';
      } else if (normalizedQuery.includes('mad')) {
        materiale = 'organisk';
      } else if (normalizedQuery.includes('tøj') || normalizedQuery.includes('tekstil')) {
        materiale = 'tekstil';
      } else if (normalizedQuery.includes('batteri') || normalizedQuery.includes('farlig')) {
        materiale = 'farligt';
      }
      
      const result = {
        success: true,
        labels: [{
          description: description,
          score: 0.8,
          materiale: materiale
        }]
      };
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!image) {
      return new Response(JSON.stringify({ success: false, error: 'No image provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Remove base64 prefix if present
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Debug: Enhanced environment and regional information
    console.log('Available environment variables:', Object.keys(Deno.env.toObject()));
    console.log('Server region (if available):', Deno.env.get('DENO_REGION') || 'unknown');
    console.log('Deployment ID:', Deno.env.get('DENO_DEPLOYMENT_ID') || 'unknown');
    
    // Get Gemini API key from Supabase secrets (try both possible names)
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI');
    
    console.log('GEMINI_API_KEY present:', !!geminiApiKey);
    console.log('GEMINI_API_KEY length:', geminiApiKey?.length || 0);
    
    if (!geminiApiKey) {
      console.error('Gemini API key not found in environment');
      console.error('This function requires GEMINI_API_KEY to be set in Supabase Edge Function secrets');
      
      // Provide fallback mock response to keep app functional
      const mockLabels = generateMockResponse(base64Data);
      console.log('Using fallback mock response due to missing API key');
      
      return new Response(JSON.stringify({ 
        success: true, 
        labels: mockLabels,
        fallback: true,
        message: 'Using mock data - Gemini API key not configured',
        metadata: {
          imageQuality: 0.8,
          totalResults: mockLabels.length,
          model: 'mock-fallback',
          processingTime: Date.now()
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Skip format validation - let the actual API call validate the key

    // Skip API key test - it wastes quota. Let the actual call fail if invalid.
    console.log('Proceeding with Gemini API call...');

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

    // Call Gemini 2.0 Flash API for image analysis
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: simple 
              ? "Du er en dansk affaldssorteringsekspert. Identificer de vigtigste fysiske genstande i billedet. IGNORER væskeindhold som juice, mælk osv. - fokuser kun på beholdere og fysiske objekter.\n\n**SIMPEL ANALYSE:**\n- Ignorer væsker (juice, mælk, øl osv.) - kun beholdere\n- Fokuser på 1-2 hovedobjekter\n- Hvis du ser tekstiler, vær specifik om typen (fx \"t-shirt\", \"bukser\", \"håndklæde\")\n- Brug generelle kategorier\n\nReturner JSON: {\"komponenter\":[{\"description\":\"specifikt navn\",\"materiale\":\"kategori\",\"score\":0.8}]}. Kun JSON svar."
              : "Du er en dansk affaldssorteringsekspert. VIGTIGT: Kig omhyggeligt på billedet og identificer HVER ENKELT separat fysisk genstand.\n\n**KRITISKE REGLER:**\n- SE GRUNDIGT PÅ BILLEDET - lav ikke antagelser baseret på teksturer eller baggrund\n- IDENTIFICER HVER GENSTAND SEPARAT - list alle synlige objekter\n- SE EFTER: tøjklemmer, fjedre, clips, knapper, og andre små genstande\n- KIG EFTER FORMER: Hvis noget ligner en klemme med to dele, er det sandsynligvis en tøjklemme\n- KIG EFTER METAL SPIRALER: Dette er fjedre\n- Hvis der er 2+ separate genstande, list dem ALLE som individuelle komponenter\n- IGNORER væskeindhold (juice, mælk, øl osv.) - fokuser kun på BEHOLDERE og fysiske objekter\n- Hvis du ser tekstiler, vær MEGET specifik om typen (fx \"T-shirt\", \"bukser\", \"håndklæde\", \"sokker\")\n- For kartoner: identificér som \"juicekarton\", \"mælkekarton\" osv.\n- For plastik: vær specifik om det er blød eller hård plastik\n\n**KATEGORIER:**\n- \"papir\": aviser, flyers, brochurer, løse papirer, dokumenter, blade, magasiner\n- \"pap\": kartoner, kasser, æsker, papkasser (fx juicekarton, mælkekarton, bølgepap)\n- \"blød plastik\": plastposer, plastindpakning, plastfolie, plastfilm, blødt plastikemballage\n- \"hård plastik\": plastikflasker, plastikbakker, hårde plastikbeholdere, plastikdunke, tøjklemmer\n- \"organisk\": madaffald, frugt, grøntsager (IKKE væsker)\n- \"tekstil\": specifikt tøj (t-shirt, bukser, sokker)\n- \"glas\": glasflasker, glasgenstande\n- \"metal\": metaldåser, metalgenstande, fjedre, clips, metalspiraler\n- \"elektronik\": telefoner, computere, fjernbetjeninger\n- \"farligt\": batterier, kemikalier\n\nReturner JSON: {\"komponenter\":[{\"description\":\"specifikt navn\",\"materiale\":\"kategori\",\"score\":0.9}]}. Kun JSON svar." },
            { 
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          maxOutputTokens: 1500,
          temperature: 0.3
        }
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      
      // Specific handling for rate limiting
      if (geminiResponse.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Rate limit overskredet. Vent 1 minut og prøv igen, eller opgrader din Gemini API plan.',
          rateLimited: true
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
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

    // Parse Gemini response to extract JSON object with enhanced logging
    let allResults = [];
    console.log('Raw Gemini response text:', responseText);
    
    try {
      // Try to extract JSON object from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResult = JSON.parse(jsonMatch[0]);
        console.log('Parsed JSON result:', parsedResult);
        
        // Handle new komponenter format with confidence
        if (parsedResult.komponenter && Array.isArray(parsedResult.komponenter)) {
          console.log('Using komponenter format, found:', parsedResult.komponenter.length, 'items');
          allResults = parsedResult.komponenter.map((component: any) => ({
            description: component.description || component.navne?.[0] || component.navn || 'ukendt objekt',
            score: component.score || component.confidence || 0.9,
            type: 'gemini_detection',
            materiale: component.materiale,
            tilstand: component.tilstand,
            navne: component.navne || component.synonymer,
            confidence: component.score || component.confidence || 0.9
          }));
        }
        // Fallback: handle old single object format
        else if (parsedResult.navne || parsedResult.navn || parsedResult.description) {
          console.log('Using single object format');
          allResults = [{
            description: parsedResult.description || (parsedResult.navne ? parsedResult.navne[0] : parsedResult.navn) || 'ukendt objekt',
            score: parsedResult.score || 0.9,
            type: 'gemini_detection',
            materiale: parsedResult.materiale,
            tilstand: parsedResult.tilstand,
            navne: parsedResult.navne || parsedResult.synonymer
          }];
        }
        // Handle case where only material is returned - create a generic description
        else if (parsedResult.materiale) {
          console.log('Creating generic description from material:', parsedResult.materiale);
          const materialDescriptions = {
            'elektronik': 'elektronisk genstand',
            'plastik': 'plastikgenstand',
            'pap': 'papgenstand',
            'papir': 'papirgenstand',
            'glas': 'glasgenstand',
            'metal': 'metalgenstand',
            'farligt': 'farlig genstand',
            'organisk': 'madaffald',
            'tekstil': 'tekstilgenstand',
            'træ': 'trægenstand'
          };
          
          allResults = [{
            description: materialDescriptions[parsedResult.materiale as keyof typeof materialDescriptions] || 'ukendt genstand',
            score: 0.7, // Lower confidence for generic material-only detection
            type: 'gemini_detection',
            materiale: parsedResult.materiale,
            tilstand: parsedResult.tilstand
          }];
        }
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
      error: `Server error: ${(error as Error).message}` 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});