package com.sentinel.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = RoyalBlue,
    secondary = ElectricBlue,
    tertiary = EmeraldGreen,
    background = OledBlack,
    surface = CardDark,
    error = RoseAlert,
    onPrimary = TextPrimary,
    onSecondary = OledBlack,
    onBackground = TextPrimary,
    onSurface = TextPrimary
)

@Composable
fun SentinelTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
