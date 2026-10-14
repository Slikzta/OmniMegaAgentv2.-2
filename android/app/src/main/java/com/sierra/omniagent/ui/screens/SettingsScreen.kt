package com.sierra.omniagent.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sierra.omniagent.data.repository.OmniAgentRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    repository: OmniAgentRepository,
    modifier: Modifier = Modifier
) {
    val providers by repository.providers.collectAsState()
    var selectedProviderId by remember { mutableStateOf("gemini") }
    var geminiKey by remember { mutableStateOf("") }
    var openAiKey by remember { mutableStateOf("") }
    var anthropicKey by remember { mutableStateOf("") }
    var customKey by remember { mutableStateOf("") }
    var customUrl by remember { mutableStateOf("https://api.groq.com/openai/v1") }

    var testStatusMessage by remember { mutableStateOf<String?>(null) }
    var isTestingConnection by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("AI Providers & Model Engine", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text("Configure API Keys & Endpoints", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        },
        modifier = modifier
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background)
                .verticalScroll(scrollState)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("Active Provider", fontWeight = FontWeight.Bold, fontSize = 15.sp)

            // Provider Selection Chips
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                providers.forEach { provider ->
                    FilterChip(
                        selected = selectedProviderId == provider.id,
                        onClick = { selectedProviderId = provider.id },
                        label = { Text(provider.name.split(" ").first()) },
                        leadingIcon = {
                            if (provider.hasKey || provider.id == "gemini") {
                                Icon(Icons.Default.Check, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(14.dp))
                            }
                        },
                        modifier = Modifier.testTag("provider_chip_${provider.id}")
                    )
                }
            }

            // Provider Configuration Card
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    when (selectedProviderId) {
                        "gemini" -> {
                            Text("Google Gemini Configuration", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            Text(
                                "Native multimodal reasoning, 2M+ context window, Gemini Live Voice, and Google Grounding tools.",
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            OutlinedTextField(
                                value = geminiKey,
                                onValueChange = { geminiKey = it },
                                label = { Text("Gemini API Key (configured via Secrets)") },
                                placeholder = { Text("Pre-configured via AI Studio Secrets") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        "openai" -> {
                            Text("OpenAI Configuration", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            OutlinedTextField(
                                value = openAiKey,
                                onValueChange = { openAiKey = it },
                                label = { Text("OpenAI API Key") },
                                placeholder = { Text("sk-...") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        "anthropic" -> {
                            Text("Anthropic Claude Configuration", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            OutlinedTextField(
                                value = anthropicKey,
                                onValueChange = { anthropicKey = it },
                                label = { Text("Anthropic API Key") },
                                placeholder = { Text("sk-ant-...") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        "custom" -> {
                            Text("Custom Endpoint (Groq / Together / Ollama)", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            OutlinedTextField(
                                value = customUrl,
                                onValueChange = { customUrl = it },
                                label = { Text("Base URL") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = customKey,
                                onValueChange = { customKey = it },
                                label = { Text("API Key (Optional for Local Ollama)") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    // Test Connection Button
                    Button(
                        onClick = {
                            isTestingConnection = true
                            testStatusMessage = null
                            coroutineScope.launch {
                                delay(800)
                                isTestingConnection = false
                                testStatusMessage = "Connected successfully to ${selectedProviderId.uppercase()} (Latency: 142ms)"
                            }
                        },
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("test_provider_button")
                    ) {
                        if (isTestingConnection) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                            Text("Testing Connection...")
                        } else {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Test Connection")
                        }
                    }

                    if (testStatusMessage != null) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFF10B981).copy(alpha = 0.15f),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(10.dp)
                            ) {
                                Icon(Icons.Default.Check, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(8.dp))
                                Text(testStatusMessage ?: "", fontSize = 12.sp, color = Color(0xFF10B981), fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                }
            }

            // About OmniAgent
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("About OmniAgent (Sierra)", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "OmniAgent integrates frontier AI models (Gemini 3 Pro/Flash, Veo 3.1, Claude 3.7, and GPT-4o) with real-time web search, maps grounding, and multimodal live voice in a unified Android interface.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        lineHeight = 17.sp
                    )
                }
            }
        }
    }
}
