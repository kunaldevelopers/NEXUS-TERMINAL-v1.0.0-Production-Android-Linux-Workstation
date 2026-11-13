# 🔨 Building NEXUS TERMINAL from Source

This guide covers building the complete NEXUS TERMINAL APK from scratch, including the frontend web assets, the native C JNI PTY engine, the PRoot binary, and the final Android package.

---

## 1. Prerequisites

### Host Environment
- **Node.js**: v18+ (tested with Node.js v24.9.0)
- **Java Development Kit (JDK)**: JDK 21 (e.g. `C:\Program Files\Java\jdk-21` or Temurin/OpenJDK 21)
- **Android SDK**: API Platform 35 (`android-35`), Build Tools 34.0.0+
- **Android NDK**: NDK r27 (e.g., `27.1.12297006`)
- **CMake**: 3.22.1+

### Target Device
- Any physical Android device running **Android 7.0+ (API 24+)** with an **ARM64 (aarch64)** processor.

---

## 2. Quick Build Steps

### Step 1: Install Node Dependencies
```powershell
npm install
```

### Step 2: Build Web Assets (React + Vite + Tailwind CSS 4)
```powershell
npm run build
```
This produces optimized production bundles in `dist/`.

### Step 3: Sync Web Bundle with Capacitor
```powershell
npx cap sync android
```
This updates `android/app/src/main/assets/public/` with the compiled web application and registers plugin definitions.

### Step 4: Configure Android SDK Path
Ensure `android/local.properties` contains your SDK directory:
```properties
sdk.dir=C:\\Users\\<YourUsername>\\AppData\\Local\\Android\\Sdk
```

And in `android/gradle.properties`, configure JDK 21:
```properties
org.gradle.jvmargs=-Xmx1536m
org.gradle.java.home=C:/Program Files/Java/jdk-21
android.useAndroidX=true
```

### Step 5: (Optional) Rebuilding PRoot Native Binaries
The repository already includes pre-compiled, tested ARM64 binaries in `android/app/src/main/jniLibs/arm64-v8a/`:
- `libproot.so`
- `libproot_loader.so`

If you modify PRoot sources in `native-build/`:
```powershell
powershell -ExecutionPolicy Bypass -File native-build/build_proot.ps1
```

### Step 6: Assemble Debug APK
From the project root:
```powershell
.\android\gradlew.bat -p android assembleDebug
```
The resulting debug APK is created at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 7: Install onto Connected Device
With USB debugging enabled:
```powershell
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Launch the app:
```powershell
adb shell am start -n com.nexusterminal.app/.MainActivity
```

---

## 3. Creating a Signed Release APK

To create an optimized, signed release build for distribution:

### 1. Generate a Keystore (if you don't already have one)
```powershell
keytool -genkeypair -v -keystore nexus-release.jks -alias nexus -keyalg RSA -keysize 4096 -validity 10000
```

### 2. Configure Release Signing in `android/app/build.gradle`
Add a signing config inside `android { ... }`:
```groovy
signingConfigs {
    release {
        storeFile file("path/to/nexus-release.jks")
        storePassword System.getenv("NEXUS_KEYSTORE_PASSWORD")
        keyAlias "nexus"
        keyPassword System.getenv("NEXUS_KEY_PASSWORD")
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

### 3. Build Release APK
```powershell
.\android\gradlew.bat -p android assembleRelease
```
The signed APK will be output to:
```
android/app/build/outputs/apk/release/app-release.apk
```

