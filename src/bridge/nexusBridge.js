import { Capacitor, registerPlugin } from '@capacitor/core';

const NexusTerminal = registerPlugin('NexusTerminal');
const NexusDistro = registerPlugin('NexusDistro');
const NexusPackage = registerPlugin('NexusPackage');
const NexusSsh = registerPlugin('NexusSsh');
const NexusFile = registerPlugin('NexusFile');
const NexusSystem = registerPlugin('NexusSystem');

export const isNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

function requireNative(featureName) {
  if (!isNativeAndroid()) {
    const err = new Error(
      `Native Android Capacitor plugin required for "${featureName}". Run inside the NEXUS TERMINAL Android APK (arm64-v8a).`
    );
    err.code = 'NATIVE_BRIDGE_UNAVAILABLE';
    throw err;
  }
}

export const nexusBridge = {
  isNative: isNativeAndroid,

  terminal: {
    async createSession(options) {
      requireNative('terminal.createSession');
      return NexusTerminal.createSession(options);
    },
    async writeInput(sessionId, dataBase64) {
      requireNative('terminal.writeInput');
      return NexusTerminal.writeInput({ sessionId, dataBase64 });
    },
    async writeText(sessionId, text) {
      requireNative('terminal.writeText');
      return NexusTerminal.writeText({ sessionId, text });
    },
    async resize(sessionId, cols, rows) {
      requireNative('terminal.resize');
      return NexusTerminal.resize({ sessionId, cols, rows });
    },
    async sendSignal(sessionId, signal) {
      requireNative('terminal.sendSignal');
      return NexusTerminal.sendSignal({ sessionId, signal });
    },
    async killSession(sessionId) {
      requireNative('terminal.killSession');
      return NexusTerminal.killSession({ sessionId });
    },
    async listSessions() {
      if (!isNativeAndroid()) return { sessions: [] };
      return NexusTerminal.listSessions();
    },
    async getSessionBuffer(sessionId) {
      requireNative('terminal.getSessionBuffer');
      return NexusTerminal.getSessionBuffer({ sessionId });
    },
    async runCommandCapture(options) {
      requireNative('terminal.runCommandCapture');
      return NexusTerminal.runCommandCapture(options);
    },
    async setForegroundService(enabled, wakelock = false) {
      if (!isNativeAndroid()) return { running: false };
      return NexusTerminal.setForegroundService({ enabled, wakelock });
    },
    addOutputListener(cb) {
      if (!isNativeAndroid()) return Promise.resolve({ remove: () => {} });
      return NexusTerminal.addListener('terminalOutput', cb);
    },
    addExitListener(cb) {
      if (!isNativeAndroid()) return Promise.resolve({ remove: () => {} });
      return NexusTerminal.addListener('terminalExit', cb);
    },
    addCaptureListener(cb) {
      if (!isNativeAndroid()) return Promise.resolve({ remove: () => {} });
      return NexusTerminal.addListener('commandOutput', cb);
    },
  },

  distro: {
    async getCatalog() {
      if (!isNativeAndroid()) return { items: [], prootAvailable: false };
      return NexusDistro.getCatalog();
    },
    async listEnvironments() {
      if (!isNativeAndroid()) return { environments: [], defaultEnvId: null };
      return NexusDistro.listEnvironments();
    },
    async installDistro(options) {
      requireNative('distro.installDistro');
      return NexusDistro.installDistro(options);
    },
    async cancelInstall(envId) {
      requireNative('distro.cancelInstall');
      return NexusDistro.cancelInstall({ envId });
    },
    async deleteEnvironment(envId) {
      requireNative('distro.deleteEnvironment');
      return NexusDistro.deleteEnvironment({ envId });
    },
    async renameEnvironment(envId, newName) {
      requireNative('distro.renameEnvironment');
      return NexusDistro.renameEnvironment({ envId, newName });
    },
    async setDefaultEnvironment(envId) {
      requireNative('distro.setDefaultEnvironment');
      return NexusDistro.setDefaultEnvironment({ envId });
    },
    async stopEnvironment(envId) {
      requireNative('distro.stopEnvironment');
      return NexusDistro.stopEnvironment({ envId });
    },
    async backupEnvironment(envId, outputPath) {
      requireNative('distro.backupEnvironment');
      return NexusDistro.backupEnvironment({ envId, outputPath });
    },
    async restoreEnvironment(options) {
      requireNative('distro.restoreEnvironment');
      return NexusDistro.restoreEnvironment(options);
    },
    async getEnvironmentDetails(envId) {
      requireNative('distro.getEnvironmentDetails');
      return NexusDistro.getEnvironmentDetails({ envId });
    },
    addProgressListener(cb) {
      if (!isNativeAndroid()) return Promise.resolve({ remove: () => {} });
      return NexusDistro.addListener('distroProgress', cb);
    },
  },

  pkg: {
    async search(envId, query) {
      requireNative('pkg.search');
      return NexusPackage.searchPackages({ envId, query });
    },
    async listInstalled(envId) {
      requireNative('pkg.listInstalled');
      return NexusPackage.listInstalled({ envId });
    },
    async getInfo(envId, packageName) {
      requireNative('pkg.getInfo');
      return NexusPackage.getPackageInfo({ envId, packageName });
    },
    async install(envId, packageName) {
      requireNative('pkg.install');
      return NexusPackage.installPackage({ envId, packageName });
    },
    async remove(envId, packageName) {
      requireNative('pkg.remove');
      return NexusPackage.removePackage({ envId, packageName });
    },
    async updateAll(envId, upgrade = false) {
      requireNative('pkg.updateAll');
      return NexusPackage.updateSystem({ envId, upgrade });
    },
    async getRepositories(envId) {
      requireNative('pkg.getRepositories');
      return NexusPackage.getRepositories({ envId });
    },
    async saveRepositories(envId, filePath, content) {
      requireNative('pkg.saveRepositories');
      return NexusPackage.saveRepositories({ envId, filePath, content });
    },
    addLogListener(cb) {
      if (!isNativeAndroid()) return Promise.resolve({ remove: () => {} });
      return NexusPackage.addListener('packageLog', cb);
    },
  },

  ssh: {
    async listProfiles() {
      if (!isNativeAndroid()) return { profiles: [] };
      return NexusSsh.listProfiles();
    },
    async saveProfile(profile) {
      requireNative('ssh.saveProfile');
      return NexusSsh.saveProfile(profile);
    },
    async deleteProfile(profileId) {
      requireNative('ssh.deleteProfile');
      return NexusSsh.deleteProfile({ profileId });
    },
    async listKeys() {
      if (!isNativeAndroid()) return { keys: [] };
      return NexusSsh.listKeys();
    },
    async importKey(options) {
      requireNative('ssh.importKey');
      return NexusSsh.importKey(options);
    },
    async exportKey(keyId) {
      requireNative('ssh.exportKey');
      return NexusSsh.exportKey({ keyId });
    },
    async deleteKey(keyId) {
      requireNative('ssh.deleteKey');
      return NexusSsh.deleteKey({ keyId });
    },
    async connect(options) {
      requireNative('ssh.connect');
      return NexusSsh.connectSsh(options);
    },
    async sendInput(sshSessionId, dataBase64) {
      requireNative('ssh.sendInput');
      return NexusSsh.sendSshInput({ sshSessionId, dataBase64 });
    },
    async resize(sshSessionId, cols, rows) {
      requireNative('ssh.resize');
      return NexusSsh.resizeSsh({ sshSessionId, cols, rows });
    },
    async disconnect(sshSessionId) {
      requireNative('ssh.disconnect');
      return NexusSsh.disconnectSsh({ sshSessionId });
    },
    async startTunnel(options) {
      requireNative('ssh.startTunnel');
      return NexusSsh.startTunnel(options);
    },
    async stopTunnel(tunnelId) {
      requireNative('ssh.stopTunnel');
      return NexusSsh.stopTunnel({ tunnelId });
    },
    async listTunnels() {
      if (!isNativeAndroid()) return { tunnels: [] };
      return NexusSsh.listTunnels();
    },
    async sftpList(sshSessionId, remotePath) {
      requireNative('ssh.sftpList');
      return NexusSsh.sftpList({ sshSessionId, remotePath });
    },
    async sftpDownload(sshSessionId, remotePath, localPath) {
      requireNative('ssh.sftpDownload');
      return NexusSsh.sftpDownload({ sshSessionId, remotePath, localPath });
    },
    async sftpUpload(sshSessionId, localPath, remotePath) {
      requireNative('ssh.sftpUpload');
      return NexusSsh.sftpUpload({ sshSessionId, localPath, remotePath });
    },
    async sftpMkdir(sshSessionId, remotePath) {
      requireNative('ssh.sftpMkdir');
      return NexusSsh.sftpMkdir({ sshSessionId, remotePath });
    },
    async sftpDelete(sshSessionId, remotePath, isDir) {
      requireNative('ssh.sftpDelete');
      return NexusSsh.sftpDelete({ sshSessionId, remotePath, isDir });
    },
    async sftpRename(sshSessionId, oldPath, newPath) {
      requireNative('ssh.sftpRename');
      return NexusSsh.sftpRename({ sshSessionId, oldPath, newPath });
    },
    addOutputListener(cb) {
      if (!isNativeAndroid()) return Promise.resolve({ remove: () => {} });
      return NexusSsh.addListener('sshOutput', cb);
    },
    addClosedListener(cb) {
      if (!isNativeAndroid()) return Promise.resolve({ remove: () => {} });
      return NexusSsh.addListener('sshClosed', cb);
    },
  },

  files: {
    async getRoots() {
      if (!isNativeAndroid()) return { roots: [] };
      return NexusFile.getStorageRoots();
    },
    async list(path, showHidden = true) {
      requireNative('files.list');
      return NexusFile.listFiles({ path, showHidden });
    },
    async read(path) {
      requireNative('files.read');
      return NexusFile.readFile({ path });
    },
    async write(path, content) {
      requireNative('files.write');
      return NexusFile.writeFile({ path, content });
    },
    async mkdir(path) {
      requireNative('files.mkdir');
      return NexusFile.createDirectory({ path });
    },
    async remove(path) {
      requireNative('files.remove');
      return NexusFile.deletePath({ path });
    },
    async rename(path, newName) {
      requireNative('files.rename');
      return NexusFile.renamePath({ path, newName });
    },
    async copy(sourcePath, destDir) {
      requireNative('files.copy');
      return NexusFile.copyPath({ sourcePath, destDir });
    },
    async move(sourcePath, destDir) {
      requireNative('files.move');
      return NexusFile.movePath({ sourcePath, destDir });
    },
    async search(basePath, query) {
      requireNative('files.search');
      return NexusFile.searchFiles({ basePath, query });
    },
    async chmod(path, octalMode) {
      requireNative('files.chmod');
      return NexusFile.chmodPath({ path, octalMode });
    },
    async extract(archivePath, destDir) {
      requireNative('files.extract');
      return NexusFile.extractArchive({ archivePath, destDir });
    },
    async createArchive(sourcePaths, outputPath, format = 'zip') {
      requireNative('files.createArchive');
      return NexusFile.createArchive({ sourcePaths, outputPath, format });
    },
    async pickSafFile() {
      requireNative('files.pickSafFile');
      return NexusFile.pickSafFile();
    },
    async importSafToPath(uri, destDir, fileName) {
      requireNative('files.importSafToPath');
      return NexusFile.importSafFile({ uri, destDir, fileName });
    },
    async exportPathToSaf(sourcePath, mimeType, suggestedName) {
      requireNative('files.exportPathToSaf');
      return NexusFile.exportToSaf({ sourcePath, mimeType, suggestedName });
    },
  },

  system: {
    async getMetrics() {
      if (!isNativeAndroid()) {
        return {
          nativeAvailable: false,
          platform: 'web',
          userAgent: navigator.userAgent,
          cores: navigator.hardwareConcurrency || 0,
        };
      }
      return NexusSystem.getSystemMetrics();
    },
    async getProcesses() {
      if (!isNativeAndroid()) return { processes: [] };
      return NexusSystem.getRunningProcesses();
    },
    async getStoragePermissionStatus() {
      if (!isNativeAndroid()) return { granted: false, sdkInt: 0 };
      return NexusSystem.getStoragePermissions();
    },
    async requestStoragePermission() {
      requireNative('system.requestStoragePermission');
      return NexusSystem.requestStoragePermission();
    },
    async checkBatteryOptimization() {
      if (!isNativeAndroid()) return { ignoring: false };
      return NexusSystem.checkBatteryOptimization();
    },
    async requestIgnoreBatteryOptimization() {
      requireNative('system.requestIgnoreBatteryOptimization');
      return NexusSystem.requestIgnoreBatteryOptimization();
    },
    async saveSecureSecret(key, value) {
      if (!isNativeAndroid()) return { ok: false };
      return NexusSystem.saveSecureSecret({ key, value });
    },
    async getSecureSecret(key) {
      if (!isNativeAndroid()) return { value: '' };
      return NexusSystem.getSecureSecret({ key });
    },
    async wipeAllAppData() {
      requireNative('system.wipeAllAppData');
      return NexusSystem.wipeAllAppData();
    },
  },
};

export function encodeBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

export function decodeBase64ToUint8Array(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

