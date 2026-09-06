package com.sentinel.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sentinel.app.data.api.RetrofitClient
import com.sentinel.app.data.model.*
import com.sentinel.app.ui.components.*
import com.sentinel.app.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToPlatforms: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var exposureData by remember { mutableStateOf<ExposureScoreResponse?>(null) }
    var identities by remember { mutableStateOf<List<Identity>>(emptyList()) }
    var requests by remember { mutableStateOf<List<DeletionRequest>>(emptyList()) }
    var passwordInput by remember { mutableStateOf("") }
    var passwordFeedback by remember { mutableStateOf<String?>(null) }
    var isCheckingPwd by remember { mutableStateOf(false) }
    var isScanning by remember { mutableStateOf(false) }

    fun refreshData() {
        coroutineScope.launch {
            try {
                exposureData = RetrofitClient.api.getExposureScore()
                val idRes = RetrofitClient.api.getIdentities()
                identities = idRes["identities"] ?: emptyList()
                val reqRes = RetrofitClient.api.getRequests()
                requests = reqRes.requests
            } catch (e: Exception) {
                // Modo resiliente offline
            }
        }
    }

    LaunchedEffect(Unit) {
        refreshData()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "SENTINEL",
                            fontWeight = FontWeight.ExtraBold,
                            color = ElectricBlue,
                            letterSpacing = 1.sp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = Color(0x332563EB)
                        ) {
                            Text(
                                text = "Móvil Soberano",
                                fontSize = 10.sp,
                                color = Color(0xFF93C5FD),
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = OledBlack)
            )
        },
        containerColor = OledBlack
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. Tarjeta de Exposición
            item {
                ExposureScoreCard(
                    data = exposureData,
                    onScanClick = {
                        coroutineScope.launch {
                            isScanning = true
                            try {
                                RetrofitClient.api.runScan()
                                refreshData()
                            } catch (e: Exception) {
                                // Fallback
                            } finally {
                                isScanning = false
                            }
                        }
                    }
                )
            }

            // 2. Auditor de Contraseñas k-Anonymity
            item {
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = CardDark)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Auditor k-Anonymity de Claves",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = TextPrimary
                        )
                        Text(
                            text = "Verifica si una clave fue vulnerada sin revelarla.",
                            fontSize = 11.sp,
                            color = TextMuted,
                            modifier = Modifier.padding(top = 2.dp, bottom = 12.dp)
                        )

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = passwordInput,
                                onValueChange = { passwordInput = it },
                                placeholder = { Text("Contraseña a auditar...", fontSize = 13.sp) },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                                shape = RoundedCornerShape(8.dp)
                            )

                            Button(
                                onClick = {
                                    if (passwordInput.isNotBlank()) {
                                        coroutineScope.launch {
                                            isCheckingPwd = true
                                            try {
                                                val res = RetrofitClient.api.checkPassword(mapOf("password" to passwordInput))
                                                passwordFeedback = res.advice
                                            } catch (e: Exception) {
                                                passwordFeedback = "Error al verificar clave"
                                            } finally {
                                                isCheckingPwd = false
                                            }
                                        }
                                    }
                                },
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue)
                            ) {
                                Text(text = "Probar", fontSize = 12.sp)
                            }
                        }

                        passwordFeedback?.let { feedback ->
                            Text(
                                text = feedback,
                                fontSize = 12.sp,
                                color = if (feedback.contains("⚠️")) RoseAlert else EmeraldGreen,
                                modifier = Modifier.padding(top = 8.dp)
                            )
                        }
                    }
                }
            }

            // 3. Botón hacia Catálogo 50+ Plataformas
            item {
                Button(
                    onClick = onNavigateToPlatforms,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = EmeraldGreen),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(text = "Ver Catálogo de 50+ Plataformas GDPR", fontWeight = FontWeight.Bold)
                }
            }

            // 4. Identidades Monitoreadas
            item {
                Text(
                    text = "Identidades Monitoreadas (${identities.size})",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
            }

            items(identities) { id ->
                IdentityItem(
                    identity = id,
                    onDelete = {
                        coroutineScope.launch {
                            RetrofitClient.api.deleteIdentity(id.id)
                            refreshData()
                        }
                    }
                )
            }

            // 5. Trazabilidad de Solicitudes GDPR (Plazo 30 Días)
            item {
                Text(
                    text = "Trazabilidad de Eliminación (Plazo 30d)",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            items(requests) { req ->
                RequestItem(
                    request = req,
                    onConfirm = {
                        coroutineScope.launch {
                            RetrofitClient.api.updateRequestStatus(req.id, mapOf("status" to "completed"))
                            refreshData()
                        }
                    }
                )
            }

            item { Spacer(modifier = Modifier.height(24.dp)) }
        }
    }
}
