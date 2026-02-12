-- Update persona_avatar template with distinctive text to prove DB integration
UPDATE audion.prompt_templates 
SET template = 'Create a photorealistic professional headshot of {{ name }}, who works as {{ profession }}.{{ traits_desc }} The portrait should feature: warm and inviting lighting, subtle depth of field with a softly blurred background, contemporary professional attire, confident yet approachable expression, high-resolution detail, magazine-quality photography.',
    updated_at = NOW()
WHERE name = 'persona_avatar';

-- Verify the update
SELECT name, version, LEFT(template, 100) as template_preview, updated_at 
FROM audion.prompt_templates 
WHERE name = 'persona_avatar';
