package com.nexusterminal.app.distro

import java.net.HttpURLConnection
import java.net.URL

data class DistroDownloadSpec(
    val distroId: String,
    val variant: String,
    val version: String,
    val pkgManager: String,
    val defaultShell: String,
    val url: String,
    val expectedSha256: String?,
    val archiveType: String // "tar.xz" or "tar.gz"
)

object DistroCatalog {

    private fun fetchText(urlStr: String): String {
        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15000
            readTimeout = 20000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "NexusTerminal/1.0 (Android; arm64)")
        }
        try {
            val code = conn.responseCode
            if (code !in 200..299) {
                throw IllegalStateException("HTTP $code fetching $urlStr")
            }
            return conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    private fun resolveFromLxcIndex(
        distroKey: String,
        releaseKey: String,
        distroId: String,
        variant: String,
        pkgManager: String,
        defaultShell: String
    ): DistroDownloadSpec {
        val indexText = fetchText("https://images.linuxcontainers.org/meta/1.0/index-user")
        val prefix = "$distroKey;$releaseKey;arm64;default;"
        val line = indexText.lineSequence().firstOrNull { it.startsWith(prefix) }
            ?: throw IllegalStateException("No ARM64 LXC build found for $distroKey/$releaseKey")
        val parts = line.split(";")
        if (parts.size < 6) {
            throw IllegalStateException("Malformed LXC index row: $line")
        }
        val buildDate = parts[4]
        val relPath = parts[5].trimStart('/')
        val baseUrl = "https://images.linuxcontainers.org/$relPath"
        val sumsText = fetchText("${baseUrl}SHA256SUMS")
        val sha = sumsText.lineSequence()
            .firstOrNull { it.trim().endsWith("rootfs.tar.xz") }
            ?.trim()
            ?.split(Regex("\\s+"))
            ?.firstOrNull()
            ?.lowercase()
            ?: throw IllegalStateException("SHA256SUMS missing rootfs.tar.xz at $baseUrl")

        return DistroDownloadSpec(
            distroId = distroId,
            variant = variant,
            version = "$releaseKey ($buildDate)",
            pkgManager = pkgManager,
            defaultShell = defaultShell,
            url = "${baseUrl}rootfs.tar.xz",
            expectedSha256 = sha,
            archiveType = "tar.xz"
        )
    }

    private fun resolveAlpineMinirootfs(): DistroDownloadSpec {
        val yaml = fetchText("https://dl-cdn.alpinelinux.org/alpine/latest-stable/releases/aarch64/latest-releases.yaml")
        val blocks = yaml.split("\n  -\n")
        for (block in blocks) {
            if (block.contains("flavor: alpine-minirootfs")) {
                val version = Regex("""version:\s*([^\s\r\n]+)""").find(block)?.groupValues?.get(1) ?: "latest"
                val file = Regex("""file:\s*([^\s\r\n]+)""").find(block)?.groupValues?.get(1)
                    ?: continue
                val sha256 = Regex("""sha256:\s*([0-9a-fA-F]{64})""").find(block)?.groupValues?.get(1)?.lowercase()
                return DistroDownloadSpec(
                    distroId = "alpine",
                    variant = "minirootfs",
                    version = version,
                    pkgManager = "apk",
                    defaultShell = "/bin/sh",
                    url = "https://dl-cdn.alpinelinux.org/alpine/latest-stable/releases/aarch64/$file",
                    expectedSha256 = sha256,
                    archiveType = "tar.gz"
                )
            }
        }
        throw IllegalStateException("Could not parse Alpine minirootfs release YAML")
    }

    private fun resolveUbuntuBase(): DistroDownloadSpec {
        val sums = fetchText("https://cdimage.ubuntu.com/ubuntu-base/releases/24.04/release/SHA256SUMS")
        val matchLine = sums.lineSequence()
            .filter { it.contains("base-arm64.tar.gz") }
            .lastOrNull()
            ?: throw IllegalStateException("Ubuntu Base arm64 entry not found")
        val parts = matchLine.trim().split(Regex("\\s+"))
        val sha = parts[0].lowercase()
        val file = parts.last().trimStart('*')
        val ver = Regex("""ubuntu-base-([0-9.]+)-base""").find(file)?.groupValues?.get(1) ?: "24.04"
        return DistroDownloadSpec(
            distroId = "ubuntu",
            variant = "ubuntu-base",
            version = "$ver LTS Base",
            pkgManager = "apt",
            defaultShell = "/bin/bash",
            url = "https://cdimage.ubuntu.com/ubuntu-base/releases/24.04/release/$file",
            expectedSha256 = sha,
            archiveType = "tar.gz"
        )
    }

    private fun resolveKaliNetHunter(variant: String): DistroDownloadSpec {
        val sums = fetchText("https://kali.download/nethunter-images/current/rootfs/SHA256SUMS")
        val targetName = if (variant == "nethunter-full") {
            "kali-nethunter-rootfs-full-arm64.tar.xz"
        } else {
            "kali-nethunter-rootfs-minimal-arm64.tar.xz"
        }
        val line = sums.lineSequence().firstOrNull { it.contains(targetName) }
            ?: throw IllegalStateException("Missing $targetName in Kali NetHunter SHA256SUMS")
        val sha = line.trim().split(Regex("\\s+")).first().lowercase()
        return DistroDownloadSpec(
            distroId = "kali",
            variant = variant,
            version = "Kali NetHunter Current",
            pkgManager = "apt",
            defaultShell = "/bin/bash",
            url = "https://kali.download/nethunter-images/current/rootfs/$targetName",
            expectedSha256 = sha,
            archiveType = "tar.xz"
        )
    }

    fun resolve(distroId: String, variant: String): DistroDownloadSpec {
        return when (distroId.lowercase()) {
            "alpine" -> {
                if (variant == "lxc-3.24") {
                    resolveFromLxcIndex("alpine", "3.24", "alpine", variant, "apk", "/bin/sh")
                } else {
                    resolveAlpineMinirootfs()
                }
            }
            "debian" -> {
                val rel = if (variant == "trixie") "trixie" else "bookworm"
                resolveFromLxcIndex("debian", rel, "debian", variant, "apt", "/bin/bash")
            }
            "ubuntu" -> {
                when (variant) {
                    "ubuntu-base" -> resolveUbuntuBase()
                    "jammy" -> resolveFromLxcIndex("ubuntu", "jammy", "ubuntu", variant, "apt", "/bin/bash")
                    else -> resolveFromLxcIndex("ubuntu", "noble", "ubuntu", "noble", "apt", "/bin/bash")
                }
            }
            "kali" -> {
                if (variant == "nethunter-minimal" || variant == "nethunter-full") {
                    resolveKaliNetHunter(variant)
                } else {
                    resolveFromLxcIndex("kali", "current", "kali", "lxc-current", "apt", "/bin/bash")
                }
            }
            "archlinux" -> {
                resolveFromLxcIndex("archlinux", "current", "archlinux", "lxc-current", "pacman", "/bin/bash")
            }
            "parrot" -> {
                DistroDownloadSpec(
                    distroId = "parrot",
                    variant = "parrot-latest",
                    version = "Parrot Core ARM64",
                    pkgManager = "apt",
                    defaultShell = "/bin/bash",
                    url = "https://download.parrot.sh/parrot/iso/latest/parrot-arm64.tar.xz",
                    expectedSha256 = null,
                    archiveType = "tar.xz"
                )
            }
            else -> throw IllegalArgumentException("Unsupported distribution: $distroId")
        }
    }

    fun pkgManagerForDistro(distroId: String): String = when (distroId.lowercase()) {
        "alpine" -> "apk"
        "archlinux" -> "pacman"
        else -> "apt"
    }

    fun defaultShellForDistro(distroId: String): String = when (distroId.lowercase()) {
        "alpine" -> "/bin/sh"
        else -> "/bin/bash"
    }
}

