# ⚡ NEXUS TERMINAL

<div align="center">

<p align="center">
  <strong>The Ultimate Android Linux Workstation & Terminal Emulator | Beyond Termux</strong>
</p>
<p align="center">
  <em>Run Kali Linux, Ubuntu, Debian, Alpine, Arch & Parrot OS on Android without Root. Powered by React 19, Tailwind CSS 4, POSIX PTY C Engine, and 16KB Page-Aligned PRoot.</em>
</p>

[![Android Platform](https://img.shields.io/badge/Platform-Android%207.0%20to%2016%20(ARM64)-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/)
[![Root Status](https://img.shields.io/badge/Root-NOT%20REQUIRED-success?style=for-the-badge&logo=linux&logoColor=white)](https://github.com/)
[![PRoot Engine](https://img.shields.io/badge/PRoot-5.1%20(16KB%20Aligned)-E95420?style=for-the-badge&logo=gnubash&logoColor=white)](https://github.com/)
[![React Version](https://img.shields.io/badge/React-19.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind%20CSS-v4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-v7.4-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

<br/>

[📥 **Download Latest APK**](https://github.com/kunaldevelopers/NEXUS-TERMINAL-v1.0.0-Production-Android-Linux-Workstation/releases) • [📖 **Documentation**](#-developer-quick-start) • [✨ **Features**](#-features-at-a-glance) • [🔒 **Security Model**](#-security-architecture) • [❓ **FAQ**](#-frequently-asked-questions)

</div>

---

## 💡 What is NEXUS TERMINAL?

**NEXUS TERMINAL** is a next-generation mobile workstation that transforms any ARM64 Android device into a complete, self-contained Linux development and cybersecurity environment. 

While traditional Android terminal emulators struggle with modern Android OS restrictions (Android 12+ phantom process killer, Android 14/15/16 `W^X` memory enforcement, and 16KB kernel page alignment), NEXUS TERMINAL is engineered from the ground up to solve these challenges natively:

- 🚀 **Zero Root Required**: Runs entirely inside Android's app sandbox via native user-space `ptrace` system call interception.
- 🎨 **Modern AMOLED UI**: Built with React 19, Vite, Tailwind CSS 4, and Xterm.js 5.5 with custom cyberpunk themes, telemetry gauges, and mobile touch toolbars.
- ⚡ **Native C JNI PTY Engine**: Direct POSIX pseudo-terminal allocation (`forkpty`, `openpty`, `termios`) with zero latency and non-blocking I/O.
- 🛡️ **Android 15 & 16 Ready**: Native binaries compiled with `-Wl,-z,max-page-size=16384` for mandatory 16KB page size support.

---

## 📸 Screenshots & UI Preview

<div align="center">
  <p><i>AMOLED Terminal View • Distro Manager • Mobile Shortcut Toolbar • Real-Time Telemetry</i></p>
</div>

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [● REC] NEXUS TERMINAL v1.0.0                      [CPU: 18%] [RAM: 4.2/12GB]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─[kali@nexus-android:~]                                                       │
│  └─$ neofetch                                                                   │
│         ......           OS: Kali GNU/Linux Rolling aarch64                     │
│        .......           Host: Nexus Linux Container (PRoot 5.1)                │
│       .........          Kernel: 6.6.0-android16-arm64                          │
│      ...........         Uptime: 4 hours, 12 mins                               │
│     .............        Packages: 842 (dpkg)                                   │
│    ...............       Shell: bash 5.2.21                                     │
│   .................      Terminal: Xterm.js (TrueColor)                         │
│  ...................     CPU: ARM Cortex-A715 / X3 (8 cores)                    │
│                          Memory: 4210MiB / 11840MiB                             │
│                                                                                 │
│  ┌─[kali@nexus-android:~]                                                       │
│  └─$ python3 server.py                                                          │
│  [+] Serving HTTP on 0.0.0.0 port 8080 (http://localhost:8080/) ...             │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│ [ESC] [CTRL] [ALT] [TAB] [ / ] [ - ] [ ~ ] [ | ] [ ↑ ] [ ↓ ] [ ← ] [ → ] [CTRL+C]│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Download & Install (For Users & Students)

You do **not** need to compile any code to use NEXUS TERMINAL.

1. Go to the [**Releases**](https://github.com/kunaldevelopers/NEXUS-TERMINAL-v1.0.0-Production-Android-Linux-Workstation/releases) tab.
2. Download the latest `nexus-terminal-v1.0.0.apk`.
3. Tap on the downloaded APK on your Android phone and select **Install** *(Enable "Install unknown apps" if prompted)*.
4. Launch **Nexus Terminal**:
   - Open the **Distro Manager** tab.
   - Choose your preferred Linux distribution (**Kali Linux**, **Ubuntu 24.04**, **Debian**, or **Alpine**).
   - Tap **Install / Start** — the app downloads, unpacks, and launches your container automatically!

---

## 🛠️ Features at a Glance

| Feature | Description |
| :--- | :--- |
| **🐧 6 Linux Distros** | Instant setup for Kali Linux, Ubuntu 24.04 LTS, Debian Bookworm, Alpine, Arch Linux, and Parrot OS. |
| **💻 Full Dev Environment** | Run Node.js, Python 3, GCC/Clang, Go, Rust, Git, and Java directly on your mobile device. |
| **🛡️ Cybersecurity Suite** | Built-in network diagnostics: Nmap, OpenSSL, Netcat, Whois, Dig, Traceroute, and Curl. |
| **⚡ Native C PTY Engine** | High-performance POSIX pseudo-terminal (`nexus_pty.c`) with 24-bit TrueColor and ANSI support. |
| **⌨️ Mobile Key Bar** | Quick keys for `ESC`, `CTRL`, `ALT`, `TAB`, arrows, pipe `|`, and signal triggers (`Ctrl+C`, `Ctrl+Z`, `Ctrl+D`). |
| **🌐 Built-in SSH & SFTP** | Securely manage remote servers with AES-256 encrypted key storage via Android Keystore. |
| **📂 Integrated File Manager** | Browse internal Linux rootfs, external SDCard, extract `.tar.gz` and `.zip` archives. |
| **📊 Real-Time Telemetry** | Live gauges for CPU utilization, RAM usage, storage partition space, battery temp, and active processes. |
| **🎨 8 AMOLED Themes** | Cyberpunk Neon, Kali Purple, Matrix Green, Dracula, Tokyo Night, Catppuccin, Ubuntu Dark, AMOLED Black. |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│      React 19 + Vite 6 + Tailwind CSS 4 UI             │
│  (Xterm.js 5.5, Lucide Icons, Cyberpunk & AMOLED)      │
└───────────────────────────┬────────────────────────────┘
                            │ Capacitor 7 Bridge (JSON-RPC)
┌───────────────────────────▼────────────────────────────┐
│      Native Android & Kotlin Plugins Engine            │
│  - NexusTerminalPlugin  - NexusDistroPlugin            │
│  - NexusPackagePlugin   - NexusSshPlugin               │
│  - NexusFilePlugin      - NexusSystemPlugin            │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
┌──────────────▼────────────┐  ┌──────────▼──────────────┐
│ POSIX PTY C Engine (JNI)  │  │ Android Native Subsystems│
│ forkpty(), termios, ioctl │  │ - EncryptedSharedPreferences
│ non-blocking fd streaming │  │ - Foreground Service    │
└──────────────┬────────────┘  │ - Storage Access Framework
               │               └─────────────────────────┘
┌──────────────▼─────────────────────────────────────────┐
│ PRoot 5.1 (ARM64 ELF with 16KB Page Alignment)         │
│ ptrace syscall interception, link2symlink, rootfs bind │
└──────────────┬─────────────────────────────────────────┘
               │
┌──────────────▼─────────────────────────────────────────┐
│ Real ARM64 Linux Distributions                         │
│ Kali Linux • Debian Bookworm • Ubuntu 24.04 • Alpine   │
│ Arch Linux • Parrot OS                                 │
└────────────────────────────────────────────────────────┘
```

---

## 👨‍💻 Developer Quick Start (Building from Source)

### 1. Prerequisites
- **Node.js**: v18 or higher (v20+ recommended)
- **Java Development Kit**: JDK 21 (Temurin or OpenJDK 21)
- **Android SDK**: API Platform 35 (`android-35`), Build Tools 34.0.0+
- **Android NDK**: NDK r27 (`27.1.12297006` or newer)
- **CMake**: 3.22.1+

### 2. Clone and Setup
```bash
# 1. Clone the repository
git clone https://github.com/kunaldevelopers/NEXUS-TERMINAL-v1.0.0-Production-Android-Linux-Workstation.git
cd NEXUS-TERMINAL-v1.0.0-Production-Android-Linux-Workstation

# 2. Install JavaScript dependencies
npm install

# 3. Build frontend web assets (Vite + Tailwind CSS 4)
npm run build

# 4. Sync web assets into Android project
npx cap sync android
```

### 3. Build the APK
```bash
# Windows PowerShell
.\android\gradlew.bat -p android assembleDebug

# Linux / macOS
cd android && ./gradlew assembleDebug
```

The compiled APK will be located at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### 4. Install onto Device via ADB
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.nexusterminal.app/.MainActivity
```

For complete build instructions, release keystore signing, and cross-compiling PRoot from source, see [**BUILD.md**](BUILD.md).

---

## 🔒 Security Architecture

1. **Unrooted Sandboxing**: Operates entirely within Android's per-app sandbox via PRoot's `ptrace` system call emulation. No root privileges or bootloader unlocking needed.
2. **W^X Memory Policy Compliance**: Configured with `compileSdk 35` and `targetSdkVersion 28` (`untrusted_app_27`), enabling dynamic `mmap(PROT_EXEC)` required by guest Linux ELF dynamic linkers (`ld-linux-aarch64.so.1`) on Android 10 through 16 without triggering W^X security denials.
3. **16KB ELF Page Alignment**: All native shared libraries (`libproot.so`, `libproot_loader.so`, `libnexus_pty.so`) are compiled with `-Wl,-z,max-page-size=16384` for compatibility with Android 15 and Android 16 kernels.
4. **Hardware-Backed Cryptography**: SSH credentials, private keys, and user tokens are encrypted via AES-256-GCM / AES-256-SIV using Android Keystore `EncryptedSharedPreferences`.

For comprehensive device benchmarks and security logs, see [**TESTING_REPORT.md**](TESTING_REPORT.md).

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><strong>Q: Does my phone need to be rooted?</strong></summary>
<br>
<strong>No!</strong> NEXUS TERMINAL does not require root access. It uses PRoot to intercept system calls like <code>chroot</code> and <code>mount</code> in user-space, creating an authentic isolated Linux environment inside the app's private data storage.
</details>

<details>
<summary><strong>Q: How is this different from Termux?</strong></summary>
<br>
While Termux uses custom patched packages built specifically for Android's Bionic C library, NEXUS TERMINAL runs <strong>authentic, unmodified GNU/Linux distributions</strong> (glibc/musl) such as real Kali Linux and Ubuntu. Furthermore, NEXUS TERMINAL features a modern AMOLED touch interface with tabbed sessions, visual distro installer, SSH SFTP manager, and telemetry monitors built in.
</details>

<details>
<summary><strong>Q: Does it work on Android 14, 15, and 16?</strong></summary>
<br>
<strong>Yes!</strong> NEXUS TERMINAL has been rigorously tested and verified on physical hardware running Android 16 (ARM64). It includes native 16KB page size alignment and SELinux W^X execution mitigations out of the box.
</details>

<details>
<summary><strong>Q: Can I install packages with apt or apk?</strong></summary>
<br>
<strong>Yes!</strong> Inside guest distributions, run standard package commands like <code>apt update && apt install python3 git</code> or <code>apk add nodejs</code> exactly as you would on a desktop Linux server.
</details>

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check out the [issues page](https://github.com/kunaldevelopers/NEXUS-TERMINAL-v1.0.0-Production-Android-Linux-Workstation/issues).

1. Fork the Project (`https://github.com/kunaldevelopers/NEXUS-TERMINAL-v1.0.0-Production-Android-Linux-Workstation/fork`)
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<div align="center">
  <sub>Built with ❤️ for developers, security researchers, and students. If you find this project useful, please consider giving it a ⭐ star!</sub>
</div>
