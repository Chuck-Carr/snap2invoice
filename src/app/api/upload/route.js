import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) throw new Error('No file uploaded');

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExt = mime.getExtension(file.type);
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, buffer, { contentType: file.type });
    if (uploadError) throw uploadError;

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from('receipts')
      .getPublicUrl(filePath);

    // Insert row
    const { error: dbError } = await supabase
      .from('receipts')
      .insert([{ file_name: file.name, file_url: publicUrl.publicUrl }]);
    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true, url: publicUrl.publicUrl }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
