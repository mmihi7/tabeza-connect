import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Template generation API for staff onboarding
// Uses AI to analyze test receipts and generate regex patterns

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { test_receipts, bar_id } = req.body;

    if (!test_receipts || !Array.isArray(test_receipts) || test_receipts.length < 3) {
      return res.status(400).json({ 
        error: 'At least 3 test receipts required for template generation' 
      });
    }

    if (!bar_id) {
      return res.status(400).json({ 
        error: 'bar_id is required' 
      });
    }

    console.log(`🧠 Generating template for bar: ${bar_id} with ${test_receipts.length} receipts`);

    // Call DeepSeek to analyze receipts and generate template
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Analyze these ${test_receipts.length} receipts and generate regex patterns for consistent parsing.

Receipts:
${test_receipts.join('\n\n---\n\n')}

Requirements:
1. Create regex patterns that work for ALL provided receipts
2. Patterns must be consistent across different receipt formats
3. Include semantic mapping for field extraction
4. Target 85%+ success rate on these test receipts
5. Handle common variations (spacing, currency symbols, etc.)

Return ONLY this JSON format:
{
  "patterns": {
    "item_line": "regex pattern for item lines",
    "total_line": "regex pattern for total lines",
    "date_line": "regex pattern for date (optional)",
    "currency_line": "regex pattern for currency (optional)"
  },
  "semantic_map": {
    "item_line": ["name", "quantity", "unit_price", "line_total"],
    "total_line": ["total"],
    "date_line": ["date"],
    "currency_line": ["currency"]
  },
  "confidence_threshold": 0.85,
  "test_results": {
    "matched": 8,
    "total": 10,
    "success_rate": 0.8
  }
}

Focus on:
- Item lines with: NAME, QUANTITY, PRICE, LINE_TOTAL
- Total lines with: TOTAL amount
- Handling KES currency and common variations
- Robust patterns that work with different spacing
- Clear field mapping for reliable extraction`
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`AI template generation failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('AI returned empty response');
    }

    // Parse JSON from AI response
    const aiText = data.choices[0].message.content;
    const jsonMatch = aiText.match(/\{[\s\S]*\}[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('AI response is not valid JSON');
    }

    const template = JSON.parse(jsonMatch[0]);
    
    // Validate template structure
    if (!template.patterns || !template.semantic_map) {
      throw new Error('AI response missing required patterns or semantic_map');
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Save template to database
    const { data: savedTemplate, error } = await supabase
      .from('receipt_parsing_templates')
      .insert({
        bar_id,
        version: 1, // First version
        patterns: template.patterns,
        semantic_map: template.semantic_map,
        confidence_threshold: template.confidence_threshold || 0.85,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save template:', error);
      return res.status(500).json({ error: 'Failed to save template' });
    }

    console.log(`✅ Template generated and saved: version=1, patterns=${Object.keys(template.patterns).length}`);

    // Deactivate any existing templates for this bar
    await supabase
      .from('receipt_parsing_templates')
      .update({ is_active: false })
      .eq('bar_id', bar_id)
      .eq('is_active', true);

    return res.status(200).json({
      success: true,
      template: savedTemplate,
      message: 'Template generated and activated successfully'
    });

  } catch (error) {
    console.error('Template generation error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
