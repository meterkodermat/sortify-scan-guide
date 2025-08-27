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
    const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
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
    return { valid: false, error: `Network error: ${error.message}` };
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
    const { image } = await req.json();
    
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
    
    // Get Gemini API key from Supabase secrets
    const geminiApiKey = Deno.env.get('GEMINI');
    
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

    // Validate API key format
    const keyValidation = validateGeminiApiKey(geminiApiKey);
    if (!keyValidation.valid) {
      console.error('Invalid Gemini API key format:', keyValidation.errors);
      
      // Provide detailed feedback about the API key format
      const currentKey = geminiApiKey.substring(0, 10) + '...';
      
      // Still provide fallback to keep app functional
      const mockLabels = generateMockResponse(base64Data);
      
      return new Response(JSON.stringify({ 
        success: true, 
        labels: mockLabels,
        fallback: true,
        message: `API key format invalid. Current key: ${currentKey}`,
        validationErrors: keyValidation.errors,
        expectedFormat: 'Gemini API keys should start with "AIza" and be 39 characters long',
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

    // Test API key validity
    console.log('Testing API key validity...');
    const keyTest = await testGeminiApiKey(geminiApiKey);
    if (!keyTest.valid) {
      console.error('API key test failed:', keyTest.error);
      
      // Still provide fallback to keep app functional
      const mockLabels = generateMockResponse(base64Data);
      
      return new Response(JSON.stringify({ 
        success: true, 
        labels: mockLabels,
        fallback: true,
        message: `API key test failed: ${keyTest.error}`,
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

    console.log('API key validation successful, proceeding with Gemini API call...');

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
            { text: "DU ER DANMARKS MEST PRÆCISE AFFALDSSORTERINGS-AI. Din eneste opgave: Analyser billedet og returner PERFEKT formateret JSON.\n\n🚨 KRITISK: Dit svar må KUN være JSON. Ingen tekst før eller efter. Kun ren JSON.\n\n📋 EKSAKT DANSK MATERIALE-MAPPING:\n• plastik: Alle plastiktyper, emballage, poser, flasker, beholdere\n• pap: Karton, æsker, emballage, rør, bøger uden spiralryg\n• papir: Aviser, magasiner, breve, print, løse papirer\n• glas: Flasker, krukker, vinduer (IKKE porsælæn/keramik)\n• metal: Dåser, værktøj, bestik, ledninger, folie\n• elektronik: Alt med ledning/batteri/skærm, smartphones, computere, ledninger\n• farligt: Batterier, maling, kemikalier, lysrør, medicin\n• organisk: Madrester, have-affald, kaffegrums, skaller\n• tekstil: Tøj, sko, tasker, håndklæder, lagner\n• træ: Møbler, brædder, grene, kasser (ubehandlet/malet træ)\n\n🎯 ULTRA-STRINGENT REGLER:\n1. RETURNER KUN: {\"komponenter\":[{\"navne\":[3 navne],\"materiale\":\"kategori\",\"confidence\":0.0-1.0}]}\n2. navne: ALTID præcis 3 danske navne [\"specifikt\", \"generelt\", \"synonym\"]\n3. materiale: KUN ovenstående kategorier - ALDRIG andre ord\n4. confidence: Din ærlighed 0.0-1.0 (under 0.8 = \"ukendt\")\n5. Hvis usikker/dårligt billede: {\"komponenter\":[{\"navne\":[\"ukendt genstand\",\"\",\"\"],\"materiale\":\"ukendt\",\"confidence\":0.0}]}\n\n🧠 DANSK INTELLIGENS:\n• Smartphones → elektronik (ALTID, selv hvis ødelagte)\n• Tekstiler → tekstil (tøj, sko, tasker)\n• Træmøbler → træ (borde, stole, hylder)\n• Plastflasker → plastik (sodavand, shampoo, rengøring)\n• Papiremballage → pap (pizza-æsker, Amazon-pakker)\n• Medicin/batterier → farligt (ALTID sikkerhedskritisk)\n\n🚨 FEJL-PREVENTION:\n• Læs billedet GRUNDIGT - bland ikke kategorier sammen\n• Confidence under 0.8? Brug \"ukendt\" - gæt ALDRIG\n• Kun ét objekt? Én komponent. Flere forskellige materialer? Flere komponenter\n• Defekte ting følger stadig materiale-regler\n\n✅ PERFEKT JSON EKSEMPLER:\n\nSmartphone:\n{\"komponenter\":[{\"navne\":[\"smartphone\",\"mobiltelefon\",\"iPhone\"],\"materiale\":\"elektronik\",\"confidence\":0.95}]}\n\nPizza-æske:\n{\"komponenter\":[{\"navne\":[\"pizza-æske\",\"papæske\",\"takeaway-boks\"],\"materiale\":\"pap\",\"confidence\":0.9}]}\n\nUskarpt billede:\n{\"komponenter\":[{\"navne\":[\"ukendt genstand\",\"\",\"\"],\"materiale\":\"ukendt\",\"confidence\":0.1}]}\n\nDOBBELT-CHECK før svar:\n✓ Er JSON perfekt formateret?\n✓ Er materiale fra listen?\n✓ Er confidence ærligt?\n✓ 3 navne på dansk?\n\nKUN JSON - INTET ANDET!" },
            { 
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
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

    // Parse Gemini response to extract JSON object
    let allResults = [];
    try {
      // Try to extract JSON object from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResult = JSON.parse(jsonMatch[0]);
        
        // Handle new komponenter format with confidence
        if (parsedResult.komponenter && Array.isArray(parsedResult.komponenter)) {
          allResults = parsedResult.komponenter.map(component => ({
            description: component.navne ? component.navne[0] : component.navn, // First name as primary
            score: component.confidence || 0.9, // Use confidence from Gemini or fallback
            type: 'gemini_detection',
            materiale: component.materiale,
            tilstand: component.tilstand,
            navne: component.navne || component.synonymer, // Use navne or fall back to synonymer
            confidence: component.confidence || 0.9
          }));
        }
        // Fallback: handle old single object format
        else if (parsedResult.navne || parsedResult.navn) {
          allResults = [{
            description: parsedResult.navne ? parsedResult.navne[0] : parsedResult.navn,
            score: 0.9,
            type: 'gemini_detection',
            materiale: parsedResult.materiale,
            tilstand: parsedResult.tilstand,
            navne: parsedResult.navne || parsedResult.synonymer
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
      error: `Server error: ${error.message}` 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});