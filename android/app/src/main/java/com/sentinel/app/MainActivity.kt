package com.sentinel.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.sentinel.app.ui.screens.DashboardScreen
import com.sentinel.app.ui.screens.PlatformsScreen
import com.sentinel.app.ui.theme.OledBlack
import com.sentinel.app.ui.theme.SentinelTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SentinelTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = OledBlack
                ) {
                    var currentScreen by remember { mutableStateOf("dashboard") }

                    when (currentScreen) {
                        "dashboard" -> DashboardScreen(
                            onNavigateToPlatforms = { currentScreen = "platforms" }
                        )
                        "platforms" -> PlatformsScreen(
                            onBack = { currentScreen = "dashboard" }
                        )
                    }
                }
            }
        }
    }
}

