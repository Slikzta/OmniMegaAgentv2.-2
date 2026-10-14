package com.sierra.omniagent.data.repository

import com.sierra.omniagent.data.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.delay

class OmniAgentRepository {

    val personas = listOf(
        Persona(
            id = "sierra-companion",
            name = "Sierra (Companion)",
            roleEmphasis = "Warm, perceptive, and naturally conversational companion.",
            systemInstruction = "You are Sierra, a warm, perceptive, and naturally conversational AI companion. Respond with emotional intelligence and genuine curiosity."
        ),
        Persona(
            id = "sierra-creative",
            name = "Sierra (Creative & Roleplay)",
            roleEmphasis = "Rich storytelling, vivid worldbuilding, and nuanced creative writing.",
            systemInstruction = "You are Sierra in creative mode. Craft immersive narratives, deep character nuance, and vivid sensory descriptions."
        ),
        Persona(
            id = "sierra-architect",
            name = "Sierra (Architect & Code)",
            roleEmphasis = "Deep reasoning, software architecture, technical problem solving.",
            systemInstruction = "You are Sierra technical architect. Provide rigorous engineering insight, clean code, and strategic clarity."
        ),
        Persona(
            id = "omni",
            name = "OmniAgent (Classic)",
            roleEmphasis = "Versatile super-agent combining top frontier model capabilities.",
            systemInstruction = "You are OmniAgent, a versatile super-agent with real-time tools, deep reasoning, and multimodal capabilities."
        )
    )

    private val _sessions = MutableStateFlow<List<ChatSession>>(
        listOf(ChatSession(id = "default", title = "Welcome to OmniAgent"))
    )
    val sessions = _sessions.asStateFlow()

    private val _messages = MutableStateFlow<Map<String, List<ChatMessage>>>(
        mapOf(
            "default" to listOf(
                ChatMessage(
                    role = MessageRole.MODEL,
                    content = "Hello! I'm OmniAgent (Sierra). I bring together the multimodal intelligence of Gemini 3, creative vision, video generation via Veo, and real-time live voice. How can I assist you today?",
                    modelName = "gemini-3-flash-preview"
                )
            )
        )
    )
    val messages = _messages.asStateFlow()

    private val _providers = MutableStateFlow<List<ProviderConfig>>(
        listOf(
            ProviderConfig("gemini", "Google Gemini", "gemini-3-flash-preview", hasKey = true),
            ProviderConfig("openai", "OpenAI", "gpt-4o", baseUrl = "https://api.openai.com/v1"),
            ProviderConfig("anthropic", "Anthropic Claude", "claude-3-7-sonnet-latest", baseUrl = "https://api.anthropic.com/v1"),
            ProviderConfig("custom", "Custom (Groq/Ollama)", "llama-3.3-70b-versatile", baseUrl = "https://api.groq.com/openai/v1"),
        )
    )
    val providers = _providers.asStateFlow()

    fun getMessagesForSession(sessionId: String): List<ChatMessage> {
        return _messages.value[sessionId] ?: emptyList()
    }

    suspend fun sendMessage(
        sessionId: String,
        userText: String,
        attachments: List<String> = emptyList(),
        persona: Persona,
        useSearch: Boolean = false,
        useMaps: Boolean = false
    ): Flow<String> = kotlinx.coroutines.flow.flow {
        val currentList = _messages.value[sessionId]?.toMutableList() ?: mutableListOf()
        val userMsg = ChatMessage(
            role = MessageRole.USER,
            content = userText,
            attachments = attachments
        )
        currentList.add(userMsg)

        val assistantMsgId = java.util.UUID.randomUUID().toString()
        val initialAssistantMsg = ChatMessage(
            id = assistantMsgId,
            role = MessageRole.MODEL,
            content = "",
            isStreaming = true,
            modelName = "gemini-3-flash-preview"
        )
        currentList.add(initialAssistantMsg)
        _messages.value = _messages.value + (sessionId to currentList)

        // Generate response
        val fullResponse = StringBuilder()
        val mockChunks = if (userText.lowercase().contains("code") || userText.lowercase().contains("app")) {
            listOf(
                "Here is an approach for your request:\n\n",
                "```kotlin\n",
                "// OmniAgent Kotlin Architecture\n",
                "class AIBridge {\n",
                "    suspend fun processQuery(query: String) {\n",
                "        println(\"Executing: $query\")\n",
                "    }\n",
                "}\n",
                "```\n\n",
                "This architecture ensures responsive streaming, clean error boundaries, and full lifecycle persistence."
            )
        } else {
            listOf(
                "I understand. ",
                "Based on the latest reasoning capabilities of OmniAgent, ",
                "we can approach this dynamically. ",
                "Is there a specific detail or workflow you'd like to prioritize?"
            )
        }

        for (chunk in mockChunks) {
            delay(120)
            fullResponse.append(chunk)
            emit(chunk)

            // Update state
            val updatedList = _messages.value[sessionId]?.map { msg ->
                if (msg.id == assistantMsgId) {
                    msg.copy(content = fullResponse.toString())
                } else msg
            } ?: emptyList()
            _messages.value = _messages.value + (sessionId to updatedList)
        }

        // Finalize streaming
        val finalizedList = _messages.value[sessionId]?.map { msg ->
            if (msg.id == assistantMsgId) {
                msg.copy(isStreaming = false)
            } else msg
        } ?: emptyList()
        _messages.value = _messages.value + (sessionId to finalizedList)
    }

    fun createNewSession(): String {
        val newId = java.util.UUID.randomUUID().toString()
        val newSession = ChatSession(
            id = newId,
            title = "Conversation #${_sessions.value.size + 1}"
        )
        _sessions.value = listOf(newSession) + _sessions.value
        _messages.value = _messages.value + (newId to listOf(
            ChatMessage(
                role = MessageRole.MODEL,
                content = "Started new conversation. How can I help you?",
                modelName = "gemini-3-flash-preview"
            )
        ))
        return newId
    }

    fun updateProviderKey(providerId: String, apiKey: String, baseUrl: String?) {
        _providers.value = _providers.value.map { p ->
            if (p.id == providerId) {
                p.copy(apiKey = apiKey, baseUrl = baseUrl ?: p.baseUrl, hasKey = apiKey.isNotEmpty())
            } else p
        }
    }
}
