plugins {
    id("com.android.application")
    kotlin("android")
}

android {
    namespace = "cc.civweave.devicehost"
    compileSdk = 35

    defaultConfig {
        applicationId = "cc.civweave.devicehost"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildTypes {
        release {
            isMinifyEnabled = false
            // No release signing key is stored in Git. A distributable release
            // requires the separately controlled Android app-signing identity.
        }
    }
}
