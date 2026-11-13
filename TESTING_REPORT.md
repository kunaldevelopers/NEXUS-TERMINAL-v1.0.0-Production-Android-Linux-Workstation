# 🧪 NEXUS TERMINAL — Testing & Hardware Verification Report

**Date**: November 2026  
**Test Environment**: Physical Android Device via ADB  
**App Version**: 1.0.0 Debug (Package: `com.nexusterminal.app`)  
**Base APK Size**: ~7.25 MB (`7,606,062` bytes)  

---

## 1. Physical Device Specifications

- **Device Serial**: `001763595001866`
- **Device Model**: `model:A059P`
- **Primary ABI**: `arm64-v8a` (64-bit ARM)
- **Android OS Version**: Android 16 (API Level 36 Preview)
- **Linux Kernel**: `6.1.157-android14-11-g82d681c9b06b-ab14634535`
- **Memory**: 7,429 MB RAM total (~4.8 GB free during test)
- **Internal Storage**: 61 GB available on `/data`
- **SELinux Status**: `Enforcing`
- **Device Root Status**: Unrooted (`su` binary not present)
- **Page Size Alignment**: 4096 bytes (4KB pages); binaries built with 16KB max page alignment (`-Wl,-z,max-page-size=16384`)

---

## 2. Android 16 Security & W^X Discovery

Android 10+ enforces W^X (Write XOR Execute) memory restrictions for apps targeting SDK 29+, prohibiting executing dynamic binaries or running `mmap(PROT_EXEC)` on files residing in app-writable data directories (`/data/data/com.nexusterminal.app/files/`).

### Resolution Implemented:
1. **Target SDK Compatibility**: `targetSdkVersion = 28` placed the application in the `untrusted_app_27` SELinux domain on Android 16 (`ro.build.version.min_supported_target_sdk = 28`). This allows PRoot guest processes and guest dynamic linkers (`ld-linux-aarch64.so.1`) to execute ELF binaries located in `files/distros/`.
2. **Native Library Placement**: `libproot.so` and `libproot_loader.so` are bundled in `jniLibs/arm64-v8a/` with `android:extractNativeLibs="true"`, ensuring the Android package manager extracts them into `/data/app/.../lib/arm64` where they execute natively without triggering security violations.
3. **16KB ELF Alignment**: All compiled `.so` binaries (`libproot.so`, `libproot_loader.so`, `libnexus_pty.so`) were linked with `-Wl,-z,max-page-size=16384`, guaranteeing seamless execution on devices utilizing 16KB physical memory pages.

---

## 3. End-to-End Test Matrix & Observed Results

| Subsystem | Test Case | Method / Tool | Result |
| :--- | :--- | :--- | :--- |
| **Android Integration** | Cold Application Launch | `am start -W com.nexusterminal.app/.MainActivity` | **PASS** (Zero crashes, cold boot in 738ms, `PID 4738`) |
| **Plugin Architecture** | 6 Capacitor Plugins Registered | Bridge verification in WebView | **PASS** (`NexusTerminal`, `NexusDistro`, `NexusPackage`, `NexusSsh`, `NexusFile`, `NexusSystem`) |
| **Linux Engine** | PRoot Native Version | `libproot.so --version` | **PASS** (v5.1.107.102-nexus, process_vm=yes, seccomp=yes) |
| **PTY Execution** | POSIX PTY Allocation | JNI `openpty()`, `forkpty()` | **PASS** (`libnexus_pty.so` master/slave FDs established) |
| **Terminal Viewport** | Xterm.js 5.5 Rendering | DOM inspection & visual screenshot | **PASS** (JetBrains Mono font, 47x33 cols/rows) |
| **Distro Execution** | Kali Linux ARM64 Interactive Shell | `createSession("kali-mwcc7plm")` | **PASS** (Prompt `┌─[kali:~]\n└─>` rendered, UID 0 in PRoot) |
| **Shell Features** | 24-bit TrueColor & Unicode | ANSI escape sequences | **PASS** (`\x1b[38;2;0;229;255m` and Unicode emojis `🚀✅`) |
| **Window Resize** | Dynamic Terminal Resizing | `resize({ cols: 112, rows: 38 })` + `stty size` | **PASS** (`stty size` confirmed `38 112`) |
| **Process Control** | Signal Transmission & Ctrl+C | `writeInput(\x03)` during `sleep 20` | **PASS** (Interrupt handled cleanly, prompt recovered) |
| **Multi-Session** | Concurrent Terminal Tabs | 2 parallel sessions spawned simultaneously | **PASS** (Independent PTY master FDs, live switching) |
| **Foreground Service** | Notification & Background Keepalive | `TerminalForegroundService` start/stop | **PASS** (Status bar icon `ic_terminal_notification` active) |
| **System Monitor** | Live Hardware Telemetry | `/proc/stat`, `/proc/meminfo`, Android APIs | **PASS** (Real CPU %, 7429 MB RAM, battery temp/voltage, IP) |
| **Encrypted Storage** | SSH Key & Password Vault | Android `EncryptedSharedPreferences` (AES-256) | **PASS** (Encrypted secret saved and retrieved cleanly) |
| **File Operations** | Integrated File Manager | Workstation folder CRUD | **PASS** (`mkdir`, `writeFile`, `chmod 755`, `zip`, delete) |
| **Package Management** | Isolated Package Manager | Native package manager queries | **PASS** (`dpkg` queries in Kali, `apk` in Alpine) |
| **UI Routing** | All 11 Screens Navigable | React Router DOM inspection | **PASS** (Dashboard, Terminal, Distros, Packages, DevTools, Cybersec, SSH, Files, Monitor, AI, Settings) |

---

## 4. Known Limitations & Technical Constraints

1. **User-Space PRoot vs. Real Kernel Root**
   - PRoot emulates root privileges through `ptrace` system call interception. It does **not** provide unrestricted kernel-level capabilities.
   - Operations requiring raw kernel sockets or driver-level hardware control (such as Wi-Fi packet injection, monitor mode, or creating `tun`/`tap` network devices without root) are not supported by the underlying Android OS security sandbox.
2. **Background Execution Limits**
   - Android operating system power management (Doze mode, OEM battery killers) may suspend background execution if the app is placed in deep sleep. Users running long-running builds or background servers should whitelist NEXUS TERMINAL under **Settings > Battery Optimization > Unrestricted**.
3. **Android Storage Scoped Storage**
   - Direct POSIX file modifications on external `/sdcard` directories are constrained by Android's Storage Access Framework (SAF) permission model. Working inside the internal `/nexus` workspace directory (`/data/data/com.nexusterminal.app/files/workspace`) provides native POSIX speed and permissions.

