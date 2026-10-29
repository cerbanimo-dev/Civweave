plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "cc.civweave.staging"
    compileSdk = 35

    defaultConfig {
        applicationId = "cc.civweave.staging.starling"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-starling-staging"
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    // Compile the canonical native bridge in the repository, not a divergent copy.
    sourceSets.getByName("main").java.srcDir("../../civweave-starling-v1/src/main/java")
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.work:work-runtime-ktx:2.10.2")
}
