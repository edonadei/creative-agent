# Awen AI - Intelligent Creative Assistant

Awen is a memory-aware, pattern-recognizing AI assistant that learns from your interactions and adapts to your communication style. Built with Next.js 15, TypeScript, and Google's Gemini AI, it provides transparent reasoning and intelligent workflow suggestions.

## ✨ Features

### 🧠 **Memory & Learning**
- **Pattern Recognition**: Automatically detects conversation patterns and user preferences
- **Communication Style Adaptation**: Learns whether you prefer direct, casual, detailed, creative, technical, or formal responses
- **User Preference Learning**: Builds a profile of your preferences across 5 categories
- **Cross-Session Memory**: Remembers your preferences across conversations (stored locally)

### 🔍 **Transparent AI Reasoning**
- **Action Log Viewer**: See exactly how the AI makes decisions with step-by-step reasoning
- **4-Tab Transparency Interface**: Reasoning, Patterns, Optimization, and Workflow insights
- **Token Optimization**: Smart model selection and cost optimization with 30-35% savings
- **Confidence Scoring**: Every response includes confidence levels and reasoning chains

### 🎨 **Creative Workflow**
- **Image Prompt Generation**: Creates detailed, professional prompts for AI image generators (DALL-E, Midjourney, Stable Diffusion)
- **Creative Gallery**: Organize and manage your creative assets and prompts
- **Markdown Support**: Full markdown rendering for rich text responses
- **Workflow Suggestions**: AI suggests next steps based on conversation patterns

### 🔄 **Intelligent Interactions**
- **Intent Classification**: Automatically determines if you want text, images, clarification, or contextual reasoning
- **Contextual Responses**: Uses conversation history and patterns to provide relevant responses
- **Workflow Continuation**: Suggests logical next steps based on your interaction patterns
- **Multiple Conversation Sessions**: Organize your chats with session management

## 🏗️ Architecture

### Core Components
- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **AI Integration**: Google Gemini 2.5 Flash and Flash Lite models
- **API Layer**: tRPC for type-safe API communication
- **Memory System**: Pattern recognition, style adaptation, and preference learning
- **Storage**: Local browser storage for privacy and performance

### AI Models Used
- **Gemini 2.5 Flash**: Primary model for complex reasoning and response generation
- **Gemini 2.5 Flash Lite**: Cost-optimized model for simple operations
- **Smart Model Selection**: Automatically chooses the optimal model based on complexity

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd awen-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open the application**
   Navigate to `http://localhost:3000` in your browser

### Getting a Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key to your `.env.local` file

## 📖 How to Use

### Basic Chat
1. Type your message in the input field
2. The AI will classify your intent and respond appropriately
3. Watch the Action Log viewer (bottom right) for transparency into AI reasoning

### Image Prompt Generation
1. Ask for an image: "Create an image of a sunset over mountains"
2. The AI generates a detailed prompt for image generation tools
3. Hover over the prompt card and click "Add to Gallery" to save it
4. Use the prompt with DALL-E, Midjourney, or other AI image generators

### Gallery Management
1. Click the gallery icon (top right) to open the Creative Gallery
2. View your saved images and prompts
3. Delete items by hovering and clicking the delete button
4. Gallery items persist across sessions

### Session Management
1. Click the sidebar toggle (top left) to access conversations
2. Create new sessions with the "New" button
3. Switch between sessions to organize different topics
4. Rename or delete sessions as needed

### AI Reasoning Transparency
1. After each AI response, the Action Log viewer appears (bottom right)
2. Explore 4 tabs:
   - **Reasoning**: Step-by-step decision process
   - **Patterns**: Detected conversation patterns
   - **Optimization**: Token usage and cost optimization
   - **Workflow**: Suggested next steps and actions

## 🎯 Advanced Features

### Communication Style Adaptation
The AI automatically detects and adapts to your communication style:
- **Direct**: Brief, concise responses
- **Casual**: Friendly, conversational tone
- **Detailed**: Comprehensive explanations with examples
- **Creative**: Engaging, imaginative responses
- **Technical**: Precise, implementation-focused
- **Formal**: Professional, structured responses

### Workflow Intelligence
- **Conversation State Tracking**: Beginning → Developing → Deep Dive → Conclusion
- **Pattern-Based Suggestions**: Next steps based on your interaction history
- **Contextual Follow-ups**: AI-generated suggestions for continuing conversations
- **Incomplete Workflow Detection**: Identifies and suggests completing partial workflows

### Token Optimization
- **Smart Model Selection**: Automatically chooses Flash vs Flash Lite based on complexity
- **Conversation History Optimization**: Keeps relevant context while reducing token usage
- **Cost Estimation**: Real-time cost tracking and optimization savings
- **Performance Metrics**: Token usage, processing time, and efficiency metrics

## ⚠️ Current Limitations

### Technical Limitations
- **Local Storage Only**: All data is stored in browser localStorage (no cloud sync)
- **Single User**: No multi-user support or authentication
- **Browser Dependent**: Clearing browser data will reset all conversations and preferences
- **No Real Image Generation**: Generates prompts only, requires external tools for actual images

### AI Model Limitations
- **Gemini API Required**: Requires valid Google Gemini API key and quota
- **English Focused**: Optimized for English conversations
- **Context Window**: Limited by Gemini's context window (conversation history truncation)
- **Rate Limits**: Subject to Google's API rate limiting

### Feature Limitations
- **No File Uploads**: Cannot process uploaded images or documents
- **No Voice Input**: Text-based interactions only
- **No Real-time Collaboration**: Single-user experience
- **No Export Options**: No built-in export for conversations or gallery items

### Privacy & Data
- **Local Storage**: All data remains in your browser (privacy-focused but not backed up)
- **API Calls**: Conversations are sent to Google's Gemini API for processing
- **No Analytics**: No usage tracking or analytics collection

## 🛠️ Development

### Project Structure
```
src/
├── app/                 # Next.js app router pages
├── components/          # React components
├── hooks/              # Custom React hooks
├── server/             # tRPC API routes
├── services/           # AI and memory services
│   ├── memory/         # Pattern recognition and learning
│   ├── models/         # AI model integrations
│   └── optimization/   # Token and cost optimization
├── types/              # TypeScript type definitions
└── trpc/               # tRPC client configuration
```

### Key Services
- **Pattern Recognition**: Analyzes conversation patterns and builds user profiles
- **Communication Style Adapter**: Detects and adapts to user communication preferences
- **User Preference Learning**: Learns and reinforces user preferences over time
- **Workflow Continuation**: Suggests next steps based on conversation context
- **Token Optimizer**: Optimizes API usage and costs

### Building for Production
```bash
npm run build
npm start
```

### Environment Variables
- `GEMINI_API_KEY`: Required - Your Google Gemini API key
- `NODE_ENV`: Automatically set by Next.js

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Google Gemini AI**: For providing the underlying AI capabilities
- **Next.js Team**: For the excellent React framework
- **Tailwind CSS**: For the utility-first CSS framework
- **tRPC**: For type-safe API development

## 📞 Support

For support, questions, or feature requests:
1. Check the existing issues in the repository
2. Create a new issue with detailed information
3. Include steps to reproduce any bugs
4. Provide browser and OS information for technical issues

---

Built with ❤️ using Next.js, TypeScript, and Google Gemini AI