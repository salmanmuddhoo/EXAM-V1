export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: string;
}

export interface AIProvider {
  generateResponse(messages: AIMessage[], examImages: string[], markingSchemeImages: string[]): Promise<AIResponse>;
}

export class GeminiProvider implements AIProvider {
  constructor(private apiKey: string) {}

  async generateResponse(messages: AIMessage[], examImages: string[], markingSchemeImages: string[]): Promise<AIResponse> {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

    const parts: any[] = [];

    for (const message of messages) {
      if (typeof message.content === 'string') {
        if (message.role === 'system') {
          parts.push({ text: `System: ${message.content}` });
        } else {
          parts.push({ text: message.content });
        }
      }
    }

    parts.push({ text: '\n\nEXAM PAPER:' });
    for (const base64Image of examImages) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      });
    }

    if (markingSchemeImages.length > 0) {
      parts.push({ text: '\n\nMARKING SCHEME:' });
      for (const base64Image of markingSchemeImages) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        });
      }
    }

    const response = await fetch(`${url}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    return {
      content: text,
      model: 'gemini-2.0-flash-exp',
      provider: 'google',
    };
  }
}

export class OpenAIProvider implements AIProvider {
  constructor(private apiKey: string) {}

  async generateResponse(messages: AIMessage[], examImages: string[], markingSchemeImages: string[]): Promise<AIResponse> {
    const url = 'https://api.openai.com/v1/chat/completions';

    const messageContent: any[] = [];

    for (const message of messages) {
      if (typeof message.content === 'string') {
        messageContent.push({
          type: 'text',
          text: message.content,
        });
      }
    }

    messageContent.push({ type: 'text', text: '\n\nEXAM PAPER:' });
    for (const base64Image of examImages) {
      messageContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${base64Image}` },
      });
    }

    if (markingSchemeImages.length > 0) {
      messageContent.push({ type: 'text', text: '\n\nMARKING SCHEME:' });
      for (const base64Image of markingSchemeImages) {
        messageContent.push({
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${base64Image}` },
        });
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: messageContent,
          },
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const text = data.choices[0].message.content;

    return {
      content: text,
      model: 'gpt-4o',
      provider: 'openai',
    };
  }
}

export class ClaudeProvider implements AIProvider {
  constructor(private apiKey: string) {}

  async generateResponse(messages: AIMessage[], examImages: string[], markingSchemeImages: string[]): Promise<AIResponse> {
    const url = 'https://api.anthropic.com/v1/messages';

    const messageContent: any[] = [];

    for (const message of messages) {
      if (typeof message.content === 'string') {
        messageContent.push({
          type: 'text',
          text: message.content,
        });
      }
    }

    messageContent.push({ type: 'text', text: '\n\nEXAM PAPER:' });
    for (const base64Image of examImages) {
      messageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: base64Image,
        },
      });
    }

    if (markingSchemeImages.length > 0) {
      messageContent.push({ type: 'text', text: '\n\nMARKING SCHEME:' });
      for (const base64Image of markingSchemeImages) {
        messageContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: base64Image,
          },
        });
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: messageContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${error}`);
    }

    const data = await response.json();
    const text = data.content[0].text;

    return {
      content: text,
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
    };
  }
}

export function getAIProvider(provider: string = 'gemini'): AIProvider {
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const claudeKey = Deno.env.get('CLAUDE_API_KEY');

  switch (provider.toLowerCase()) {
    case 'openai':
      if (!openaiKey) throw new Error('OpenAI API key not configured');
      return new OpenAIProvider(openaiKey);
    case 'claude':
      if (!claudeKey) throw new Error('Claude API key not configured');
      return new ClaudeProvider(claudeKey);
    case 'gemini':
    default:
      if (!geminiKey) throw new Error('Gemini API key not configured');
      return new GeminiProvider(geminiKey);
  }
}