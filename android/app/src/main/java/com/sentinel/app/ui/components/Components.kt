package com.sentinel.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sentinel.app.data.model.ExposureScoreResponse
import com.sentinel.app.data.model.Identity
import com.sentinel.app.data.model.Platform
import com.sentinel.app.data.model.DeletionRequest
import com.sentinel.app.ui.theme.*

@Composable
fun ExposureScoreCard(
    data: ExposureScoreResponse?,
    onScanClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = CardDark),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x332563EB))
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Índice de Exposición",
                    style = MaterialTheme.typography.titleLarge,
                    color = TextPrimary
                )
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = Color(0x332563EB)
                ) {
                    Text(
                        text = "Tiempo Real",
                        fontSize = 11.sp,
                        color = Color(0xFF93C5FD),
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Indicador circular
                val ringColor = when {
                    (data?.score ?: 0) >= 65 -> RoseAlert
                    (data?.score ?: 0) >= 35 -> AmberWarning
                    else -> EmeraldGreen
                }

                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .border(3.dp, ringColor, CircleShape)
                        .background(ringColor.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "${data?.score ?: "--"}",
                            fontSize = 26.sp,
                            fontWeight = FontWeight.ExtraBold,
                            fontFamily = FontFamily.Monospace,
                            color = TextPrimary
                        )
                        Text(
                            text = "/ 100",
                            fontSize = 10.sp,
                            color = TextMuted
                        )
                    }
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Riesgo: ${data?.riskLevel ?: "Calculando..."}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = ringColor
                    )
                    Text(
                        text = data?.recommendations?.firstOrNull() ?: "Monitoreando credenciales e identidades.",
                        fontSize = 12.sp,
                        color = TextSecondary,
                        lineHeight = 16.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = onScanClick,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text(text = "Iniciar Escaneo Global", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
fun IdentityItem(identity: Identity, onDelete: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = CardDarkElevated)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = Color(0xFF1E293B)
                    ) {
                        Text(
                            text = identity.type.uppercase(),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = ElectricBlue,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = identity.value,
                        fontSize = 14.sp,
                        fontFamily = FontFamily.Monospace,
                        color = TextPrimary
                    )
                }
                Text(
                    text = identity.label ?: "Identidad",
                    fontSize = 11.sp,
                    color = TextMuted,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            if (identity.breachCount > 0) {
                Text(
                    text = "${identity.breachCount} filtraciones",
                    fontSize = 12.sp,
                    color = RoseAlert,
                    fontWeight = FontWeight.Bold
                )
            } else {
                Text(
                    text = "✓ Protegido",
                    fontSize = 12.sp,
                    color = EmeraldGreen,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun PlatformItem(platform: Platform, onSelect: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = CardDarkElevated),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x222563EB))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = platform.name,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Text(
                    text = "Categoría: ${platform.category} • Dificultad: ${platform.difficulty}/5",
                    fontSize = 11.sp,
                    color = TextMuted
                )
            }

            Button(
                onClick = onSelect,
                colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                shape = RoundedCornerShape(8.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(text = "Borrar", fontSize = 12.sp)
            }
        }
    }
}

@Composable
fun RequestItem(request: DeletionRequest, onConfirm: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = CardDarkElevated)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = request.platformName,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )

                val badgeColor = when (request.urgencyStatus) {
                    "overdue" -> RoseAlert
                    "urgent" -> Color(0xFFF97316)
                    "warning" -> AmberWarning
                    "completed" -> EmeraldGreen
                    else -> ElectricBlue
                }

                val badgeText = when (request.urgencyStatus) {
                    "completed" -> "✓ Purgado"
                    "overdue" -> "🚨 Vencido (Art. 12)"
                    else -> "⏳ ${request.daysRemaining}d restantes"
                }

                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = badgeColor.copy(alpha = 0.15f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, badgeColor.copy(alpha = 0.4f))
                ) {
                    Text(
                        text = badgeText,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = badgeColor,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Plazo legal de 30 días RGPD",
                    fontSize = 11.sp,
                    color = TextMuted
                )

                if (request.status != "completed") {
                    OutlinedButton(
                        onClick = onConfirm,
                        shape = RoundedCornerShape(6.dp),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(text = "Confirmar", fontSize = 11.sp, color = EmeraldGreen)
                    }
                }
            }
        }
    }
}
