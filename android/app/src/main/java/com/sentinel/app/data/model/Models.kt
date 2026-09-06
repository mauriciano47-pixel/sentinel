package com.sentinel.app.data.model

import com.google.gson.annotations.SerializedName

data class User(
    val id: String,
    val email: String,
    @SerializedName("display_name") val displayName: String?,
    val plan: String
)

data class Identity(
    val id: String,
    @SerializedName("user_id") val userId: String,
    val type: String,
    val value: String,
    val label: String?,
    @SerializedName("breach_count") val breachCount: Int = 0
)

data class Breach(
    val id: String,
    @SerializedName("breach_name") val breachName: String,
    @SerializedName("breach_title") val breachTitle: String?,
    @SerializedName("breach_date") val breachDate: String?,
    @SerializedName("compromised_data") val compromisedData: String?,
    val description: String?
)

data class Platform(
    val id: Int,
    val name: String,
    val category: String,
    val website: String?,
    @SerializedName("deletion_url") val deletionUrl: String?,
    @SerializedName("deletion_method") val deletionMethod: String,
    @SerializedName("deletion_email") val deletionEmail: String?,
    val difficulty: Int,
    val instructions: String?,
    @SerializedName("user_status") val userStatus: String? = null
)

data class DeletionRequest(
    val id: String,
    @SerializedName("platform_name") val platformName: String,
    @SerializedName("platform_category") val platformCategory: String,
    val status: String,
    @SerializedName("sent_at") val sentAt: String?,
    @SerializedName("legal_deadline_days") val legalDeadlineDays: Int = 30,
    @SerializedName("deadline_date") val deadlineDate: String?,
    @SerializedName("days_remaining") val daysRemaining: Int = 0,
    @SerializedName("urgency_status") val urgencyStatus: String = "normal"
)

data class ExposureScoreResponse(
    val score: Int,
    val riskLevel: String,
    val riskColor: String,
    val metrics: ExposureMetrics?,
    val recommendations: List<String> = emptyList()
)

data class ExposureMetrics(
    val totalBreaches: Int,
    val monitoredIdentities: Int,
    val verifiedIdentities: Int,
    val pendingDeletions: Int,
    val completedDeletions: Int
)

data class PasswordCheckResponse(
    val success: Boolean,
    val pwned: Boolean,
    val timesCompromised: Int,
    val advice: String
)

data class PlatformsResponse(
    val total: Int,
    val platforms: List<Platform>
)

data class RequestsResponse(
    val requests: List<DeletionRequest>
)

