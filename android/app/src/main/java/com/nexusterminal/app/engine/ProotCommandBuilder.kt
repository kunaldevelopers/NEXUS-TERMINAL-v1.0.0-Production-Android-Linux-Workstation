package com.nexusterminal.app.engine

import android.content.Context
import android.os.Environment
import com.nexusterminal.app.distro.DistroEnvironment
import java.io.File

data class LaunchSpec(
    val executable: String,
    val argv: Array<String>,
    val envp: Array<String>,
    val hostCwd: String
)

object ProotCommandBuilder {

    fun buildInteractiveShellSpec(
        context: Context,
        env: DistroEnvironment?,
        shell: String,
        guestCwd: String,
        customPrompt: Boolean,
        promptShowGit: Boolean,
        promptShowExitCode: Boolean,
        initialCommand: String = ""
    ): LaunchSpec {
        if (env == null) {
            val sh = if (File("/system/bin/sh").exists()) "/system/bin/sh" else "/bin/sh"
            val workspace = File(context.filesDir, "workspace").apply { mkdirs() }
            val envList = mutableListOf(
                "TERM=xterm-256color",
                "COLORTERM=truecolor",
                "HOME=${workspace.absolutePath}",
                "USER=android",
                "PATH=/sbin:/system/sbin:/system/bin:/system/xbin:/vendor/bin",
                "NEXUS_ENV=android-shell"
            )
            val args = if (initialCommand.isNotBlank()) {
                arrayOf(sh, "-c", "$initialCommand; exec $sh")
            } else {
                arrayOf(sh)
            }
            return LaunchSpec(sh, args, envList.toTypedArray(), workspace.absolutePath)
        }

        val nativeLibDir = context.applicationInfo.nativeLibraryDir
        val prootBin = File(nativeLibDir, "libproot.so")
        val loaderBin = File(nativeLibDir, "libproot_loader.so")
        if (!prootBin.exists() || !loaderBin.exists()) {
            throw IllegalStateException("PRoot native binaries missing in $nativeLibDir")
        }

        val rootfs = File(env.rootfsPath)
        if (!rootfs.exists()) {
            throw IllegalStateException("Rootfs directory missing for ${env.name}")
        }

        val prootTmp = File(context.cacheDir, "proot_tmp/${env.envId}").apply { mkdirs() }
        val guestTmp = File(rootfs, "tmp").apply { mkdirs() }
        val guestShm = File(rootfs, "dev/shm").apply { mkdirs() }
        val guestRoot = File(rootfs, "root").apply { mkdirs() }
        val workspace = File(context.filesDir, "workspace").apply { mkdirs() }
        File(rootfs, "nexus").mkdirs()

        val resolvedShell = resolveShellInsideRootfs(rootfs, shell)
        val effectiveCwd = guestCwd.ifBlank { "/root" }

        val argv = mutableListOf(
            prootBin.absolutePath,
            "--kill-on-exit",
            "--link2symlink",
            "-0",
            "-r", rootfs.absolutePath,
            "-b", "/dev",
            "-b", "/proc",
            "-b", "/sys",
            "-b", "/dev/urandom:/dev/random",
            "-b", "/proc/self/fd:/dev/fd",
            "-b", "/proc/self/fd/0:/dev/stdin",
            "-b", "/proc/self/fd/1:/dev/stdout",
            "-b", "/proc/self/fd/2:/dev/stderr",
            "-b", "${guestShm.absolutePath}:/dev/shm",
            "-b", "${workspace.absolutePath}:/nexus",
            "-w", effectiveCwd
        )

        val sdcard = Environment.getExternalStorageDirectory()
        if (sdcard != null && sdcard.exists() && sdcard.canRead()) {
            File(rootfs, "sdcard").mkdirs()
            argv.add("-b")
            argv.add("${sdcard.absolutePath}:/sdcard")
        }

        // Guest execution command
        if (initialCommand.isNotBlank()) {
            argv.add("/usr/bin/env")
            argv.add(resolvedShell)
            argv.add("-lc")
            argv.add("$initialCommand; exec $resolvedShell -l")
        } else {
            argv.add(resolvedShell)
            if (resolvedShell.endsWith("bash") || resolvedShell.endsWith("zsh") || resolvedShell.endsWith("fish")) {
                argv.add("-l")
            }
        }

        val envp = buildGuestEnv(
            env = env,
            prootTmp = prootTmp,
            loaderBin = loaderBin,
            resolvedShell = resolvedShell,
            customPrompt = customPrompt,
            promptShowGit = promptShowGit,
            promptShowExitCode = promptShowExitCode
        )

        return LaunchSpec(
            executable = prootBin.absolutePath,
            argv = argv.toTypedArray(),
            envp = envp.toTypedArray(),
            hostCwd = guestRoot.absolutePath
        )
    }

    fun buildCommandCaptureSpec(
        context: Context,
        env: DistroEnvironment,
        command: String,
        guestCwd: String = "/root"
    ): LaunchSpec {
        val nativeLibDir = context.applicationInfo.nativeLibraryDir
        val prootBin = File(nativeLibDir, "libproot.so")
        val loaderBin = File(nativeLibDir, "libproot_loader.so")
        val rootfs = File(env.rootfsPath)
        val prootTmp = File(context.cacheDir, "proot_tmp/${env.envId}").apply { mkdirs() }
        val guestShm = File(rootfs, "dev/shm").apply { mkdirs() }
        val workspace = File(context.filesDir, "workspace").apply { mkdirs() }
        File(rootfs, "nexus").mkdirs()

        val sh = resolveShellInsideRootfs(rootfs, "/bin/sh")
        val argv = mutableListOf(
            prootBin.absolutePath,
            "--kill-on-exit",
            "--link2symlink",
            "-0",
            "-r", rootfs.absolutePath,
            "-b", "/dev",
            "-b", "/proc",
            "-b", "/sys",
            "-b", "/dev/urandom:/dev/random",
            "-b", "/proc/self/fd:/dev/fd",
            "-b", "${guestShm.absolutePath}:/dev/shm",
            "-b", "${workspace.absolutePath}:/nexus",
            "-w", guestCwd.ifBlank { "/root" }
        )

        val sdcard = Environment.getExternalStorageDirectory()
        if (sdcard != null && sdcard.exists() && sdcard.canRead()) {
            File(rootfs, "sdcard").mkdirs()
            argv.add("-b")
            argv.add("${sdcard.absolutePath}:/sdcard")
        }

        argv.add(sh)
        argv.add("-c")
        argv.add(command)

        val envp = buildGuestEnv(
            env = env,
            prootTmp = prootTmp,
            loaderBin = loaderBin,
            resolvedShell = sh,
            customPrompt = false,
            promptShowGit = false,
            promptShowExitCode = false
        )

        return LaunchSpec(
            executable = prootBin.absolutePath,
            argv = argv.toTypedArray(),
            envp = envp.toTypedArray(),
            hostCwd = rootfs.absolutePath
        )
    }

    private fun resolveShellInsideRootfs(rootfs: File, preferred: String): String {
        val candidates = listOf(
            preferred,
            "/bin/bash",
            "/usr/bin/bash",
            "/bin/zsh",
            "/usr/bin/zsh",
            "/usr/bin/fish",
            "/bin/sh",
            "/usr/bin/sh"
        ).distinct()
        for (cand in candidates) {
            val rel = cand.trimStart('/')
            val file = File(rootfs, rel)
            if (file.exists() || java.nio.file.Files.isSymbolicLink(file.toPath())) {
                return cand
            }
        }
        return "/bin/sh"
    }

    private fun buildGuestEnv(
        env: DistroEnvironment,
        prootTmp: File,
        loaderBin: File,
        resolvedShell: String,
        customPrompt: Boolean,
        promptShowGit: Boolean,
        promptShowExitCode: Boolean
    ): List<String> {
        val list = mutableListOf(
            "PROOT_LOADER=${loaderBin.absolutePath}",
            "PROOT_TMP_DIR=${prootTmp.absolutePath}",
            "PROOT_NO_SECCOMP=0",
            "TERM=xterm-256color",
            "COLORTERM=truecolor",
            "HOME=/root",
            "USER=root",
            "LOGNAME=root",
            "SHELL=$resolvedShell",
            "LANG=C.UTF-8",
            "LC_ALL=C.UTF-8",
            "DEBIAN_FRONTEND=noninteractive",
            "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            "TMPDIR=/tmp",
            "NEXUS_DISTRO=${env.distroId}",
            "NEXUS_ENV=${env.name}",
            "NEXUS_CUSTOM_PROMPT=${if (customPrompt) "1" else "0"}",
            "NEXUS_PROMPT_GIT=${if (promptShowGit) "1" else "0"}",
            "NEXUS_PROMPT_EXIT=${if (promptShowExitCode) "1" else "0"}"
        )
        return list
    }
}

