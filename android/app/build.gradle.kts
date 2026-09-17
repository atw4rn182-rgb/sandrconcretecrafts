import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val localProps = Properties()
val localFile = rootProject.file("local.properties")
if (localFile.exists()) {
    localFile.inputStream().use { localProps.load(it) }
}

fun publicProp(name: String, fallback: String = ""): String {
    return (localProps.getProperty(name) ?: fallback).replace("\\", "\\\\").replace("\"", "\\\"")
}

android {
    namespace = "com.sandrconcretecrafts.pos"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.sandrconcretecrafts.pos"
        minSdk = 33
        targetSdk = 35
        versionCode = 3
        versionName = "0.1.2-test"
        buildConfigField(
            "String",
            "API_BASE_URL",
            "\"${publicProp("SR_API_BASE_URL", "https://www.sandrconcretecrafts.com")}\""
        )
        buildConfigField("String", "SUPABASE_URL", "\"${publicProp("SR_SUPABASE_URL")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${publicProp("SR_SUPABASE_ANON_KEY")}\"")
        buildConfigField(
            "boolean",
            "SIMULATED_READER",
            (localProps.getProperty("SR_SIMULATED_READER") ?: "true").equals("true", ignoreCase = true).toString()
        )
    }

    buildFeatures {
        buildConfig = true
        viewBinding = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // Official current Stripe Tap to Pay pair: https://docs.stripe.com/terminal/payments/setup-reader/tap-to-pay?platform=android
    implementation("com.stripe:stripeterminal-taptopay:5.8.1")
    implementation("com.stripe:stripeterminal-core:5.8.1")

    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("androidx.security:security-crypto:1.0.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}

tasks.register("assertNoBundledSecrets") {
    doLast {
        val root = projectDir
        val scanned = fileTree(root) {
            include("**/*.kt", "**/*.xml", "**/*.kts", "**/*.properties")
            exclude("**/build/**")
        }
        val forbidden = listOf(
            listOf("sk", "live_").joinToString("_"),
            listOf("sk", "test_").joinToString("_"),
            listOf("rk", "live_").joinToString("_"),
            listOf("rk", "test_").joinToString("_"),
            "wh" + "sec_",
            "SERVICE" + "_" + "ROLE",
            "RESEND" + "_" + "API_KEY",
            "STRIPE" + "_" + "SECRET_KEY"
        )
        scanned.forEach { file ->
            val text = file.readText()
            forbidden.forEach { needle ->
                check(!text.contains(needle)) {
                    "Forbidden secret pattern '$needle' found in ${file.relativeTo(root)}"
                }
            }
        }
    }
}

tasks.named("preBuild").configure {
    dependsOn("assertNoBundledSecrets")
}
