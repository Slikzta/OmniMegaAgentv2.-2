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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IntegrationsScreen(
    modifier: Modifier = Modifier
) {
    var isGitHubConnected by remember { mutableStateOf(false) }
    var isFirebaseConnected by remember { mutableStateOf(true) }
    var isSupabaseConnected by remember { mutableStateOf(true) }

    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Integrations", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text("External Services & Cloud Infrastructure", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
            // Firebase Firestore & Auth Card
            IntegrationCard(
                title = "Firebase Auth & Firestore",
                description = "Real-time persistent cloud storage for conversations, user accounts, and synchronized multi-device history.",
                icon = Icons.Default.Favorite,
                iconColor = Color(0xFFF59E0B),
                isConnected = isFirebaseConnected,
                buttonText = if (isFirebaseConnected) "Connected" else "Connect Firebase",
                onButtonClick = { isFirebaseConnected = !isFirebaseConnected },
                testTag = "firebase_integration_card"
            )

            // GitHub Integration Card
            IntegrationCard(
                title = "GitHub Developer OAuth",
                description = "Access repositories, commit code, manage pull requests, and review project trees directly from chat.",
                icon = Icons.Default.Share,
                iconColor = Color(0xFF8B5CF6),
                isConnected = isGitHubConnected,
                buttonText = if (isGitHubConnected) "Disconnect GitHub" else "Sign in with GitHub",
                onButtonClick = { isGitHubConnected = !isGitHubConnected },
                testTag = "github_integration_card"
            )

            // Supabase Database Card
            IntegrationCard(
                title = "Supabase PostgreSQL",
                description = "Postgres vector database storage for memory embeddings, document knowledge bases, and grounding data.",
                icon = Icons.Default.CheckCircle,
                iconColor = Color(0xFF10B981),
                isConnected = isSupabaseConnected,
                buttonText = if (isSupabaseConnected) "Active" else "Connect Supabase",
                onButtonClick = { isSupabaseConnected = !isSupabaseConnected },
                testTag = "supabase_integration_card"
            )
        }
    }
}

@Composable
fun IntegrationCard(
    title: String,
    description: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconColor: Color,
    isConnected: Boolean,
    buttonText: String,
    onButtonClick: () -> Unit,
    testTag: String
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .testTag(testTag)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = iconColor.copy(alpha = 0.15f),
                    modifier = Modifier.size(40.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(24.dp))
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = if (isConnected) Color(0xFF10B981).copy(alpha = 0.2f) else MaterialTheme.colorScheme.surfaceVariant
                        ) {
                            Text(
                                if (isConnected) "ACTIVE" else "NOT CONNECTED",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isConnected) Color(0xFF10B981) else MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(10.dp))
            Text(description, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 18.sp)
            Spacer(Modifier.height(14.dp))

            Button(
                onClick = onButtonClick,
                colors = if (isConnected) ButtonDefaults.outlinedButtonColors() else ButtonDefaults.buttonColors(),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(buttonText)
            }
        }
    }
}
