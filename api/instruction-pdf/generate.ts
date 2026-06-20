import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildInstructionPdf } from '@/utils/instructionPdf';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authorization (service role key from Edge Function)
    const authHeader = req.headers.authorization;
    const providedKey = authHeader?.replace('Bearer ', '');
    
    if (!supabaseServiceKey || providedKey !== supabaseServiceKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { leadId, leadData } = req.body;

    if (!leadId || !leadData) {
      return res.status(400).json({ error: 'Missing leadId or leadData' });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate PDF using the same utility as client-side
    console.log('📄 Generating instruction PDF for lead:', leadId);
    const { doc, fileName } = await buildInstructionPdf(leadData);
    const pdfArrayBuffer = doc.output('arraybuffer');

    // Convert ArrayBuffer to Buffer for Node.js
    const buffer = Buffer.from(pdfArrayBuffer);

    // Upload to Supabase Storage
    console.log('📤 Uploading PDF to storage...');
    const path = `${leadId}/instruction_${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('instructions')
      .upload(path, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Failed to upload PDF:', uploadError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to upload PDF',
        details: uploadError.message 
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('instructions')
      .getPublicUrl(path);

    const publicUrl = urlData?.publicUrl;

    if (!publicUrl) {
      return res.status(500).json({ 
        success: false,
        error: 'Failed to get PDF public URL' 
      });
    }

    console.log('✅ PDF generated and uploaded:', publicUrl);

    return res.status(200).json({
      success: true,
      pdfUrl: publicUrl,
      path,
    });
  } catch (error: any) {
    console.error('❌ PDF generation error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}



