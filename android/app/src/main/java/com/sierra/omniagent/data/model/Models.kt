package com.sierra.omniagent.data.model

enum class MessageRole {
    USER, MODEL, SYSTEM
}

data class ChatMessage(
    val id: String = java.util.UUID.randomUUID().toString(),
    val role: MessageRole = MessageRole.USER,
    val content: String = "",
    val timestamp: Long = System.currentTimeMillis(),
    val attachments: List<String> = emptyList(),
    val modelName: String? = null,
    val isStreaming: Boolean = false,
    val groundingSources: List<GroundingSource> = emptyList(),
    val isVoice: Boolean = false
)

data class GroundingSource(
    val title: String,
    val uri: String
)

data class ChatSession(
    val id: String = java.util.UUID.randomUUID().toString(),
    val title: String = "New Conversation",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val userId: String = ""
)

data class Persona(
    val id: String,
    val name: String,
    val roleEmphasis: String,
    val systemInstruction: String
)

data class ProviderConfig(
    val id: String,
    val name: String,
    val selectedModel: String,
    val apiKey: String = "",
    val baseUrl: String = "",
    val hasKey: Boolean = false
)

data class MediaGenerationState(
    val isGenerating: Boolean = false,
    val progress: Int? = null,
    val statusMessage: String = "",
    val resultUrl: String? = null,
    val mediaType: MediaType = MediaType.IMAGE,
    val error: String? = null
)

enum class MediaType {
    IMAGE, VIDEO
}

data class LiveVoiceState(
    val isActive: Boolean = false,
    val isConnecting: Boolean = false,
    val isSpeaking: Boolean = false,
    val selectedVoice: String = "Aoede",
    val transcripts: List<TranscriptItem> = emptyList(),
    val errorMessage: String? = null
)

data class TranscriptItem(
    val id: String = java.util.UUID.randomUUID().toString(),
    val sender: String, // "user" or "sierra"
    val text: String,
    val timestamp: Long = System.currentTimeMillis()
)
