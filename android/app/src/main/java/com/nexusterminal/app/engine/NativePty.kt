package com.nexusterminal.app.engine

object NativePty {
    init {
        System.loadLibrary("nexus_pty")
    }

    external fun createPtyProcess(
        cmd: String,
        cwd: String,
        argv: Array<String>,
        envp: Array<String>,
        cols: Int,
        rows: Int
    ): IntArray?

    external fun readPty(fd: Int, buffer: ByteArray): Int

    external fun writePty(fd: Int, data: ByteArray, length: Int): Int

    external fun setWindowSize(fd: Int, cols: Int, rows: Int): Int

    external fun closeFd(fd: Int)

    external fun sendSignal(pid: Int, signal: Int): Int

    external fun waitForProcess(pid: Int): Int
}

