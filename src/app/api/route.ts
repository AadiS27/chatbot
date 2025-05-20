import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
    try {
        // Get API key from environment variable
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            return NextResponse.json(
                { error: "API key is not configured on the server" },
                { status: 500 }
            );
        }

        // Parse the request body to get user message
        const body = await request.json();
        const { message, history = [], userId = 'anonymous', documentId = null } = body;

        if (!message) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }

        // If documentId is provided, fetch the document content
        let documentContext = '';
        if (documentId) {
            const { data: document, error: documentError } = await supabase
                .from('documents')
                .select('content, filename')
                .eq('id', documentId)
                .single();
            
            if (documentError) {
                console.error("Error fetching document:", documentError);
            } else if (document) {
                documentContext = `The following is content from the document "${document.filename}":\n\n${document.content}\n\nPlease answer the user's question based on the document content above.`;
            }
        }

        // Prepare the conversation for Gemini API
        const messages = [
            ...history,
        ];
        
        // If document context exists, add it as a system message at the beginning
        if (documentContext) {
            messages.unshift({
                role: "user",
                parts: [{ text: documentContext }]
            });
            
            // Add AI acknowledgment of the document
            messages.unshift({
                role: "model",
                parts: [{ text: "I'll answer based on the document you've provided." }]
            });
        }
        
        // Add the current user message
        messages.push({ role: "user", parts: [{ text: message }] });

        // Save the user message to Supabase
        const { error: userMessageError } = await supabase
            .from('chat_messages')
            .insert({
                user_id: userId,
                role: 'user',
                content: message,
                created_at: new Date().toISOString(),
                document_id: documentId  // Add document_id to the message if applicable
            });

        if (userMessageError) {
            console.error("Error saving user message to Supabase:", userMessageError);
        }

        // Make request to Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: messages,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                    }
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API error:", errorData);
            return NextResponse.json(
                { error: "Failed to get response from Gemini", details: errorData },
                { status: 500 }
            );
        }

        const data = await response.json();
        
        // Extract the assistant's response
        const assistantResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response";
        
        // Create the model response object
        const modelResponse = { role: "model", parts: [{ text: assistantResponse }] };
        
        // Save the assistant's response to Supabase
        const { error: botMessageError } = await supabase
            .from('chat_messages')
            .insert({
                user_id: userId,
                role: 'model',
                content: assistantResponse,
                created_at: new Date().toISOString(),
                document_id: documentId  // Add document_id to the message if applicable
            });

        if (botMessageError) {
            console.error("Error saving bot message to Supabase:", botMessageError);
        }
        
        // Return the assistant's message along with updated conversation history
        return NextResponse.json({
            response: assistantResponse,
            history: [
                ...messages,
                modelResponse
            ]
        });
        
    } catch (error) {
        console.error("Error in chatbot:", error);
        return NextResponse.json(
            { error: "Failed to process chat request", details: String(error) },
            { status: 500 }
        );
    }
}


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'anonymous';
    
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return NextResponse.json({ messages: data });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve chat history' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Delete all chat messages for this user
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error("Error deleting chat history:", error);
      return NextResponse.json(
        { error: "Failed to delete chat history" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in clear history API:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}