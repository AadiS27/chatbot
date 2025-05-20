import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    // Parse the form data
    const formData = await request.formData();
    const pdfFile = formData.get('pdf') as File;
    const userId = formData.get('userId') as string;
    
    if (!pdfFile || !userId) {
      return NextResponse.json(
        { error: 'PDF file and userId are required' },
        { status: 400 }
      );
    }

    // Generate a unique ID for the document
    const documentId = uuidv4();
    
    // Get file content as buffer
    const bytes = await pdfFile.arrayBuffer();
    
    try {
      // First save the document with a placeholder content
      const { error: uploadError } = await supabase
        .from('documents')
        .insert({
          id: documentId,
          user_id: userId,
          filename: pdfFile.name,
          content: `[Processing ${pdfFile.name}...]`,
          created_at: new Date().toISOString()
        });
      
      if (uploadError) {
        console.error('Error storing document in database:', uploadError);
        return NextResponse.json(
          { error: 'Failed to store document' },
          { status: 500 }
        );
      }
      
      // For better PDF handling, send the file to a PDF extraction service
      try {
        // Convert bytes to Base64 for easier handling in APIs
        const base64Data = Buffer.from(bytes).toString('base64');
        
        // Option 1: Process text extraction directly
        let textContent = '';
        
        // Simple text extraction (fallback method)
        // This is a basic method that works on some PDFs but isn't comprehensive
        try {
          // Use a simple text decoder to look for text in the PDF
          // This is not comprehensive but can extract some basic text
          const decoder = new TextDecoder('utf-8');
          const textData = decoder.decode(new Uint8Array(bytes));
          
          // Simple regex to find text patterns in PDF
          // Remove binary and non-printable characters
          textContent = textData
            .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\xFF]/g, '')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\uFFFF]/g, '')
            .replace(/\(\\\d\d\d\)/g, ' ')
            .replace(/\\[\r\n]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
            
          // If we got a reasonable amount of text, use it
          if (textContent.length < 50) {
            textContent = `[Limited text extracted from ${pdfFile.name}. This may be a scanned document or has content that couldn't be automatically extracted.]`;
          }
        } catch (extractError) {
          console.error('Error in simple text extraction:', extractError);
          textContent = `[Text extraction failed for ${pdfFile.name}. The document might be scanned or protected.]`;
        }
        
        // Update the document with whatever text we extracted
        const { error: updateError } = await supabase
          .from('documents')
          .update({
            content: textContent
          })
          .eq('id', documentId);
          
        if (updateError) {
          console.error('Error updating document with parsed content:', updateError);
        }
        
        return NextResponse.json({ 
          documentId, 
          message: 'Document uploaded and processed!',
          contentPreview: textContent.substring(0, 200) + (textContent.length > 200 ? '...' : '')
        });
        
      } catch (parseError) {
        console.error('Error parsing PDF content:', parseError);
        
        // Even if parsing fails, the document was uploaded
        return NextResponse.json({ 
          documentId, 
          message: 'Document uploaded but content extraction was limited',
          warning: 'Unable to fully extract text content from the PDF'
        });
      }
      
    } catch (err) {
      console.error('Error storing document:', err);
      return NextResponse.json(
        { error: 'Failed to store document' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error processing PDF upload:', error);
    return NextResponse.json(
      { error: 'Failed to process PDF', details: String(error) },
      { status: 500 }
    );
  }
}