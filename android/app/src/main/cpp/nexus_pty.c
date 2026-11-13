#define _GNU_SOURCE
#include <jni.h>
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <termios.h>
#include <unistd.h>
#include <dirent.h>
#include <android/log.h>

#define LOG_TAG "NexusPty"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

static char **jstringArrayToCArray(JNIEnv *env, jobjectArray arr) {
    if (arr == NULL) {
        char **empty = (char **) calloc(1, sizeof(char *));
        return empty;
    }
    jsize len = (*env)->GetArrayLength(env, arr);
    char **out = (char **) calloc((size_t) len + 1, sizeof(char *));
    if (!out) return NULL;
    for (jsize i = 0; i < len; i++) {
        jstring jstr = (jstring) (*env)->GetObjectArrayElement(env, arr, i);
        if (jstr != NULL) {
            const char *utf = (*env)->GetStringUTFChars(env, jstr, NULL);
            out[i] = utf ? strdup(utf) : strdup("");
            if (utf) (*env)->ReleaseStringUTFChars(env, jstr, utf);
            (*env)->DeleteLocalRef(env, jstr);
        } else {
            out[i] = strdup("");
        }
    }
    out[len] = NULL;
    return out;
}

static void freeCArray(char **arr) {
    if (!arr) return;
    for (size_t i = 0; arr[i] != NULL; i++) {
        free(arr[i]);
    }
    free(arr);
}

static void closeInheritedFds(int keepLimit) {
    DIR *dir = opendir("/proc/self/fd");
    if (dir) {
        int dirFd = dirfd(dir);
        struct dirent *ent;
        while ((ent = readdir(dir)) != NULL) {
            int fd = atoi(ent->d_name);
            if (fd >= keepLimit && fd != dirFd) {
                close(fd);
            }
        }
        closedir(dir);
        return;
    }
    for (int fd = keepLimit; fd < 1024; fd++) {
        close(fd);
    }
}

JNIEXPORT jintArray JNICALL
Java_com_nexusterminal_app_engine_NativePty_createPtyProcess(
        JNIEnv *env,
        jobject thiz,
        jstring jCmd,
        jstring jCwd,
        jobjectArray jArgv,
        jobjectArray jEnvp,
        jint cols,
        jint rows) {
    (void) thiz;
    const char *cmd = (*env)->GetStringUTFChars(env, jCmd, NULL);
    const char *cwd = jCwd ? (*env)->GetStringUTFChars(env, jCwd, NULL) : NULL;
    char **argv = jstringArrayToCArray(env, jArgv);
    char **envp = jstringArrayToCArray(env, jEnvp);

    int masterFd = posix_openpt(O_RDWR | O_NOCTTY);
    if (masterFd < 0) {
        masterFd = open("/dev/ptmx", O_RDWR | O_NOCTTY);
    }
    if (masterFd < 0) {
        LOGE("posix_openpt failed: %s", strerror(errno));
        goto fail;
    }

    if (grantpt(masterFd) != 0 || unlockpt(masterFd) != 0) {
        LOGE("grantpt/unlockpt failed: %s", strerror(errno));
        close(masterFd);
        goto fail;
    }

    char slaveName[128];
    if (ptsname_r(masterFd, slaveName, sizeof(slaveName)) != 0) {
        LOGE("ptsname_r failed: %s", strerror(errno));
        close(masterFd);
        goto fail;
    }

    struct winsize ws;
    memset(&ws, 0, sizeof(ws));
    ws.ws_col = (unsigned short) (cols > 0 ? cols : 80);
    ws.ws_row = (unsigned short) (rows > 0 ? rows : 24);
    ioctl(masterFd, TIOCSWINSZ, &ws);

    // Enable UTF-8 input processing on PTY line discipline
    struct termios tios;
    if (tcgetattr(masterFd, &tios) == 0) {
        tios.c_iflag |= IUTF8;
        tcsetattr(masterFd, TCSANOW, &tios);
    }

    pid_t pid = fork();
    if (pid < 0) {
        LOGE("fork failed: %s", strerror(errno));
        close(masterFd);
        goto fail;
    }

    if (pid == 0) {
        // Child process
        sigset_t emptyMask;
        sigemptyset(&emptyMask);
        sigprocmask(SIG_SETMASK, &emptyMask, NULL);
        signal(SIGPIPE, SIG_DFL);
        signal(SIGCHLD, SIG_DFL);
        signal(SIGINT, SIG_DFL);
        signal(SIGQUIT, SIG_DFL);
        signal(SIGTERM, SIG_DFL);
        signal(SIGTSTP, SIG_DFL);
        signal(SIGTTIN, SIG_DFL);
        signal(SIGTTOU, SIG_DFL);

        close(masterFd);

        if (setsid() < 0) {
            _exit(125);
        }

        int slaveFd = open(slaveName, O_RDWR);
        if (slaveFd < 0) {
            _exit(126);
        }

        ioctl(slaveFd, TIOCSCTTY, 0);
        ioctl(slaveFd, TIOCSWINSZ, &ws);

        dup2(slaveFd, STDIN_FILENO);
        dup2(slaveFd, STDOUT_FILENO);
        dup2(slaveFd, STDERR_FILENO);

        if (slaveFd > STDERR_FILENO) {
            close(slaveFd);
        }
        closeInheritedFds(3);

        if (cwd && cwd[0] != '\0') {
            if (chdir(cwd) != 0) {
                chdir("/");
            }
        }

        execve(cmd, argv, envp);
        dprintf(STDERR_FILENO, "execve(%s) failed: %s\n", cmd, strerror(errno));
        _exit(127);
    }

    // Parent process
    if (cmd) (*env)->ReleaseStringUTFChars(env, jCmd, cmd);
    if (cwd) (*env)->ReleaseStringUTFChars(env, jCwd, cwd);
    freeCArray(argv);
    freeCArray(envp);

    jintArray result = (*env)->NewIntArray(env, 2);
    jint pair[2] = { (jint) pid, (jint) masterFd };
    (*env)->SetIntArrayRegion(env, result, 0, 2, pair);
    return result;

fail:
    if (cmd) (*env)->ReleaseStringUTFChars(env, jCmd, cmd);
    if (cwd) (*env)->ReleaseStringUTFChars(env, jCwd, cwd);
    freeCArray(argv);
    freeCArray(envp);
    return NULL;
}

JNIEXPORT jint JNICALL
Java_com_nexusterminal_app_engine_NativePty_readPty(
        JNIEnv *env,
        jobject thiz,
        jint fd,
        jbyteArray buffer) {
    (void) thiz;
    if (fd < 0 || buffer == NULL) return -1;
    jsize cap = (*env)->GetArrayLength(env, buffer);
    jbyte *buf = (*env)->GetByteArrayElements(env, buffer, NULL);
    if (!buf) return -1;

    ssize_t n = read(fd, buf, (size_t) cap);
    int err = errno;
    (*env)->ReleaseByteArrayElements(env, buffer, buf, 0);

    if (n > 0) return (jint) n;
    if (n == 0) return -1; // EOF
    if (err == EINTR || err == EAGAIN) return -2;
    return -1;
}

JNIEXPORT jint JNICALL
Java_com_nexusterminal_app_engine_NativePty_writePty(
        JNIEnv *env,
        jobject thiz,
        jint fd,
        jbyteArray data,
        jint length) {
    (void) thiz;
    if (fd < 0 || data == NULL || length <= 0) return 0;
    jbyte *bytes = (*env)->GetByteArrayElements(env, data, NULL);
    if (!bytes) return -1;

    jint total = 0;
    while (total < length) {
        ssize_t written = write(fd, bytes + total, (size_t) (length - total));
        if (written > 0) {
            total += (jint) written;
        } else if (errno == EINTR) {
            continue;
        } else {
            total = -1;
            break;
        }
    }

    (*env)->ReleaseByteArrayElements(env, data, bytes, JNI_ABORT);
    return total;
}

JNIEXPORT jint JNICALL
Java_com_nexusterminal_app_engine_NativePty_setWindowSize(
        JNIEnv *env,
        jobject thiz,
        jint fd,
        jint cols,
        jint rows) {
    (void) env;
    (void) thiz;
    if (fd < 0) return -1;
    struct winsize ws;
    memset(&ws, 0, sizeof(ws));
    ws.ws_col = (unsigned short) (cols > 0 ? cols : 80);
    ws.ws_row = (unsigned short) (rows > 0 ? rows : 24);
    return ioctl(fd, TIOCSWINSZ, &ws) == 0 ? 0 : -1;
}

JNIEXPORT void JNICALL
Java_com_nexusterminal_app_engine_NativePty_closeFd(
        JNIEnv *env,
        jobject thiz,
        jint fd) {
    (void) env;
    (void) thiz;
    if (fd >= 0) close(fd);
}

JNIEXPORT jint JNICALL
Java_com_nexusterminal_app_engine_NativePty_sendSignal(
        JNIEnv *env,
        jobject thiz,
        jint pid,
        jint sig) {
    (void) env;
    (void) thiz;
    if (pid <= 0) return -1;
    if (kill(-pid, sig) == 0) return 0;
    return kill(pid, sig) == 0 ? 0 : -1;
}

JNIEXPORT jint JNICALL
Java_com_nexusterminal_app_engine_NativePty_waitForProcess(
        JNIEnv *env,
        jobject thiz,
        jint pid) {
    (void) env;
    (void) thiz;
    if (pid <= 0) return -1;
    int status = 0;
    while (waitpid(pid, &status, 0) < 0) {
        if (errno == EINTR) continue;
        return -1;
    }
    if (WIFEXITED(status)) return WEXITSTATUS(status);
    if (WIFSIGNALED(status)) return 128 + WTERMSIG(status);
    return status;
}

