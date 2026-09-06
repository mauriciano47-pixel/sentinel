package com.sentinel.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sentinel.app.data.api.RetrofitClient
import com.sentinel.app.data.model.Platform
import com.sentinel.app.ui.components.PlatformItem
import com.sentinel.app.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlatformsScreen(
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var platforms by remember { mutableStateOf<List<Platform>>(emptyList()) }
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedPlatformForGdpr by remember { mutableStateOf<Platform?>(null) }

    fun fetchPlatforms() {
        coroutineScope.launch {
            try {
                val res = RetrofitClient.api.getPlatforms(
                    category = selectedCategory,
                    search = if (searchQuery.isNotBlank()) searchQuery else null
                )
                platforms = res.platforms
            } catch (e: Exception) {
                // Fallback
            }
        }
    }

    LaunchedEffect(selectedCategory, searchQuery) {
        fetchPlatforms()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Catálogo GDPR (50+ Plataformas)", fontWeight = FontWeight.Bold, fontSize = 18.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = OledBlack)
            )
        },
        containerColor = OledBlack
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
        ) {
            // Buscador
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Buscar plataforma (ej. Tinder, PayPal)...") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(10.dp)
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Selector horizontal de categorías
            val categories = listOf(
                null to "Todas",
                "social" to "Social",
                "citas" to "Citas",
                "bigtech" to "Big Tech",
                "streaming" to "Streaming",
                "fintech_comercio" to "Fintech",
                "mensajeria_comunidad" to "Mensajería",
                "data_brokers" to "Data Brokers"
            )

            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(categories) { (catKey, label) ->
                    val isSelected = selectedCategory == catKey
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedCategory = catKey },
                        label = { Text(label, fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = RoyalBlue,
                            selectedLabelColor = TextPrimary
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Lista de plataformas
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                items(platforms) { platform ->
                    PlatformItem(
                        platform = platform,
                        onSelect = {
                            selectedPlatformForGdpr = platform
                        }
                    )
                }
            }
        }
    }

    // Modal / Diálogo de Eliminación RGPD
    selectedPlatformForGdpr?.let { p ->
        AlertDialog(
            onDismissRequest = { selectedPlatformForGdpr = null },
            title = { Text(text = "Eliminación: ${p.name}", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text(
                        text = p.instructions ?: "Sigue las instrucciones oficiales para eliminar tu cuenta.",
                        fontSize = 13.sp,
                        color = TextSecondary
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Método de borrado: ${p.deletionMethod.uppercase()}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = ElectricBlue
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        coroutineScope.launch {
                            RetrofitClient.api.createRequest(mapOf("platformId" to p.id))
                            selectedPlatformForGdpr = null
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue)
                ) {
                    Text("Marcar Enviada (30d)")
                }
            },
            dismissButton = {
                if (p.deletionUrl != null) {
                    TextButton(
                        onClick = {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(p.deletionUrl))
                            context.startActivity(intent)
                        }
                    ) {
                        Text("Abrir Portal", color = EmeraldGreen)
                    }
                }
            },
            containerColor = CardDark
        )
    }
}

