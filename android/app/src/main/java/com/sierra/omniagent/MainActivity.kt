package com.sierra.omniagent

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.sierra.omniagent.data.model.MediaType
import com.sierra.omniagent.data.repository.OmniAgentRepository
import com.sierra.omniagent.ui.screens.*
import com.sierra.omniagent.ui.theme.OmniAgentTheme

enum class ScreenTab(val title: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    CHAT("Chat", Icons.Default.Email),
    IMAGE("Image", Icons.Default.Face),
    VIDEO("Video", Icons.Default.PlayArrow),
    LIVE("Live", Icons.Default.Call),
    INTEGRATIONS("Integrations", Icons.Default.Share),
    SETTINGS("Settings", Icons.Default.Settings)
}

class MainActivity : ComponentActivity() {
    private val repository = OmniAgentRepository()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            OmniAgentTheme {
                var currentTab by remember { mutableStateOf(ScreenTab.CHAT) }

                BackHandler(enabled = currentTab != ScreenTab.CHAT) {
                    currentTab = ScreenTab.CHAT
                }

                Scaffold(
                    bottomBar = {
                        NavigationBar(
                            modifier = Modifier.testTag("main_navigation_bar")
                        ) {
                            ScreenTab.values().forEach { tab ->
                                NavigationBarItem(
                                    selected = currentTab == tab,
                                    onClick = { currentTab = tab },
                                    icon = { Icon(tab.icon, contentDescription = tab.title) },
                                    label = { Text(tab.title) },
                                    modifier = Modifier.testTag("nav_item_${tab.name.lowercase()}")
                                )
                            }
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                ) { innerPadding ->
                    when (currentTab) {
                        ScreenTab.CHAT -> ChatScreen(
                            repository = repository,
                            onNavigateToSettings = { currentTab = ScreenTab.SETTINGS },
                            modifier = Modifier.padding(innerPadding)
                        )
                        ScreenTab.IMAGE -> MediaGeneratorScreen(
                            initialMediaType = MediaType.IMAGE,
                            modifier = Modifier.padding(innerPadding)
                        )
                        ScreenTab.VIDEO -> MediaGeneratorScreen(
                            initialMediaType = MediaType.VIDEO,
                            modifier = Modifier.padding(innerPadding)
                        )
                        ScreenTab.LIVE -> LiveVoiceScreen(
                            modifier = Modifier.padding(innerPadding)
                        )
                        ScreenTab.INTEGRATIONS -> IntegrationsScreen(
                            modifier = Modifier.padding(innerPadding)
                        )
                        ScreenTab.SETTINGS -> SettingsScreen(
                            repository = repository,
                            modifier = Modifier.padding(innerPadding)
                        )
                    }
                }
            }
        }
    }
}
