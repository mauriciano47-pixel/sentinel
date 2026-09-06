package com.sentinel.app.data.api

import com.sentinel.app.data.model.*
import retrofit2.http.*

interface SentinelApi {

    @GET("auth/me")
    suspend fun getProfile(): Map<String, Any>

    @GET("scan/exposure")
    suspend fun getExposureScore(): ExposureScoreResponse

    @GET("identities")
    suspend fun getIdentities(): Map<String, List<Identity>>

    @POST("identities")
    suspend fun addIdentity(@Body body: Map<String, String>): Map<String, Any>

    @DELETE("identities/{id}")
    suspend fun deleteIdentity(@Path("id") id: String): Map<String, Any>

    @POST("scan")
    suspend fun runScan(@Body body: Map<String, String> = emptyMap()): Map<String, Any>

    @POST("scan/password")
    suspend fun checkPassword(@Body body: Map<String, String>): PasswordCheckResponse

    @GET("platforms")
    suspend fun getPlatforms(
        @Query("category") category: String? = null,
        @Query("search") search: String? = null
    ): PlatformsResponse

    @GET("requests")
    suspend fun getRequests(): RequestsResponse

    @POST("requests")
    suspend fun createRequest(@Body body: Map<String, Any>): Map<String, Any>

    @PATCH("requests/{id}")
    suspend fun updateRequestStatus(
        @Path("id") id: String,
        @Body body: Map<String, String>
    ): Map<String, Any>
}

