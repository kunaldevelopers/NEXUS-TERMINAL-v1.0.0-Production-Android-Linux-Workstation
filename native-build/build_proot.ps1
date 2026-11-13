$ErrorActionPreference = "Stop"

$NDK_BIN = "C:\Users\Kunal\AppData\Local\Android\Sdk\ndk\27.1.12297006\toolchains\llvm\prebuilt\windows-x86_64\bin"
$CC = Join-Path $NDK_BIN "aarch64-linux-android24-clang.cmd"
$AR = Join-Path $NDK_BIN "llvm-ar.exe"
$NM = Join-Path $NDK_BIN "llvm-nm.exe"
$STRIP = Join-Path $NDK_BIN "llvm-strip.exe"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$REPO_ROOT = Split-Path -Parent $ROOT
$PROOT_SRC = Join-Path $ROOT "proot-5.1.107.102\src"
$TALLOC_SRC = Join-Path $ROOT "talloc-2.4.2"
$SHIM_DIR = Join-Path $ROOT "talloc-shim"
$GEN_DIR = Join-Path $ROOT "proot-gen"
$OBJ_DIR = Join-Path $ROOT "obj-arm64"
$OUT_DIR = Join-Path $REPO_ROOT "android\app\src\main\jniLibs\arm64-v8a"

New-Item -ItemType Directory -Force -Path $OBJ_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $OUT_DIR | Out-Null

Write-Host "==> Compiling libtalloc.a..."
$TallocObj = Join-Path $OBJ_DIR "talloc.o"
$TallocLib = Join-Path $OBJ_DIR "libtalloc.a"
& $CC -O2 -fPIC -D_GNU_SOURCE -I"$SHIM_DIR" -I"$TALLOC_SRC" -c "$TALLOC_SRC\talloc.c" -o "$TallocObj"
if ($LASTEXITCODE -ne 0) { throw "talloc compile failed" }
& $AR rcs "$TallocLib" "$TallocObj"
if ($LASTEXITCODE -ne 0) { throw "talloc archive failed" }

Write-Host "==> Compiling PRoot Loader (libproot_loader.so)..."
$LoaderC = Join-Path $PROOT_SRC "loader\loader.c"
$LoaderS = Join-Path $PROOT_SRC "loader\assembly.S"
$LoaderObjC = Join-Path $OBJ_DIR "loader.o"
$LoaderObjS = Join-Path $OBJ_DIR "assembly.o"
$LoaderOut = Join-Path $OUT_DIR "libproot_loader.so"

& $CC -fPIC -ffreestanding -O2 -D_FILE_OFFSET_BITS=64 -D_GNU_SOURCE -I"$PROOT_SRC" -I"$GEN_DIR" -c "$LoaderC" -o "$LoaderObjC"
if ($LASTEXITCODE -ne 0) { throw "loader.c failed" }
& $CC -fPIC -ffreestanding -O2 -D_FILE_OFFSET_BITS=64 -D_GNU_SOURCE -I"$PROOT_SRC" -I"$GEN_DIR" -c "$LoaderS" -o "$LoaderObjS"
if ($LASTEXITCODE -ne 0) { throw "assembly.S failed" }
& $CC -static -nostdlib "-Wl,--build-id=none,-Ttext=0x5400000000,--rosegment,-z,noexecstack,-z,max-page-size=16384" -o "$LoaderOut" "$LoaderObjC" "$LoaderObjS"
if ($LASTEXITCODE -ne 0) { throw "loader link failed" }

Write-Host "==> Generating loader-info.c..."
$NmLines = & $NM "$LoaderOut"
$PokeAddr = $null
$StartAddr = $null
foreach ($line in $NmLines) {
    if ($line -match '^\s*([0-9a-fA-F]+)\s+\S+\s+pokedata_workaround$') {
        $PokeAddr = [Convert]::ToInt64($Matches[1], 16)
    }
    if ($line -match '^\s*([0-9a-fA-F]+)\s+\S+\s+_start$') {
        $StartAddr = [Convert]::ToInt64($Matches[1], 16)
    }
}
if ($null -eq $PokeAddr -or $null -eq $StartAddr) {
    throw "Failed to extract loader symbols from $LoaderOut"
}
$Offset = $PokeAddr - $StartAddr
$LoaderInfoPath = Join-Path $GEN_DIR "loader-info.c"
@"
#include <unistd.h>
const ssize_t offset_to_pokedata_workaround = $Offset;
"@ | Set-Content -Path $LoaderInfoPath -Encoding ASCII

& $STRIP "$LoaderOut"

Write-Host "==> Compiling PRoot objects..."
$Sources = @(
    "cli\cli.c",
    "cli\proot.c",
    "cli\note.c",
    "execve\enter.c",
    "execve\exit.c",
    "execve\shebang.c",
    "execve\elf.c",
    "execve\ldso.c",
    "execve\auxv.c",
    "execve\aoxp.c",
    "path\binding.c",
    "path\glue.c",
    "path\canon.c",
    "path\f2fs-bug.c",
    "path\path.c",
    "path\proc.c",
    "path\temp.c",
    "syscall\seccomp.c",
    "syscall\syscall.c",
    "syscall\chain.c",
    "syscall\enter.c",
    "syscall\exit.c",
    "syscall\sysnum.c",
    "syscall\socket.c",
    "syscall\heap.c",
    "syscall\rlimit.c",
    "syscall\pipe_shadow.c",
    "tracee\tracee.c",
    "tracee\mem.c",
    "tracee\reg.c",
    "tracee\event.c",
    "tracee\seccomp.c",
    "tracee\statx.c",
    "ptrace\ptrace.c",
    "ptrace\user.c",
    "ptrace\wait.c",
    "extension\extension.c",
    "extension\ashmem_memfd\ashmem_memfd.c",
    "extension\kompat\kompat.c",
    "extension\fake_id0\chown.c",
    "extension\fake_id0\chroot.c",
    "extension\fake_id0\getsockopt.c",
    "extension\fake_id0\sendmsg.c",
    "extension\fake_id0\socket.c",
    "extension\fake_id0\open.c",
    "extension\fake_id0\unlink.c",
    "extension\fake_id0\rename.c",
    "extension\fake_id0\chmod.c",
    "extension\fake_id0\utimensat.c",
    "extension\fake_id0\access.c",
    "extension\fake_id0\exec.c",
    "extension\fake_id0\link.c",
    "extension\fake_id0\symlink.c",
    "extension\fake_id0\mk.c",
    "extension\fake_id0\stat.c",
    "extension\fake_id0\helper_functions.c",
    "extension\fake_id0\fake_id0.c",
    "extension\hidden_files\hidden_files.c",
    "extension\mountinfo\mountinfo.c",
    "extension\port_switch\port_switch.c",
    "extension\sysvipc\sysvipc.c",
    "extension\sysvipc\sysvipc_msg.c",
    "extension\sysvipc\sysvipc_sem.c",
    "extension\sysvipc\sysvipc_shm.c",
    "extension\link2symlink\link2symlink.c",
    "extension\fix_symlink_size\fix_symlink_size.c"
)

$ProotObjs = @()
$CFlags = @(
    "-O2", "-fPIE",
    "-D_FILE_OFFSET_BITS=64",
    "-D_GNU_SOURCE",
    '-DARG_MAX=131072',
    '-DPROOT_UNBUNDLE_LOADER=\"/data/local/tmp\"',
    "-I$GEN_DIR",
    "-I$PROOT_SRC",
    "-I$TALLOC_SRC",
    "-include", "string.h",
    "-Wno-unused-parameter",
    "-Wno-sign-compare",
    "-Wno-deprecated-declarations"
)

foreach ($rel in $Sources) {
    $srcFile = Join-Path $PROOT_SRC $rel
    $objName = ($rel -replace '[\\/.]', '_') + ".o"
    $objFile = Join-Path $OBJ_DIR $objName
    & $CC @CFlags -c "$srcFile" -o "$objFile"
    if ($LASTEXITCODE -ne 0) { throw "Failed compiling $rel" }
    $ProotObjs += $objFile
}

$LoaderInfoObj = Join-Path $OBJ_DIR "loader_info.o"
& $CC @CFlags -c "$LoaderInfoPath" -o "$LoaderInfoObj"
if ($LASTEXITCODE -ne 0) { throw "Failed compiling loader-info.c" }
$ProotObjs += $LoaderInfoObj

Write-Host "==> Linking libproot.so..."
$ProotOut = Join-Path $OUT_DIR "libproot.so"
& $CC -pie -fPIE "-Wl,-z,noexecstack,-z,max-page-size=16384" -o "$ProotOut" @ProotObjs "$TallocLib"
if ($LASTEXITCODE -ne 0) { throw "Linking libproot.so failed" }

& $STRIP "$ProotOut"
Write-Host "==> Built successfully:"
Get-Item "$LoaderOut", "$ProotOut" | Select-Object Name, Length
