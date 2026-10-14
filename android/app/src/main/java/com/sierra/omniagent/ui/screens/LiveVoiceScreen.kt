package com.sierra.omniagent.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sierra.omniagent.data.model.TranscriptItem
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveVoiceScreen(
    modifier: Modifier = Modifier
) {
    var isActive by remember { mutableStateOf(false) }
    var isSpeaking by remember { mutableStateOf(false) }
    var selectedVoice by remember { mutableStateOf("Aoede") }
    var transcripts by remember {
        mutableStateOf(
            listOf(
                TranscriptItem(sender = "sierra", text = "Hi there! I'm listening. Speak freely or hold to talk.")
            )
        )
    }

    val coroutineScope = rememberCoroutineScope()
    val voices = listOf("Aoede", "Zephyr", "Kore", "Puck")

    // Pulsing aura animation
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = if (isActive) 1.25f else 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_scale"
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Live Voice", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text("Gemini 3.1 Flash Live Multimodal", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Voice Selector Chips
            Text(
                "Neural Voice Model",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(8.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                voices.forEach { voice ->
                    FilterChip(
                        selected = selectedVoice == voice,
                        onClick = { selectedVoice = voice },
                        label = { Text(voice) },
                        modifier = Modifier.testTag("voice_chip_$voice")
                    )
                }
            }

            Spacer(Modifier.weight(0.5f))

            // Pulsing Orb Visualizer
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(200.dp)
                    .testTag("live_orb_visualizer")
            ) {
                // Outer glow
                Box(
                    modifier = Modifier
                        .size(180.dp)
                        .scale(pulseScale)
                        .clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                colors = if (isActive) listOf(
                                    Color(0xFF8B5CF6).copy(alpha = 0.4f),
                                    Color(0xFFEC4899).copy(alpha = 0.1f),
                                    Color.Transparent
                                ) else listOf(
                                    Color(0xFF272732).copy(alpha = 0.3f),
                                    Color.Transparent
                                )
                            )
                        )
                )

                // Central interactive button
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(110.dp)
                        .clip(CircleShape)
                        .background(
                            if (isActive) Brush.linearGradient(listOf(Color(0xFF8B5CF6), Color(0xFFEC4899)))
                            else Brush.linearGradient(listOf(Color(0xFF272732), Color(0xFF1E1E26)))
                        )
                        .border(
                            2.dp,
                            if (isActive) Color(0xFFA78BFA) else Color(0xFF3F3F46),
                            CircleShape
                        )
                ) {
                    IconButton(
                        onClick = {
                            isActive = !isActive
                            if (isActive) {
                                coroutineScope.launch {
                                    delay(2000)
                                    transcripts = transcripts + TranscriptItem(
                                        sender = "user",
                                        text = "Hello Sierra! Can you hear me clearly?"
                                    )
                                    delay(1000)
                                    isSpeaking = true
                                    transcripts = transcripts + TranscriptItem(
                                        sender = "sierra",
                                        text = "Loud and clear! I'm streaming live audio with near zero latency using $selectedVoice."
                                    )
                                    delay(3000)
                                    isSpeaking = false
                                }
                            }
                        },
                        modifier = Modifier
                            .fillMaxSize()
                            .testTag("toggle_voice_session")
                    ) {
                        Icon(
                            if (isActive) Icons.Default.Call else Icons.Default.PlayArrow,
                            contentDescription = if (isActive) "Disconnect Voice" else "Start Live Voice",
                            tint = Color.White,
                            modifier = Modifier.size(36.dp)
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            Text(
                if (isActive) (if (isSpeaking) "Sierra is speaking..." else "Listening to your voice...")
                else "Tap orb to start live voice session",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = if (isActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.weight(0.5f))

            // Real-time Transcript Feed
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1.5f)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Info,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text("Live Conversation Transcript", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                    Spacer(Modifier.height(8.dp))
                    Divider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                    Spacer(Modifier.height(8.dp))

                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(transcripts, key = { it.id }) { item ->
                            val isUser = item.sender == "user"
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
                            ) {
                                Surface(
                                    color = if (isUser) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.widthIn(max = 280.dp)
                                ) {
                                    Column(modifier = Modifier.padding(10.dp)) {
                                        Text(
                                            if (isUser) "You" else "Sierra",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 10.sp,
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                        Text(item.text, fontSize = 13.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
